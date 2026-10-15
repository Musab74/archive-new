import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { ToastProvider } from '../app/providers/ToastProvider';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import StudiesPage from '../features/admin/pages/studies/StudiesPage';
import StudyCertificatePrintPage from '../features/admin/pages/studies/StudyCertificatePrintPage';
import { MonitoringDailyPage } from '../features/admin/pages/studies/MonitoringPages';
import { highlightMatch } from '../features/admin/pages/studies/studies-pickers';
import { progressLogEstimate } from '../features/admin/pages/studies/studies-shared';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B'], subGrants: ['B1', 'B3', 'B5'], canWrite: true } as unknown as AdminSessionState['admin'];
const session: AdminSessionState = { phase: 'authed' as AdminSessionState['phase'], admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin!, logout: async () => {}, extend: async () => true };

const options = { years: [2025, 2026], thisYear: 2026, packageCourses: [{ lectureCode: 'ARC2026', name: '아카이브 2026' }, { lectureCode: 'XYZ01', name: '리더십 패키지' }], tutors: [], salesStaff: [], periods: [], pageSizes: [10, 30, 50, 70, 100, 120, 150, 200], canWrite: true, showTutorFilter: false, canChangeServiceType: false };
const pre = { label: 'Y', submitted: true, date: '2026-03-03 09:04', showResume: false, open: null, grantExpiresAt: null };
const post = { yn: 'N', date: null, open: null, openReason: null, grantExpiresAt: null };
const row = { studySeq: 7, id: 'user01', name: '홍길동', depart: '총무팀', serviceType: 'A', serviceTypeLabel: '패키지(환급)', lectureCode: 'ARC2026', courseName: '아카이브 2026', lectureStart: '2026-03-02', lectureEnd: '2026-05-31', termeIdx: 3, seconds: 55000, studyTimeLabel: '15시간 16분', percent: 100, storedProgress: 100, passOk: 'Y', passOkLabel: '수료', certificateLink: true, studyEnd: 'N', tutorName: '강사', salesName: '영업', salesTeam: '1팀', companyCode: '1234567890', companyName: '테스트기업', companyIdx: 55, certDate: null, openChapter: 1, inputDate: '2026-02-20 10:00:00', pre, post };
const aiDetail = {
  user: { id: 'user01', name: '홍길동', companyName: '테스트기업', depart: '총무팀', position: '대리', regDate: '2025-01-01 10:00:00', email: '*******@test.com', mobile: '010-****-5678' },
  summary: { totalCourses: 2, avgProgress: 55.6, completedCount: 1, totalStudyCount: 2, totalStudyTime: 7320, studyTimeLabel: '2시간 2분', completionRate: 50, state: '진행중', stateTone: 'warn' },
  assessment: { userGroup: 'M', userGroupLabel: '관리자', diagnosisDate: '2026-03-03 09:00', averages: { common: 70, leadership: 52.3, job: null }, weakAreas: ['의사소통'] },
  roadmap: { steps: [{ step: 1, title: 'Step 1: 기초 과정', reason: '기초를 탄탄히 쌓아가는 과정', showReasons: false, items: [{ code: 'D1', name: '리더십 기초', time: 60, chapter: 5, category: '리더십', recommendReason: '현재 수강 중인 과정' }] }, { step: 2, title: 'Step 2: 심화 과정', reason: 'r2', showReasons: true, items: [{ code: 'D2', name: '소통 심화', time: 30, chapter: 3, category: '공통', recommendReason: '인기 과정' }] }, { step: 3, title: 'Step 3: 고급 과정', reason: 'r3', showReasons: true, items: [] }], recommendedCount: 2, preferredCategories: '리더십', availableCount: 2 },
  courses: [{ no: 1, studySeq: 7, lectureCode: 'ARC2026', courseName: '아카이브 2026', lectureStart: '2026-03-02', lectureEnd: '2026-05-31', progress: 45, seconds: 3700, studyTimeLabel: '1시간 1분', status: '진행중', studyState: '학습중', progressTone: 'danger' }],
  pattern: [{ date: '2026-10-01', label: '10/01', minutes: 1.5 }],
};
const sheet = { kind: 'completion', title: '수료증', siteName: '아이넥스평생교육원', issueDate: '2026-10-15', issueDateLabel: '2026 년  10월  15일', body: ['위 사람은'], items: [{ id: 'user01', studySeq: 7, name: '홍길동', birthDay: '1990-01-01', companyName: '테스트기업', courseName: '아카이브 2026', lectureCode: 'ARC2026', contentsTime: null, lectureStart: '2026-03-02', lectureEnd: '2026-05-31', periodLabel: '2026년 03월 02일 ~ 2026년 05월 31일', seconds: 55000, hours: 15 }] };
const daily = { items: [], page: 1, size: 30, total: 0, period: { start: '2026-03-03', end: '2026-03-03', label: '2026-03-03' }, order: 'date_asc', stats: { total: 0, ge8: 0, cap: 0, over: 0 }, summaryLabel: '행수 0', pagePeople: { people: 0, ok15: 0 }, rule: '규칙' };

