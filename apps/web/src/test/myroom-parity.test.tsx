import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { LearnerSession } from '@ainex/contracts';
import { SessionContext, type SessionState } from '../shared/auth/useSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { tokenStore } from '../shared/auth/tokenStore';
import MyRecords from '../features/my/MyRecords';
import MySaved from '../features/my/MySaved';
import MyCompanyTraining from '../features/my/MyCompanyTraining';
import MyRanking from '../features/my/MyRanking';
import MyCertificates from '../features/my/MyCertificates';
import { resumeLink, usageOf } from '../features/my/queries';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const user = { id: 'user01', name: '학습자일', eduManager: false } as unknown as LearnerSession;
const session: SessionState = { phase: 'authed', user, roles: [], isAuthed: true, login: async () => ({}) as never, logout: async () => undefined, refresh: async () => true, patchUser: () => undefined };

const row = (o: Record<string, unknown>) => ({ lectureCode: 'D00001', studySeq: 5, studyLectureCode: 'ARC2026', name: '리더십, 어려운 게 아니야!', serviceType: 'X', serviceTypeName: '이러닝', ctype: 'X', chapter: 2, contentsTime: '60분', seconds: 57000, minutes: 950, formatted: '15시간 50분', progress: 100, calculatedProgress: 100, passOk: false, completed: true, status: 'completed', statusText: '이수완료', lastStudiedAt: '2026-10-25 10:00:00', lastStudyDate: '2026-10-25', period: { start: '2026-09-26', end: '2026-12-25' }, enrollmentServiceType: 'A', resumeChapterSeq: 1002, rating: null, certificate: { eligible: true }, ...o });
const courses = { items: [row({}), row({ lectureCode: 'D00002', name: 'NCS 기반 스피치 스킬', progress: 40, calculatedProgress: 40, completed: false, statusText: '진행중', status: 'progress', certificate: { eligible: false }, rating: 4, lastStudyDate: '2026-10-20' })], page: 1, size: 10, total: 2, summary: { totalCourses: 2, completed: 1, inProgress: 1, totalMinutes: 950, formatted: '15시간 50분' } };
const saved = [
  { likeIdx: 11, lectureCode: 'D00001', savedAt: '2026-10-24 10:00:00', name: '리더십', ctype: 'X', image: null, contentsTime: '60', category1: '공통역량', category2: null, professor: null, visible: true, viewCount: 1240, rating: 4.7, ratingCount: 3, learning: 'LEARNING' },
  { likeIdx: 12, lectureCode: 'D00009', savedAt: '2026-10-23 10:00:00', name: '숨김 과정', ctype: 'Y', image: null, contentsTime: '30', category1: null, category2: null, professor: null, visible: false, viewCount: 0, rating: null, ratingCount: 0, learning: null },
];
const archiving = { items: [{ idx: 7, title: '우리 회사 업무 안내', regDate: '2026-10-20 09:10', fileType: 'PDF', status: 'A', statusText: '대기' }], uploadReady: true, writesOpen: true };
const archivingDetail = { idx: 7, title: '우리 회사 업무 안내', content: '본문', regDate: '2026-10-20 09:10', status: 'B', statusText: '완료', fileName: '안내.pdf', hasFile: true, canDownload: true, answerName: '관리자', answerContent: '<p>등록했습니다</p>', answerDate: '2026-10-21 10:00', hasAnswer: true };
const level = { level: 2, levelName: '도전자', totalXP: 637, currentLevelMin: 300, currentLevelMax: 699, nextLevelXP: 700, xpToNextLevel: 63, progressPercent: 84.5, isMaxLevel: false, currentStreak: 7, longestStreak: 7, totalStudyMinutes: 427, completedCourses: 3, guide: { rules: [{ xp: '+1 XP', text: '학습 1분당' }], dailyCap: '일일 XP 최대 200 XP (스트릭 보너스 제외)', bands: [{ level: 1, name: '탐험가', range: '0~299' }] } };
const insight = { nextGoal: '5개 과정 수료를 목표로 해 보세요.', performanceComment: '3개 과정을 수료하셨습니다.', stats: { totalMinutes: 1031, totalHours: 17.2, completedCourses: 3, studyDays: 9 }, source: 'rule' };
const events = { title: 'HRDe Archive 매일매일 출석체크 이벤트', rules: ['1일 1시간 이상을 수강한 수강생 여러분께 출석 도장이 발행됩니다.'], stages: [10, 20, 30, 40].map((stage, i) => ({ stage, label: `${stage} Days`, count: i === 0 ? 3 : 0, stamps: Array.from({ length: 10 }, (_, k) => i === 0 && k < 3) })) };
const badges = { summary: { total: 0, achieved: 0, remaining: 0 }, categories: [], badgesByCategory: {}, badges: [] };
const ranking = { scope: 'all', scopeLabel: '전체', rank: 12, companyRank: 1, companyName: '테스트', companyTotal: 1, score: 10, totalUsers: 20, my: { rank: 12, id: 'user01', isMe: true, score: 10, studyMinutes: 25, completedCourses: 0, avgProgress: 19.9 },
  top10: [{ rank: 1, id: 'abc***', isMe: false, score: 99, studyMinutes: 200, completedCourses: 2, avgProgress: 88.8 }], aroundMe: [{ rank: 11, id: 'zzz***', isMe: false, score: 11, studyMinutes: 30, completedCourses: 0, avgProgress: 1 }, { rank: 12, id: 'user01', isMe: true, score: 10, studyMinutes: 25, completedCourses: 0, avgProgress: 19.9 }], formula: 'score' };
