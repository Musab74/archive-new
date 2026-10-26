/**
 * Fixes from the 2026-10-26 student-page e2e round (player + assessment area):
 * - learning window: the exit rating after the first save of a never-studied content (stale canRate), the 환급 인정 수강시간 card and the
 *   current 목차 row follow the server acks, server messages keep their line break, the 8-hour refusal shows the PHP sentence;
 * - 사후 form: "이어하기" only for saved 사후 answers (not the 사전 answers of the same enrollment);
 * - a granted 사전/사후 keeps its done screen after the last save consumed the grant (no refetch of the open form → 403 gate);
 * - deleting a 수강후기 does not refetch the deleted row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { PlayerDescriptor } from '../shared/api/schemas';
import { AppError } from '../shared/api/client';
import { SessionContext, type SessionState } from '../shared/auth/useSession';

const openMock = vi.fn();
const tickMock = vi.fn();
const courseMock = vi.fn();
vi.mock('../shared/api/endpoints/player', () => ({
  playerApi: {
    open: (...a: unknown[]) => openMock(...a),
    close: vi.fn(() => Promise.resolve({ released: true })),
    heartbeat: vi.fn(() => Promise.resolve({ ok: true })),
    tick: (...a: unknown[]) => tickMock(...a),
    beaconTick: vi.fn(() => true),
    release: vi.fn(() => true),
    chapters: vi.fn(),
    dailyTime: vi.fn(),
    studyInfo: vi.fn(),
    counsel: vi.fn(),
  },
}));
vi.mock('../shared/api/endpoints/myroom', async (orig) => ({
  ...(await orig<typeof import('../shared/api/endpoints/myroom')>()),
  myRoomApi: { recordChapters: vi.fn(() => Promise.resolve({ studySeq: 7, lectureCode: 'ARC2026', codes: ['B0502'], isPackage: true, chapters: [{ chapterSeq: 505, lectureCode: 'B0502', courseName: '과정', order: 1, contentsIdx: 88, title: '1차시', lectureTimeMin: 30, progress: 0, studyTime: 0, lastStudy: null, lastStudiedAt: null }] })) },
}));
vi.mock('../shared/api/endpoints/catalog', async (orig) => ({
  ...(await orig<typeof import('../shared/api/endpoints/catalog')>()),
  catalogApi: { course: (...a: unknown[]) => courseMock(...a), review: vi.fn(() => Promise.resolve({})) },
}));
vi.mock('../shared/ui/AxisPromo', () => ({ AxisPromo: () => null }));

import PlayerPage from '../features/player/PlayerPage';
import PostAssessmentPage, { postStarted } from '../features/assessment/PostAssessmentPage';
import { MyReviewDetailPage } from '../features/reviews/MyReviewsPage';

const descriptor = (over: Partial<PlayerDescriptor> = {}): PlayerDescriptor => ({
  playToken: 'tok',
  study: { seq: 7, lectureCode: 'ARC2026', serviceType: 'A', mode: 'REFUND', lectureStart: '2026-10-02', lectureEnd: '2026-12-31', passOk: false },
  contentLectureCode: 'B0502',
  chapter: { chapterSeq: 505, number: 1, order: 1, title: '1차시 영상', minutes: 30, contentsIdx: 88, contentsDetailSeq: 880, contentsType: 'B', url: '/contents/B0502/01.mp4', mobileUrl: null, progress: 0, studyTime: 0, lastStudy: null, total: 1, completeTimeSec: 100, urlSelect: 'A', mode: 'S', startLastStudy: '/contents/B0502/01.mp4' },
  chapters: [{ chapterSeq: 505, number: 1, order: 1, title: '1차시 영상', minutes: 30, contentsIdx: 88, contentsDetailSeq: 880, contentsType: 'B', url: '/contents/B0502/01.mp4', mobileUrl: null, progress: 0, studyTime: 0, lastStudy: null, lastStudiedAt: null }],
  resume: { positionSec: 0, studyTimeSec: 0 },
  totals: { recognizedSec: 3600, todaySec: 0, dailyCapSec: 28800, dailyCapClientStopSec: 28800 },
  gates: { identity: 'ok', dailyCapReached: false, dailyCapApplies: true, alreadyDone: false },
  review: { mine: 0 },
  assessment: { postDone: false },
  tick: { intervalMs: 60000, heartbeatMs: 60000, idleTimeoutMs: 7200000 },
  identityUrl: null,
  ...over,
} as PlayerDescriptor);
const course = (canRate: boolean) => ({ lectureCode: 'B0502', title: '과정', ctype: 'X', minutes: 30, canRate, myRating: null, chapters: [], reviews: [] });

function renderPlayer() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/learn/7/505?lectureCode=B0502']}><Routes><Route path="/learn/:studySeq/:chapterSeq" element={<PlayerPage />} /><Route path="*" element={<div>other page</div>} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('learning window (e2e fixes)', () => {
  beforeEach(() => {
    openMock.mockReset(); tickMock.mockReset(); courseMock.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('asks for the exit rating after the first save of a content opened with canRate=false; the cards follow the acks', async () => {
    openMock.mockResolvedValue(descriptor());
    courseMock.mockResolvedValueOnce(course(false)).mockResolvedValue(course(true));
    tickMock.mockResolvedValue({ ChkError: 'N', StudyTime: 60, ChapterProgress: 60, Total_Progress: 7, PassOk: 'N', PositionSec: 0, Chapter_Number: 0, Study_Seq: 7, ProgressCount: '01' });
    renderPlayer();
    fireEvent.click(await screen.findByRole('button', { name: '학습 시작하기' }));
    await waitFor(() => expect(tickMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(courseMock).toHaveBeenCalledTimes(2)); // re-read once the Progress row exists
    // 환급 인정 수강시간 = open-time Σ (3,600) + this chapter's acknowledged gain (60) — not the open-time value
    const card = screen.getByText('환급 인정 수강시간').closest('div')!.parentElement!;
    expect(card.textContent).toContain('1시간 1분');
    const toc = screen.getByRole('region', { name: '학습 목차' });
    expect(within(toc).getByText(/60%/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '학습 종료' })[0]);
    expect(await screen.findByRole('dialog', { name: '평점을 남기고 학습을 마쳐주세요' })).toBeInTheDocument();
  });

  it('re-reads the course only once when canRate stays false (no refetch loop) and then shows the plain exit dialog', async () => {
    openMock.mockResolvedValue(descriptor());
    courseMock.mockResolvedValue(course(false));
    tickMock.mockResolvedValue({ ChkError: 'N', StudyTime: 60, ChapterProgress: 60, Total_Progress: 7, PassOk: 'N', PositionSec: 0, Chapter_Number: 0, Study_Seq: 7, ProgressCount: '01' });
    renderPlayer();
    fireEvent.click(await screen.findByRole('button', { name: '학습 시작하기' }));
    await waitFor(() => expect(courseMock).toHaveBeenCalledTimes(2));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(courseMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getAllByRole('button', { name: '학습 종료' })[0]);
    expect(await screen.findByRole('dialog', { name: '학습을 마치시겠어요?' })).toBeInTheDocument();
  });

  it('keeps the line break of a server message (수강기간이 종료되었습니다.\\n문의 1811-9530)', async () => {
    openMock.mockRejectedValue(new AppError('PERIOD_EXPIRED', '수강기간이 종료되었습니다.\n문의 1811-9530', 403));
    courseMock.mockResolvedValue(course(false));
    const { container } = renderPlayer();
    const block = await waitFor(() => { const el = container.querySelector('[data-state="ENDED"]'); expect(el).not.toBeNull(); return el!; });
    expect(block.textContent).toContain('수강기간이 종료되었습니다.');
    expect(block.textContent).toContain('문의 1811-9530');
    expect(block.querySelector('p br')).not.toBeNull();
  });

  it('the 8-hour refusal carries the PHP sentence (player2.php:874)', async () => {
    openMock.mockResolvedValue(descriptor({ playToken: '', gates: { identity: 'ok', dailyCapReached: true, dailyCapApplies: true, alreadyDone: false } }));
    courseMock.mockResolvedValue(course(true));
    const { container } = renderPlayer();
    await waitFor(() => expect(container.querySelector('[data-state="ACCESS_ERROR"]')?.textContent).toContain('디지털 아카이브 원격훈련 운영 규정 상 하루 최대 8시간까지만 수강이 가능합니다.'));
  });
});

// ---------------------------------------------------------------- assessment (fetch-level)
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const session = { phase: 'authed', user: { id: 'u1', name: '김학습' }, roles: ['learner'], isAuthed: true, login: async () => ({}), logout: async () => {}, refresh: async () => true, patchUser: () => {} } as unknown as SessionState;
let calls: { method: string; path: string; query: string }[] = [];
let routes: Record<string, () => Response> = {};
function mockFetch() {
  calls = [];
  routes = {};
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const [path, query = ''] = url.replace(/^.*\/v1/, '').split('?');
    const method = init?.method ?? 'GET';
    calls.push({ method, path, query });
    const hit = routes[`${method} ${path}`];
    return hit ? hit() : json({ error: { code: 'NOT_FOUND', message: '해당 수강후기 내용이 없습니다.' } }, 404);
  });
}
function renderAt(path: string, element: ReactNode, routePath = path.split('?')[0]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SessionContext.Provider value={session}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}><Routes><Route path={routePath} element={element} /><Route path="*" element={<div>other page</div>} /></Routes></MemoryRouter>
      </QueryClientProvider>
    </SessionContext.Provider>,
  );
}
const q = (idx: number, group: string, order: number, text: string) => ({ idx, group, order, bind: 'A', text, detail: null });
const postForm = (answers: Record<number, number>, o: Record<string, unknown> = {}) => ({
  studySeq: 77, isGrant: false, isRetroClosedW: false, skipsStudyTimeGate: false, period: { start: '2026-10-01', end: '2026-12-31' }, col1: 'W', roleLabel: '실무자',
  common: [q(11, 'C', 1, '의사소통')], leader: [q(13, 'L', 1, '리더십1')], job: [q(14, 'W', 1, '직무1')], satisfaction: [q(9031, 'A', 1, '만족')],
  saved: { answers }, post: { completed: false, total: 0 }, satisfactionStatus: { required: 1, answered: 0, submitted: false, submittedAt: '' }, ...o,
});

describe('사후 form (e2e fixes)', () => {
  beforeEach(() => { localStorage.clear(); mockFetch(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('postStarted counts only this form\'s 사후 questions', () => {
    const f = postForm({ 1: 4, 2: 3, 3: 4, 4: 3 }) as unknown as Parameters<typeof postStarted>[0];
    expect(postStarted(f)).toBe(false); // the 사전 answers of the enrollment (B questions 1–4)
    expect(postStarted({ ...f, saved: { answers: { 1: 4, 9031: 5 } } })).toBe(true);
  });

  it('the intro says 시작하기 / 시작 전 for a learner who only has 사전 answers', async () => {
    routes['GET /assessment/post/form'] = () => json(postForm({ 1: 4, 2: 3, 3: 4, 4: 3 }));
    renderAt('/assessment/post', <PostAssessmentPage />);
    expect(await screen.findByRole('button', { name: '사후역량진단 시작하기' })).toBeInTheDocument();
    expect(screen.getByText('시작 전')).toBeInTheDocument();
  });

  it('a granted 사후 keeps the done screen after the last save consumed the grant (the open form is not refetched)', async () => {
    let formCalls = 0;
    routes['GET /assessment/post/form'] = () => (++formCalls === 1 ? json(postForm({}, { isGrant: true, skipsStudyTimeGate: true, job: [], satisfaction: [] })) : json({ error: { code: 'FORBIDDEN', message: '사후역량진단은 학습 시간이 15시간 이상일 때 진행할 수 있습니다.', details: { reason: 'STUDY_TIME' } } }, 403));
    routes['POST /assessment/post/answers'] = () => json({ studySeq: 77, isGrant: true, isRetroClosedW: false, skipsStudyTimeGate: true, score: { col1: 'W', common: 100, leader: 100, job: 0, total: 100, submitted: true }, passOk: false, satisfactionStatus: { required: 1, answered: 0, submitted: false, submittedAt: '' } });
    renderAt('/assessment/post?studySeq=77&grant=1', <PostAssessmentPage />);
    fireEvent.click(await screen.findByRole('button', { name: '사후역량진단 시작하기' }));
    fireEvent.click(screen.getByLabelText('의사소통 · 5점'));
    fireEvent.click(screen.getByLabelText('리더십1 · 5점'));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(await screen.findByText('선택한 수강 차수의 사후역량진단이 완료되었습니다.')).toBeInTheDocument();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(formCalls).toBe(1);
    expect(screen.getByText('선택한 수강 차수의 사후역량진단이 완료되었습니다.')).toBeInTheDocument();
  });
});

describe('나의 수강후기 delete (e2e fix)', () => {
  beforeEach(() => { mockFetch(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('goes back to the list without re-reading the deleted review', async () => {
    let reads = 0;
    routes['GET /my/reviews/23601'] = () => { reads++; return json({ idx: 23601, lectureCode: 'E2EX01', courseName: '과정', title: '후기', contents: '본문', starPoint: 3, regDate: '2026-10-24 12:00:00', viewCount: 2, visible: true }); };
    routes['DELETE /my/reviews/23601'] = () => json({ ok: true });
    renderAt('/my/reviews/23601', <MyReviewDetailPage />, '/my/reviews/:idx');
    fireEvent.click(await screen.findByRole('button', { name: '삭제' }));
    const dlg = await screen.findByRole('dialog', { name: '현재 수강후기를 삭제하시겠습니까?' });
    fireEvent.click(within(dlg).getByRole('button', { name: '확인' }));
    expect(await screen.findByText('other page')).toBeInTheDocument();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads).toBe(1);
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
  });
});