function apiMock(calls: string[], over: (url: string, method: string) => Response | null = () => null) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/^.*\/v1/, '')}${init?.body ? ` ${String(init.body)}` : ''}`);
    const o = over(url, method); if (o) return o;
    if (url.includes('/admin/studies/manage/options')) return json(options);
    if (url.includes('/admin/studies/manage/period-companies')) return json({ lectureStart: '2026-03-02', lectureEnd: '2026-05-31', items: [{ companyCode: '1234567890', companyName: '테스트기업', label: '테스트기업 | 1234567890' }] });
    if (url.includes('/admin/studies/manage')) return json({ items: [row], page: 1, size: 30, total: 1, canWrite: true });
    if (url.includes('/admin/learning/terms')) return json({ year: 2026, month: null, companyCode: null, items: [{ start: '2026-03-02', end: '2026-05-31', label: '2026-03-02~2026-05-31' }] });
    if (url.includes('/admin/studies/ai-detail/user01')) return json(aiDetail);
    if (url.includes('/admin/studies/7/certificate/print')) return json(sheet);
    if (url.includes('/admin/studies/7/certificate')) return json({ studySeq: 7, id: 'user01', name: '홍길동', birthDay: '1990-01-01', companyName: '테스트기업', companyCode: '1234567890', courseName: '아카이브 2026', lectureStart: '2026-03-02', lectureEnd: '2026-05-31', periodLabel: 'p' });
    if (url.includes('/admin/studies/progress-log/export') || url.includes('/admin/studies/progress-log/excel')) return json({ error: { code: 'VALIDATION', message: '검색된 학습현황이 없습니다.' } }, 400);
    if (url.includes('/admin/studies/companies')) return json({ items: [{ companyCode: '1234567890', companyName: '주식회사 테스트기업' }], truncated: true, cap: 1000 });
    if (url.includes('/admin/studies/daily-time/excel')) return new Response('PK', { status: 200, headers: { 'Content-Disposition': "attachment; filename=\"study_time.xlsx\"; filename*=UTF-8''x.xlsx" } });
    if (url.includes('/admin/studies/daily-time')) return json(daily);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

function mount(ui: ReactNode, path: string, route = '*') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><AdminSessionContext.Provider value={session}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={ui} /></Routes></MemoryRouter>
    </AdminSessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>,
  );
}
/** Radix select opens from the keyboard in jsdom (no PointerEvent). */
const openSelect = (el: HTMLElement) => { el.focus(); fireEvent.keyDown(el, { key: 'ArrowDown' }); };
const manageCalls = (calls: string[]) => calls.filter((c) => c.startsWith('GET /admin/studies/manage?'));

describe('학습관리 / 일자별 학습시간 — PHP parity gaps', () => {
  let calls: string[];
  beforeEach(() => { calls = []; adminTokenStore.clear(); vi.stubGlobal('fetch', apiMock(calls)); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('pure helpers: autocomplete highlight and the 진도로그 time hint', () => {
    const { container } = render(<span>{highlightMatch('주식회사 테스트기업', '테스트')}</span>);
    expect(container.querySelector('b')).toHaveTextContent('테스트');
    expect(container.querySelector('b')).toHaveStyle({ color: '#db2400' });
    expect(progressLogEstimate(30)).toBe('2~3분 정도 걸릴 수 있습니다.');
  });

  it('사업주 검색 without a company name → "사업주명을 입력하세요." and no search', async () => {
    mount(<StudiesPage />, '/admin/studies?searchGubun=B');
    await screen.findByRole('heading', { level: 1, name: '학습관리' });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(await screen.findByText('사업주명을 입력하세요.')).toBeInTheDocument();
    expect(manageCalls(calls)).toHaveLength(0);
  });

  it('기간 검색: picking a 수강 기간 searches at once and loads that period’s 사업주 select; picking a company searches again', async () => {
    mount(<StudiesPage />, '/admin/studies');
    expect(await screen.findByText('기간을 선택하세요.')).toBeInTheDocument();
    const period = await screen.findByRole('combobox', { name: '수강 기간' });
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/learning/terms'))).toBe(true));
    openSelect(period);
    fireEvent.click(await screen.findByRole('option', { name: '2026-03-02~2026-05-31' }));
    await waitFor(() => expect(manageCalls(calls).some((c) => c.includes('lectureStart=2026-03-02') && c.includes('lectureEnd=2026-05-31'))).toBe(true));
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/studies/manage/period-companies?lectureStart=2026-03-02&lectureEnd=2026-05-31'))).toBe(true));
    const co = await screen.findByRole('combobox', { name: '사업주' });
    openSelect(co);
    fireEvent.click(await screen.findByRole('option', { name: '테스트기업 | 1234567890' }));
    await waitFor(() => expect(manageCalls(calls).some((c) => c.includes('companyCode=1234567890') && c.includes('lectureStart=2026-03-02'))).toBe(true));
  });

  it('페이징 설정 offers 120/150/200; 과정명 is a type-to-filter select', async () => {
    mount(<StudiesPage />, '/admin/studies');
    await screen.findByRole('heading', { level: 1, name: '학습관리' });
    openSelect(await screen.findByRole('combobox', { name: '페이징 설정' }));
    for (const n of ['120개', '150개', '200개']) expect(await screen.findByRole('option', { name: n })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: '200개' }));
    const course = screen.getByRole('combobox', { name: '과정명' });
    fireEvent.focus(course);
    fireEvent.change(course, { target: { value: 'XYZ' } });
    expect(screen.queryByRole('option', { name: /아카이브 2026/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /리더십 패키지/ }));
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(manageCalls(calls).some((c) => c.includes('lectureCode=XYZ01') && c.includes('size=200'))).toBe(true));
  });

  it('row links: 사업주 → company_info_pop drawer (studies-fixups.test); AI 분석 opens the ai_user_detail_pop sections; 수료 → per-enrollment certificate print', async () => {
    mount(<StudiesPage />, '/admin/studies?go=1');
    expect(await screen.findByRole('button', { name: '테스트기업' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AI 분석 user01' }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByText('학습 요약 통계');
    for (const t of ['학습 요약 통계', '사전역량진단 결과', 'AI 추천 과정 (AI Zone / HRDe 로드맵)', '과정별 학습 로드맵 (수강 중인 과정)', '학습 패턴 분석']) expect(within(dlg).getByText(t)).toBeInTheDocument();
    expect(within(dlg).getByText('*******@test.com')).toBeInTheDocument();
    expect(within(dlg).getByText('010-****-5678')).toBeInTheDocument();
    expect(within(dlg).getByText('Step 1: 기초 과정')).toBeInTheDocument();
    expect(within(dlg).queryByText('현재 수강 중인 과정')).toBeNull(); // Step 1 shows no reason line (PHP)
    expect(within(dlg).getByText('인기 과정')).toBeInTheDocument();
    expect(within(dlg).queryByText('Step 3: 고급 과정')).toBeNull(); // empty step hidden
    fireEvent.click(within(dlg).getAllByRole('button', { name: '닫기' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '수료' }));
    expect(await screen.findByRole('link', { name: '수료증 PDF로 출력하기' })).toHaveAttribute('href', '/admin/studies/7?print=certificate');
  });

  it('진도로그 엑셀: confirm with learner / row counts and the time hint; the server message is shown when nothing is visible', async () => {
    mount(<StudiesPage />, '/admin/studies?go=1');
    fireEvent.click(await screen.findByLabelText('Seq 7'));
    fireEvent.click(screen.getByRole('button', { name: '체크 항목 진도로그 엑셀 출력' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/대상자 1명 \(수강 1건\)/)).toBeInTheDocument();
    expect(within(dlg).getByText(/30초~1분 정도 걸릴 수 있습니다/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: '출력' }));
    expect(await screen.findByText('검색된 학습현황이 없습니다.')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /admin/studies/progress-log/excel?seqs=7'))).toBe(true);
  });

  it('교육담당자 메일 is not capped at 200 and confirms like the PHP', async () => {
    mount(<StudiesPage />, '/admin/studies?go=1');
    fireEvent.click(await screen.findByLabelText('Seq 7'));
    fireEvent.click(screen.getByRole('button', { name: '체크 항목 교육담당자 안내 메일 발송' }));
    expect(await screen.findByText(/교육담당자 안내 메일 발송을 실행하시겠습니까/)).toBeInTheDocument();
  });

  it('검색 결과 엑셀: PHP confirm text before the download', async () => {
    mount(<StudiesPage />, '/admin/studies?go=1');
    await screen.findByText('아카이브 2026');
    fireEvent.click(screen.getByRole('button', { name: '검색 결과 엑셀(CSV) 출력' }));
    expect(await screen.findByText(/현재 검색조건으로 검색된 결과를 엑셀로 출력하시겠습니까/)).toBeInTheDocument();
  });

  it('수료증 1장 인쇄 page (certificate_pdf01.php)', async () => {
    mount(<StudyCertificatePrintPage />, '/admin/studies/7/certificate/print', '/admin/studies/:seq/certificate/print');
    expect(await screen.findByLabelText('수료증 홍길동')).toBeInTheDocument();
    expect(screen.getByText('2026년 03월 02일 ~ 2026년 05월 31일 (15H)')).toBeInTheDocument();
    expect(screen.getByText('1990-01-01')).toBeInTheDocument();
  });

  it('일자별 학습시간: company autocomplete highlights the term, has a close button and a "more" hint', async () => {
    mount(<MonitoringDailyPage />, '/admin/monitoring/daily');
    const input = await screen.findByLabelText('회사명 *');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '테스트' } });
    const opt = await screen.findByRole('option', { name: /주식회사/ }, { timeout: 2000 }); // <b> splits the accessible name
    expect(within(opt).getByText('테스트').tagName).toBe('B');
    expect(screen.getByText(/사업주명을 더 입력하세요/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('일자별 학습시간: one Excel button; validates the current form, confirms, then downloads the .xlsx with those values', async () => {
    mount(<MonitoringDailyPage />, '/admin/monitoring/daily?from=2026-03-03&to=2026-03-03&companyCode=1234567890&companyName=테스트기업');
    await screen.findByRole('heading', { level: 1, name: '일자별 학습시간 관리' });
    expect(screen.queryByRole('button', { name: /15시간충족 시트/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '검색 결과 엑셀 출력' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/데이터가 많으면 시간이 걸릴 수 있습니다/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: '출력' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/studies/daily-time/excel?') && c.includes('from=2026-03-03') && c.includes('companyCode=1234567890'))).toBe(true));
  });
});
