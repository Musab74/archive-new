import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { TrafficPage, fmtMB, fmtMbps, fmtRate } from '../features/admin/pages/traffic/TrafficPage';
import { ADMIN_MENU, grantForPath } from '../shared/auth/adminMenu';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['B'], subGrants: ['B1'], canWrite: true } as AdminSessionState['admin'];
const session: AdminSessionState = { phase: 'authed', isAuthed: true, canWrite: true, secondsLeft: 900, admin, login: async () => { throw new Error('x'); }, logout: async () => {}, extend: async () => true };

const learner = (id: string, name: string, rate: number, o: Record<string, unknown> = {}) => ({
  id, name, companyName: '테스트회사', lectureCode: 'C001', courseName: '리더십 과정', contentsIdx: 3596, lessonTitle: '1차시 스피치란 무엇인가요?', studySeq: 1, lastTick: '2026-10-20 14:00:05',
  ip: `10.0.0.${id.length}`, sharedIp: 1, connections: 2, rateBps: rate, peakBps: rate * 2, sessionBytes: 120_000_000, sessionStart: '2026-10-20T04:40:00.000Z', todayBytes: 350_000_000,
  spark: Array.from({ length: 30 }, () => rate), ...o,
});
const live = (focusIds: string[]) => ({
  at: '2026-10-20T05:00:10.000Z', day: '2026-10-20',
  monitor: { enabled: true, running: true, startedAt: '2026-10-20T04:00:00.000Z', sampleMs: 1000, ports: ['80', '443'], lastSampleAt: '2026-10-20T05:00:10.000Z', error: null, learnersAt: '2026-10-20T05:00:05.000Z', learnerError: null, activeWindowSec: 180, rateWindowSec: 5 },
  site: { rateBps: 5_000_000, peakBps: 9_000_000, todayBytes: 42_000_000_000, connections: 60, series: Array.from({ length: 300 }, (_, i) => i * 10_000) },
  learners: { active: 3, receiving: 2, sharedIps: 1, rateBps: 1_500_000 },
  items: [learner('kim01', '김학습', 1_000_000), learner('lee002', '이학습', 500_000, { sharedIp: 2 }), learner('park0003', '박학습', 0)],
  focus: focusIds.map((id) => ({ id, series: Array.from({ length: 299 }, () => 400_000) })),
  unidentified: [{ ip: '203.0.113.9', rateBps: 200_000, todayBytes: 5_000_000, connections: 1 }],
});

function apiMock(seen: string[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://x');
    seen.push(url.search);
    if (url.pathname.endsWith('/admin/monitoring/traffic/live')) return json(live((url.searchParams.get('focus') ?? '').split(',').filter(Boolean)));
    return json({ error: { code: 'NOT_FOUND', message: String(input) } }, 404);
  });
}
const mount = (path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}><TrafficPage /></MemoryRouter></AdminSessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>);
};

describe('실시간 트래픽 page', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is in the 모니터링 menu behind grant B1, with decimal units', () => {
    expect(ADMIN_MENU.find((g) => g.key === 'monitoring')?.items.some((i) => i.to === '/admin/monitoring/traffic' && i.grant === 'B1')).toBe(true);
    expect(grantForPath('/admin/monitoring/traffic')).toBe('B1');
    expect(fmtRate(1_250_000)).toBe('1.25 MB/s');
    expect(fmtMbps(1_250_000)).toBe('10.0 Mbps');
    expect(fmtMB(350_000_000)).toBe('350.0 MB');
    expect(fmtMB(42_000_000_000)).toBe('42.00 GB');
  });

  it('lists studying learners and auto-compares the two busiest side by side', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', apiMock(seen));
    mount('/admin/monitoring/traffic');
    expect(await screen.findByText('학습 중인 학습자 3명')).toBeTruthy();
    expect(screen.getAllByText('공유 2명').length).toBeGreaterThan(0);
    await waitFor(() => expect(seen.some((s) => decodeURIComponent(s).includes('focus=kim01,lee002'))).toBe(true));
    expect(await screen.findAllByText('자동 선택')).toHaveLength(2);
    expect(screen.getByRole('img', { name: '김학습 최근 5분 전송 속도' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '이학습 최근 5분 전송 속도' })).toBeTruthy();
  });

  it('pinning a learner asks for that learner’s series and replaces the automatic pick', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', apiMock(seen));
    mount('/admin/monitoring/traffic');
    await screen.findByText('학습 중인 학습자 3명');
    fireEvent.click(screen.getAllByRole('button', { name: '고정' })[2]!);
    await waitFor(() => expect(seen.some((s) => decodeURIComponent(s).includes('focus=park0003'))).toBe(true));
    expect(await screen.findByRole('img', { name: '박학습 최근 5분 전송 속도' })).toBeTruthy();
    expect(screen.queryByText('자동 선택')).toBeNull();
  });
});
