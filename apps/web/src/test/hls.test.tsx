import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { HlsPage, fmtBytes } from '../features/admin/pages/hls/HlsPage';
import { ADMIN_MENU, grantForPath } from '../shared/auth/adminMenu';
import { VideoStage } from '../features/player/VideoStage';
import { createRef } from 'react';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['D'], subGrants: ['D2'], canWrite: true } as AdminSessionState['admin'];
const session: AdminSessionState = { phase: 'authed', isAuthed: true, canWrite: true, secondsLeft: 900, admin, login: async () => { throw new Error('x'); }, logout: async () => {}, extend: async () => true };

const status = { featureEnabled: true, worker: { alive: true, lastSeen: '2026-10-16T06:00:00Z', ffmpeg: 'ffmpeg version 7.0.2-static', hours: '', runningJob: null }, queue: { queued: 0, running: 1, done: 3, failed: 0, cancelled: 0 }, hlsRootExists: true, publicBase: '/hls', preset: 'slow', threads: 8 };
const src = (o: Record<string, unknown> = {}) => ({ rel: 'H/A/01.mp4', exists: true, bytes: 800 * 1024 * 1024, mtime: '2026-01-01T00:00:00.000Z', problem: null, ready: false, ver: 'v1-0123456789', publicUrl: null, otherVersions: [], job: null, ...o });
const chapter = (n: number, o: Record<string, unknown> = {}) => ({ number: n, chapterSeq: 100 + n, title: `${n}차시 제목`, minutes: 25, contentsIdx: 500 + n, contentsType: 'B', url: `/contents/H/A/0${n}.mp4`, packagePage: null, problem: null, sources: [src({ rel: `H/A/0${n}.mp4` })], learners30: 0, lastStudy: null, idle: true, ...o });
const result = { sourceSeconds: 1500, renditions: [{ name: '720p', width: 1280, height: 720, bandwidth: 1_700_000, bytes: 200 * 1024 * 1024, seconds: 1500, playlist: '720p.m3u8', file: '720p.m4s' }], bytes: 280 * 1024 * 1024, encodeSeconds: 600, publicUrl: '/hls/H/A/03/v1-0123456789/master.m3u8' };
const course = {
  lectureCode: 'HLS01', title: '테스트 과정', ctype: 'X', packageYN: false, activeDays: 30,
  totals: { chapters: 4, sources: 3, ready: 1, sourceBytes: 2400 * 1024 * 1024, hlsBytes: 280 * 1024 * 1024 },
  chapters: [
    chapter(1),
    chapter(2, { learners30: 12, idle: false, lastStudy: '2026-10-15 10:00' }),
    chapter(3, { sources: [src({ rel: 'H/A/03.mp4', ready: true, publicUrl: result.publicUrl, job: { id: 'c'.repeat(16), state: 'done', progress: 1, speed: 2.5, error: null, createdAt: '2026-10-16T01:00:00Z', finishedAt: '2026-10-16T01:10:00Z', result } })] }),
    chapter(4, { sources: [], problem: '패키지 안에서 MP4를 찾지 못함', contentsType: 'A' }),
  ],
};
const popular = { days: 30, cachedAt: '2026-10-20T03:00:00.000Z', items: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ contentsIdx: 700 + n, title: `인기 ${n}`, minutes: 25, contentsType: 'B', learners: 100 - n, lastStudy: '2026-10-19 10:00', lectureCode: 'POP01', chapterSeq: 800 + n, courses: n === 1 ? 3 : 1, url: `/contents/P/${n}.mp4`, problem: null, sources: [src({ rel: `P/${n}.mp4`, ...(n === 2 ? { ready: true, publicUrl: '/hls/P/2/v1-0123456789/master.m3u8' } : {}) })] })) };
const jobs = { items: [{ id: 'c'.repeat(16), state: 'running', sourceRel: 'H/A/05.mp4', key: 'H/A/05', ver: 'v1-0123456789', include1080: false, sourceBytes: 1024, lectureCode: 'HLS01', chapterSeq: 105, contentsIdx: 505, title: '5차시', requestedBy: 'admin01', createdAt: '2026-10-16T05:00:00Z', startedAt: '2026-10-16T05:00:01Z', finishedAt: null, progress: 0.42, speed: 2.2, error: null, result: null }], total: 1 };

function apiMock(posted: { url: string; body: unknown }[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'POST') { posted.push({ url, body: init.body ? JSON.parse(String(init.body)) : null }); }
    if (url.includes('/admin/hls/status')) return json(status);
    if (url.includes('/admin/hls/popular')) return json(popular);
    if (url.includes('/admin/hls/jobs/contents')) return json({ queued: [{ chapterSeq: 801, rel: 'P/1.mp4', jobId: 'd'.repeat(16), created: true, state: 'queued' }], skipped: [], skippedContents: [] }, 201);
    if (url.includes('/admin/hls/course/HLS01')) return json(course);
    if (url.includes('/admin/hls/jobs/') && url.endsWith('/cancel')) return json({ ...jobs.items[0], state: 'running' });
    if (url.includes('/admin/hls/jobs') && init?.method === 'POST') return json({ lectureCode: 'HLS01', queued: [{ chapterSeq: 101, rel: 'H/A/01.mp4', jobId: 'a'.repeat(16), created: true, state: 'queued' }], skipped: [] }, 201);
    if (url.includes('/admin/hls/jobs')) return json(jobs);
    return json({ error: { code: 'NOT_FOUND', message: url } }, 404);
  });
}
const mount = (path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}><HlsPage /></MemoryRouter></AdminSessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>);
};