const certificates = [
  { studySeq: 3, lectureCode: 'D00002', courseName: 'NCS', serviceType: 'A', period: { start: '2026-08-01', end: '2026-10-24', label: '2026-08-01 ~ 2026-10-24' }, studyEnd: true, closedAt: null, printable: false, waiting: true, availableFrom: '2026-10-31', issuedAt: '2026-10-31' },
  { studySeq: 4, lectureCode: 'D00002', courseName: 'NCS', serviceType: 'W', period: { start: '2024-01-01', end: '2024-03-31', label: '2024-01-01 ~ 2024-03-31' }, studyEnd: true, closedAt: null, printable: true, waiting: false, availableFrom: null, issuedAt: '2026-10-26' },
];

const calls: { m: string; url: string; body?: unknown }[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, ''); const method = init?.method ?? 'GET';
    let body: unknown; try { body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body; } catch { body = init?.body; }
    calls.push({ m: method, url, body });
    if (url.startsWith('/my/courses')) return json(courses);
    if (url.startsWith('/my/saved/remove')) return json({ ok: true, removed: 1 });
    if (url.startsWith('/my/saved')) return json(saved);
    if (url.startsWith('/my/archiving/7')) return json(archivingDetail);
    if (url.startsWith('/my/archiving')) return method === 'POST' ? json({ ok: true, idx: 8, message: '등록되었습니다.' }) : json(archiving);
    if (url.startsWith('/my/level')) return json(level);
    if (url.startsWith('/my/insight')) return json(insight);
    if (url.startsWith('/my/events')) return json(events);
    if (url.startsWith('/my/badges')) return json(badges);
    if (url.startsWith('/my/ranking')) return json(ranking);
    if (url.startsWith('/my/certificates')) return json(certificates);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (el: ReactElement, path = '/my') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{el}</MemoryRouter></SessionContext.Provider></ToastProvider></QueryClientProvider>);
};

describe('my-room helpers', () => {
  it('usageOf follows /my/status usageState for a fallback row (ENDED/BEFORE), resumeLink uses the saved chapter', () => {
    expect(usageOf({ studySeq: 3, serviceType: 'A', serviceTypeLabel: '환급', usageState: 'ENDED' } as never, [])).toMatchObject({ state: 'ENDED', mode: 'refund' });
    expect(usageOf({ studySeq: 3, serviceType: 'A', serviceTypeLabel: '환급', usageState: 'ACTIVE' } as never, [])).toMatchObject({ state: 'ACTIVE' });
    expect(resumeLink({ studySeq: 5, lectureCode: 'D00001', resumeChapterSeq: 1002 })).toBe('/learn/5/1002?lectureCode=D00001');
    expect(resumeLink({ studySeq: 5, lectureCode: 'D00001', resumeChapterSeq: null })).toBe('/courses/D00001');
  });
});

