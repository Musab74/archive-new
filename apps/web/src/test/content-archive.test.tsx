import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import AbilityQuestionsPage from '../features/admin/pages/content-archive/AbilityQuestionsPage';
import AbilityResultsPage from '../features/admin/pages/content-archive/AbilityResultsPage';
import SatisfactionPage from '../features/admin/pages/content-archive/SatisfactionPage';
import ContentKeywordsPage from '../features/admin/pages/content-archive/ContentKeywordsPage';
import CourseLikesPage from '../features/admin/pages/content-archive/CourseLikesPage';
import CourseViewsPage from '../features/admin/pages/content-archive/CourseViewsPage';
import LiveCoursesPage from '../features/admin/pages/content-archive/LiveCoursesPage';
import LiveClassPage from '../features/admin/pages/content-archive/LiveClassPage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin: AdminSession = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['D', 'E', 'L'], subGrants: ['D3', 'D4', 'D5', 'E1', 'E4', 'E6', 'L1'], canWrite: true } as AdminSession;
const session: AdminSessionState = { phase: 'authed', admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true };

const questions = { items: [{ idx: 11, aType: 'A', typeLabel: '사후', aDepth: 'step02', depthLabel: '2단계', aGroup: 'C', groupLabel: '공통', groupFormLabel: '공통', aOrder: 1, aBind: 'A', bindLabel: '경영의식', aValue: '의사소통', aValueDetail: '상세 설명', regDate: '2026-01-01 00:00:00', modDate: null }, { idx: 20, aType: 'A', typeLabel: '사후 (만족도)', aDepth: 'step01', depthLabel: '1단계', aGroup: 'A', groupLabel: '-', groupFormLabel: '일반', aOrder: 2, aBind: null, bindLabel: '', aValue: '강의 만족도', aValueDetail: null, regDate: '2026-01-02 00:00:00', modDate: null }], page: 1, size: 20, total: 2 };
const questionMeta = { depths: [{ value: 'step01', label: '1단계' }], groups: [{ value: 'A', label: '일반' }], listGroups: [], types: [{ value: 'A', label: '사후' }, { value: 'B', label: '사전' }], binds: [{ value: 'A', label: '경영의식' }], values: [] };
const abilityPage = { items: [{ idx: 1, id: 'user01', name: '학습자일', studySeq: 5, studyTimeSec: 3700, studyTimeLabel: '01시간 01분', aDepth: 'step02', depthLabel: '2단계', aGroup: 'C', groupLabel: '공통', aType: 'A', prepost: '사후', aBind: 'A', bindLabel: '경영의식', questionIdx: 11, question: '의사소통', aOrder: 1, aValue: '4', selected: '★ ★ ★ ★', regDate: '2026-10-12 10:00:00' }], page: 1, size: 20, total: 1, range: { start: '2026-09-12', end: '2026-10-12', capped: true, maxDays: 30 } };
const satisfactionPage = { items: [{ idx: 9, id: 'user01', name: '학습자일', aOrder: 2, question: '강의 만족도', aValue: '5', score: 5, stars: '★ ★ ★ ★ ★', regDate: '2026-10-12 10:00:00' }], page: 1, size: 20, total: 1, range: { start: '2026-10-12', end: '2026-10-12', capped: false, maxDays: 30 } };
const kwCategories = { items: [{ category: '1', label: '직급', count: 3, activeCount: 3 }, { category: '2', label: '직무분야', count: 5, activeCount: 4 }, { category: '3', label: '관심분야', count: 0, activeCount: 0 }, { category: '4', label: '역량', count: 0, activeCount: 0 }] };
const kwList = { category: '2', label: '직무분야', items: [{ idx: 3, category: '2', categoryLabel: '직무분야', keyword: '인사', useYN: 'Y', useLabel: '사용', order: 1, jobCate: null, regDate: '2026-01-01 00:00:00', regId: 'admin01', mdfDate: null, mdfId: null }, { idx: 4, category: '2', categoryLabel: '직무분야', keyword: '회계', useYN: 'N', useLabel: '미사용', order: 2, jobCate: null, regDate: '2026-01-02 00:00:00', regId: 'admin01', mdfDate: '2026-01-03 00:00:00', mdfId: 'admin01' }] };
const likes = { items: [{ idx: 1, id: 'user01', name: '학습자일', category1: '경영', category2: '리더십', category: '경영 > 리더십', lectureCode: 'D00001', courseName: '리더십 입문', regDate: '2026-10-01 09:00:00' }], page: 1, size: 20, total: 1 };
const views = { items: [{ idx: 3, lectureCode: 'D00002', category1: '경영', category2: null, category: '경영 > ', keyword2: '12', keyword2Name: '인사', courseName: 'NCS 기반 스피치 스킬', count: 7, ctype: 'Y', useYN: 'Y', del: 'N' }], page: 1, size: 20, total: 1 };
const viewOptions = { category1: [{ idx: 1, name: '경영' }], category2: [{ idx: 2, parent: 1, name: '리더십' }], keyword2: [{ idx: 12, name: '인사' }] };
const liveCourses = { items: [{ idx: 5, lectureCode: 'LIVE01', classGrade: 'A', classGradeLabel: 'A등급', courseName: '라이브 특강', category: '경영 > 리더십', chapter: '0', chapterLabel: '없음', contentsTime: '60', packageLectureCode: null, hrdSeq: null, contentsStart: '2026-01-01', uploadDate: '2026-01-02', mobile: 'Y', mobileLabel: '사용', useYN: 'N', useLabel: '미사용', professor: null, regDate: '2026-01-01 00:00:00' }], page: 1, size: 30, total: 1 };