describe('HLS 변환 page', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is in the 모니터링 menu (dept A in the PHP-parity shell) behind grant D2', () => {
    expect(ADMIN_MENU.find((g) => g.key === 'monitoring')?.items.some((i) => i.to === '/admin/hls' && i.grant === 'D2')).toBe(true);
    expect(grantForPath('/admin/hls')).toBe('D2');
    expect(fmtBytes(1536)).toBe('2 KB');
    expect(fmtBytes(800 * 1024 * 1024)).toBe('800.0 MB');
    expect(fmtBytes(3 * 1024 ** 3)).toBe('3.00 GB');
  });

  it('shows lessons with 30-day use, selects idle ones and queues only those', async () => {
    const posted: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', apiMock(posted));
    mount('/admin/hls?code=HLS01');
    expect(await screen.findByText('테스트 과정 · HLS01')).toBeTruthy();
    expect(screen.getAllByText('미사용').length).toBe(3); // chapters 1, 3 and 4 have no learners in 30 days
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('패키지 안에서 MP4를 찾지 못함')).toBeTruthy();
    expect(screen.getByText(/280\.0 MB \(−65%\)/)).toBeTruthy();
    // chapter 3 is converted and chapter 4 has no MP4 → only chapter 1 is idle *and* selectable
    expect((screen.getByLabelText('3차시 선택') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('4차시 선택') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '최근 30일 미사용 차시 선택' }));
    expect((screen.getByLabelText('1차시 선택') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('2차시 선택') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /선택 차시 HLS 변환 \(1\)/ }));
    await waitFor(() => expect(posted.some((p) => p.url.endsWith('/admin/hls/jobs'))).toBe(true));
    expect(posted.find((p) => p.url.endsWith('/admin/hls/jobs'))!.body).toEqual({ lectureCode: 'HLS01', chapterSeqs: [101], include1080: false });
    expect(await screen.findByText('1개 파일을 대기열에 넣었습니다.')).toBeTruthy();
  });

  it('lists jobs with progress and cancels a running one; warns when the worker is down', async () => {
    const posted: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', apiMock(posted));
    mount('/admin/hls');
    expect(await screen.findByText('42% · 2.2×')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    await waitFor(() => expect(posted.some((p) => p.url.endsWith(`/admin/hls/jobs/${'c'.repeat(16)}/cancel`))).toBe(true));

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (String(input).includes('/status') ? json({ ...status, worker: { ...status.worker, alive: false } }) : String(input).includes('/popular') ? json({ ...popular, items: [] }) : json({ items: [], total: 0 }))));
    mount('/admin/hls');
    expect(await screen.findByText(/변환 작업기\(ainex-hls-worker\)가 응답하지 않습니다/)).toBeTruthy();
  });

  it('ranks the most-watched lessons and queues the top 5 that still need converting', async () => {
    const posted: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', apiMock(posted));
    mount('/admin/hls');
    expect(await screen.findByText('인기 1')).toBeTruthy();
    expect(screen.getByText('POP01 외 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '상위 5개 선택' }));
    fireEvent.click(screen.getByRole('button', { name: /선택 차시 HLS 변환 \(5\)/ }));
    await waitFor(() => expect(posted.some((p) => p.url.endsWith('/admin/hls/jobs/contents'))).toBe(true));
    // #2 is already converted, so the top 5 to convert are #1, #3, #4, #5, #6
    expect(posted.find((p) => p.url.endsWith('/admin/hls/jobs/contents'))!.body).toEqual({ contentsIdx: [701, 703, 704, 705, 706], include1080: false });
  });

  it('player: an .m3u8 source goes to hls.js, not to the <video> src; unsupported browsers report an error', async () => {
    const ref = createRef<HTMLVideoElement>();
    const onError = vi.fn();
    const noop = () => undefined;
    render(<VideoStage src="/hls/P/2/v1-0123456789/master.m3u8" videoRef={ref} playing={false} canPlay onPlay={noop} onPause={noop} onTimeUpdate={noop} onLoadedMetadata={noop} onEnded={noop} onError={onError} />);
    expect(ref.current?.getAttribute('src')).toBeNull();
    await waitFor(() => expect(onError).toHaveBeenCalled()); // jsdom has no MediaSource → Hls.isSupported() is false
    render(<VideoStage src="/contents/P/2.mp4" videoRef={createRef<HTMLVideoElement>()} playing={false} canPlay onPlay={noop} onPause={noop} onTimeUpdate={noop} onLoadedMetadata={noop} onEnded={noop} />);
    expect(document.querySelectorAll('video')[1]?.getAttribute('src')).toBe('/contents/P/2.mp4');
  });
});