describe('my-room parity pages', () => {
  beforeEach(() => { calls.length = 0; tokenStore.set('tok', 900); vi.stubGlobal('fetch', apiMock()); });
  afterEach(() => { vi.unstubAllGlobals(); tokenStore.clear(); });

  it('학습기록 (tab-history.php): summary, 10 per page, status/year/sort filters to the API, 이수증 only for 이수완료 rows', async () => {
    mount(<MyRecords />, '/my/records');
    expect(await screen.findByText('리더십, 어려운 게 아니야!')).toBeInTheDocument();
    expect(screen.getByText('학습 이력 요약')).toBeInTheDocument();
    expect(screen.getAllByText('15시간 50분').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '이수증 출력' })).toHaveLength(1);
    expect(screen.getByText('★ 4점')).toBeInTheDocument();
    expect(screen.getByText('평점 남기기')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '복습하기' })).toHaveAttribute('href', '/learn/5/1002?lectureCode=D00001');
    expect(calls.find((c) => c.url.startsWith('/my/courses'))!.url).toContain('size=10');
    fireEvent.click(within(screen.getByRole('group', { name: '학습 상태 필터' })).getByRole('button', { name: '이수완료' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('status=completed'))).toBe(true));
  });

  it('찜한 콘텐츠: protected card text, rating/views, 선택 해제 posts the CourseLike idx list', async () => {
    mount(<MySaved />, '/my/saved');
    expect(await screen.findByText('평점 ★ 4.7 · 조회 1,240', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('제목·썸네일·상세정보는 현재 열람권한에 따라 보호됩니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /리더십/ }));
    fireEvent.click(screen.getByRole('button', { name: '선택 해제 (1)' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '찜 해제' }));
    await waitFor(() => expect(calls.find((c) => c.url === '/my/saved/remove')?.body).toEqual({ likeIdx: [11] }));
  });

  it('기업자체교육(아카이빙): own list, detail with the admin answer, register validates like the PHP form', async () => {
    mount(<MyCompanyTraining />, '/my/company-training');
    expect(await screen.findByText('우리 회사 업무 안내')).toBeInTheDocument();
    expect(screen.getByText('대기')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '우리 회사 업무 안내' }));
    expect(await screen.findByText('등록했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /파일 다운로드/ })).toBeInTheDocument();
    const detailDialog = screen.getByRole('dialog', { name: '등록 콘텐츠' });
    fireEvent.click(within(detailDialog).getAllByRole('button', { name: '닫기' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: '콘텐츠 등록요청' }));
    fireEvent.click(await screen.findByRole('button', { name: '등록하기' }));
    expect(await screen.findByText('제목을 입력하세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: '신규 자료' } });
    fireEvent.change(screen.getByLabelText(/내용/), { target: { value: '설명' } });
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    expect(await screen.findByText('파일을 등록해주세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/파일업로드/), { target: { files: [new File(['x'], 'a.exe')] } });
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('mp4, vod, pdf, doc, docx, xls, xlsx, hwp 파일만 업로드 가능합니다.');
    fireEvent.change(screen.getByLabelText(/파일업로드/), { target: { files: [new File(['%PDF'], '안내.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    const confirm = await screen.findByRole('dialog', { name: '등록하시겠습니까?' });
    fireEvent.click(within(confirm).getByRole('button', { name: '등록하기' }));
    await waitFor(() => expect(calls.some((c) => c.m === 'POST' && c.url === '/my/archiving' && c.body instanceof FormData)).toBe(true));
  });

  it('랭킹·뱃지: level card + XP guide, AI 성장 인사이트, ranks from the API, 출석 체크 stamps', async () => {
    mount(<MyRanking />, '/my/ranking');
    expect(await screen.findByText('Lv.2 도전자')).toBeInTheDocument();
    expect(screen.getByText('총 XP 637 XP · 다음 레벨까지 63 XP')).toBeInTheDocument();
    expect(await screen.findByText('5개 과정 수료를 목표로 해 보세요.')).toBeInTheDocument();
    expect(await screen.findByText('abc***')).toBeInTheDocument();
    expect(within(screen.getByText('zzz***').closest('tr')!).getAllByRole('cell')[0]).toHaveTextContent('11'); // around-me shows the real position, not 1..7
    expect(await screen.findByText('3/10')).toBeInTheDocument();
  });

  it('수료증 list: refund rows wait until LectureEnd + 7 days, others print', async () => {
    mount(<MyCertificates />, '/my/certificates');
    expect(await screen.findByText('2026-10-31부터 출력')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '수료증 PDF 출력' })).toHaveLength(1);
  });
});