const calls: string[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/^.*\/v1/, '')}`);
    if (url.endsWith('/admin/archive-questions/meta')) return json(questionMeta);
    if (url.includes('/admin/archive-questions/11')) return method === 'GET' ? json({ question: questions.items[0], answers: 3 }) : json({ ok: true, updated: 1, fields: [] });
    if (url.includes('/admin/archive-questions')) return json(questions);
    if (url.includes('/admin/ability-results')) return json(abilityPage);
    if (url.includes('/admin/satisfaction-results')) return json(satisfactionPage);
    if (url.endsWith('/admin/content-keywords/categories')) return json(kwCategories);
    if (url.endsWith('/admin/content-keywords/order')) return json({ ok: true, updated: 2, category: '2' });
    if (url.includes('/admin/content-keywords?category=2')) return json(kwList);
    if (url.includes('/admin/content-keywords')) return json({ ok: true, idx: 101, category: '2' });
    if (url.includes('/admin/course-likes')) return json(likes);
    if (url.endsWith('/admin/course-views/options')) return json(viewOptions);
    if (url.includes('/admin/course-views')) return json(views);
    if (url.includes('/admin/live-courses')) return json(liveCourses);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

const mount = (el: ReactElement, path = '/x') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};

describe('컨텐츠관리 · 아카이브 pages', () => {
  beforeEach(() => { calls.length = 0; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); vi.spyOn(window, 'confirm').mockReturnValue(true); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); adminTokenStore.clear(); });

  it('역량진단 문항관리: legacy columns, 사후 (만족도) label, detail drawer with answers and edit form', async () => {
    mount(<AbilityQuestionsPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '역량진단 문항관리' })).toBeInTheDocument();
    expect(await screen.findByText('의사소통')).toBeInTheDocument();
    for (const h of ['번호', '역량타입', '단계', '타입', '순서', '문항', '상세', '등록일']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('사후 (만족도)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신규 등록' })).toBeEnabled();
    fireEvent.click(screen.getByText('의사소통'));
    expect(await screen.findByText('진단 결과 수')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    expect(await screen.findByRole('heading', { name: '역량진단 문항관리 수정' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^문항(?! 상세)/ })).toHaveValue('의사소통');
    expect(screen.getByRole('spinbutton', { name: /^순서/ })).toHaveValue(1);
    expect(calls.some((c) => c.startsWith('GET /admin/archive-questions/11'))).toBe(true);
    expect(calls.find((c) => c.startsWith('GET /admin/archive-questions?'))).toContain('size=30'); // $page_size = 30
    // 다시 작성 restores the stored values; 저장 asks "수정 하시겠습니까?" first
    fireEvent.change(screen.getByRole('textbox', { name: /^문항(?! 상세)/ }), { target: { value: '바뀐 문항' } });
    fireEvent.click(screen.getByRole('button', { name: '다시 작성' }));
    expect(screen.getByRole('textbox', { name: /^문항(?! 상세)/ })).toHaveValue('의사소통');
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(window.confirm).toHaveBeenCalledWith('수정 하시겠습니까?');
    expect(calls.some((c) => c.startsWith('PATCH '))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(calls).toContain('PATCH /admin/archive-questions/11'));
  });

  it('역량진단관리: date filters, 11 legacy columns, study time and the 30-day cap notice; export button calls the CSV endpoint', async () => {
    mount(<AbilityResultsPage />, '/x?from=2026-01-01&to=2026-10-12');
    expect(await screen.findByRole('heading', { level: 1, name: '역량진단관리' })).toBeInTheDocument();
    expect(await screen.findByText('user01')).toBeInTheDocument();
    for (const h of ['번호', '아이디', '이름', '단계', '타입', '사전/사후', '학습시간', '역량', '문항', '선택값', '등록일']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('01시간 01분')).toBeInTheDocument();
    expect(screen.getByText('★ ★ ★ ★')).toBeInTheDocument();
    expect(screen.getByText(/시작일이 2026-09-12로 자동 조정/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('등록일 시작')).toHaveValue('2026-09-12')); // the capped start, as the PHP input shows it
    const list = calls.find((c) => c.startsWith('GET /admin/ability-results?'))!;
    expect(list).toContain('size=30');
    expect(list).toContain('from=2026-01-01'); expect(list).toContain('to=2026-10-12');
    fireEvent.click(screen.getByRole('button', { name: /검색항목 엑셀/ }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/ability-results/export'))).toBe(true));
  });

  it('만족도조사: stars column and range summary', async () => {
    mount(<SatisfactionPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '만족도조사' })).toBeInTheDocument();
    expect(await screen.findByText('★ ★ ★ ★ ★')).toBeInTheDocument();
    for (const h of ['번호', '아이디', '이름', '순서', '문항', '만족도', '등록일']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText(/1건 \(2026-10-12 ~ 2026-10-12\)/)).toBeInTheDocument();
    // the date inputs show the resolved range (today by default), like value="<?=$RegDateStart?>"
    await waitFor(() => expect(screen.getByLabelText('등록일 시작')).toHaveValue('2026-10-12'));
    expect(screen.getByLabelText('등록일 종료')).toHaveValue('2026-10-12');
    expect(calls.find((c) => c.startsWith('GET /admin/satisfaction-results?'))).toContain('size=30');
  });

  it('만족도조사: 초기화 after the default (today) search puts today back into the date inputs, like satisfaction_manager.php', async () => {
    mount(<SatisfactionPage />);
    await waitFor(() => expect(screen.getByLabelText('등록일 시작')).toHaveValue('2026-10-12'));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    // the form is cleared and the query (and its resolved range) stays the same — the inputs must still show the range
    await waitFor(() => expect(screen.getByLabelText('등록일 시작')).toHaveValue('2026-10-12'));
    expect(screen.getByLabelText('등록일 종료')).toHaveValue('2026-10-12');
  });

  it('역량진단관리: 초기화 after a capped search shows the resolved (capped) range of the default search', async () => {
    mount(<AbilityResultsPage />, '/x?from=2026-01-01&to=2026-10-12');
    await waitFor(() => expect(screen.getByLabelText('등록일 시작')).toHaveValue('2026-09-12'));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    await waitFor(() => expect(screen.getByLabelText('등록일 시작')).toHaveValue('2026-09-12'));
    expect(screen.getByLabelText('등록일 종료')).toHaveValue('2026-10-12');
  });

  it('컨텐츠 키워드 관리: categories → keyword list, move + 정렬하기 sends the new order, 추가 하기 posts to the API', async () => {
    mount(<ContentKeywordsPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '컨텐츠 키워드 관리' })).toBeInTheDocument();
    expect(await screen.findByText('직무분야')).toBeInTheDocument();
    fireEvent.click(screen.getByText('직무분야'));
    expect(await screen.findByText('인사')).toBeInTheDocument();
    const kwTable = within(screen.getAllByRole('table')[1]!);
    for (const h of ['번호', '정렬순서', '키워드', '사이트노출', '등록일자', '수정일자', 'idx']) expect(kwTable.getByRole('columnheader', { name: h })).toBeInTheDocument();
    const save = screen.getByRole('button', { name: '정렬하기' });
    expect(save).toBeEnabled(); // like the PHP: 정렬하기 numbers every row 1..n even without moving one
    fireEvent.click(screen.getAllByRole('button', { name: '아래로' })[0]!);
    fireEvent.click(save);
    expect(window.confirm).toHaveBeenCalledWith('정렬하시겠습니까?');
    await waitFor(() => expect(calls).toContain('PUT /admin/content-keywords/order'));
    fireEvent.click(screen.getByRole('button', { name: '추가 하기' }));
    const drawer = await screen.findByRole('heading', { name: '컨텐츠 키워드 등록' });
    expect(drawer).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /^키워드/ }), { target: { value: '마케팅' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(window.confirm).toHaveBeenCalledWith('등록하시겠습니까?');
    await waitFor(() => expect(calls).toContain('POST /admin/content-keywords'));
  });

  it('컨텐츠 키워드 관리: 키워드개수 is COUNT(Category) with deleted rows, like contents_keyword.php', async () => {
    mount(<ContentKeywordsPage />);
    const row = (await screen.findByText('직무분야')).closest('tr')!;
    expect(within(row).getByText('5')).toBeInTheDocument();
    expect(within(row).getByText('5')).toHaveAttribute('title', expect.stringContaining('4'));
  });

  it('관심강의 관리 / 과정조회 관리: legacy columns and category trail', async () => {
    const a = mount(<CourseLikesPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '관심강의 관리' })).toBeInTheDocument();
    expect(await screen.findByText('리더십 입문')).toBeInTheDocument();
    expect(screen.getByText('경영 > 리더십')).toBeInTheDocument();
    for (const h of ['번호', '아이디', '이름', '과정분류', '과정명']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    a.unmount();
    mount(<CourseViewsPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '과정조회 관리' })).toBeInTheDocument();
    expect(await screen.findByText('NCS 기반 스피치 스킬')).toBeInTheDocument();
    for (const h of ['번호', '과정분류', '직무분야', '과정명', '조회수']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('7')).toBeInTheDocument();
    expect(within(table).getByText('인사')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /admin/course-views/options'))).toBe(true);
    expect(calls.find((c) => c.startsWith('GET /admin/course-views?'))).toContain('size=30');
    expect(calls.find((c) => c.startsWith('GET /admin/course-likes?'))).toContain('size=30');
  });

  it('실시간 강의실 관리 lists ctype=R courses and points to the legacy page for the MongoDB meeting list', async () => {
    mount(<LiveCoursesPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '라이브 컨텐츠 관리' })).toBeInTheDocument();
    expect(await screen.findByText('라이브 특강')).toBeInTheDocument();
    expect(screen.getByText('LIVE01')).toBeInTheDocument();
    expect(screen.getByText('없음')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /실시간 강의실\(미팅\) 목록 열기/ })).toHaveAttribute('href', expect.stringContaining('course.php?ctype=R'));
    expect(calls.find((c) => c.startsWith('GET /admin/live-courses'))).toContain('size=30');
  });

  it('실시간 강의 관리 (L1) explains the MongoDB dependency and links to the live platform and the legacy page', async () => {
    mount(<LiveClassPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '실시간 강의 관리' })).toBeInTheDocument();
    expect(screen.getByText(/HrdeLive/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /실시간 강의 생성/ })).toBeInTheDocument();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    fireEvent.click(screen.getByRole('button', { name: /예정 강의 등록/ }));
    expect(open).toHaveBeenCalledWith('https://live.hrdeedu.co.kr/instructor', '_blank', 'noopener');
    expect(screen.getByRole('link', { name: /hrd_manager\/live_class\.php/ })).toHaveAttribute('href', expect.stringContaining('live_class.php'));
    expect(calls).toHaveLength(0);
  });
});
