import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { ToastProvider } from '../app/providers/ToastProvider';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import ClosingsPage from '../features/admin/pages/learning/ClosingsPage';
import SubjectCertificatesPage from '../features/admin/pages/learning/SubjectCertificatesPage';
import CompletionDataPage from '../features/admin/pages/learning/CompletionDataPage';
import AiAnalysisPage from '../features/admin/pages/learning/AiAnalysisPage';
import IdentityChecksPage from '../features/admin/pages/learning/IdentityChecksPage';
import CertificateTestPage from '../features/admin/pages/learning/CertificateTestPage';
import { MemberInfoDrawer } from '../features/admin/pages/learning/learningMemberInfo';
import { CourseInfoDrawer } from '../features/admin/pages/learning/learningCourseInfo';
import { abnormalIp, abnormalLearningLinks, identityChecksHref, studyIpHref } from '../features/admin/pages/learning/learningLinks';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const pdf = (name: string, disposition: 'attachment' | 'inline') => new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${disposition}; filename="x.pdf"; filename*=UTF-8''${encodeURIComponent(name)}` } });
const file = (name: string) => new Response(new Blob(['PK']), { status: 200, headers: { 'Content-Disposition': `attachment; filename="x"; filename*=UTF-8''${encodeURIComponent(name)}` } });
const adminA = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B'], subGrants: ['B1', 'B2', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'], canWrite: true } as unknown as AdminSessionState['admin'];
const staffB7 = { ...adminA, id: 'op01', dept: 'D', topGrants: [], subGrants: ['B7'] } as unknown as AdminSessionState['admin'];
const sessionOf = (admin: AdminSessionState['admin']): AdminSessionState => ({ phase: 'authed' as AdminSessionState['phase'], admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin!, logout: async () => {}, extend: async () => true });

const options = { packageCourses: [{ lectureCode: 'ARC2026', name: '아카이브 2026' }], childCourses: [{ lectureCode: 'C1', name: '콘텐츠 1' }], subjectCourses: [{ lectureCode: 'C1', name: '콘텐츠 1' }], tutors: [], years: [2025, 2026], thisYear: 2026, serviceTypes: [] };
const closingRow = { lectureStart: '2026-03-02', lectureEnd: '2026-06-30', openChapter: 1, companyCode: '1234567890', companyName: '테스트기업', lectureCode: 'ARC2026', courseName: '아카이브 2026', serviceType: 'A', serviceTypeLabel: '패키지(환급)', studyCount: 4, endedCount: 4, status: 'Y', processedBy: '관리자', processedAt: '2026-07-01', certificatePrintOk: true, courseExists: true, depositStatus: 'P', paymentSheetIdx: null };
const subjectRow = { lectureStart: '2026-03-02', lectureEnd: '2026-06-30', companyCode: '1234567890', companyName: '테스트기업', studySeq: 9, lectureCode: 'C1', courseName: '콘텐츠 1', ctype: 'W', ctypeLabel: '비환급', name: '홍길동', id: 'user01', storedProgress: 100, passOk: false, certOk: true, groupFirst: true, groupNo: 1 };
const memberDetail = {
  profile: { idx: 2, id: 'user01', name: '홍길동', memberType: 'A', memberTypeLabel: '아카이브', companyCode: '1234567890', companyName: '테스트기업', depart: '교육팀', position: '대리', gender: 'M', genderLabel: '남성', address: { zipcode: '06000', address01: '서울', address02: '1층' }, email: '*******@example.com', mobile: '010-****-3333', tel: null, birthDay: '1991-****-03', masked: true, useYN: 'Y', eduManager: 'Y', testId: 'N', protectId: 'Y', memberRemark: null, sleep: 'N', sleepDate: null, memberOut: 'N', memberOutDate: null, lastLogin: null, lastLoginIp: null, regDate: '2026-10-01 10:00:00', editDate: null, passChange: 'Y', mandatory: 'Y', marketing: 'Y', marketingLabel: '수신허용', abilityYN: null, abilityAfterYN: null, hrd: { nwIno: null, trneeSe: null, irglbrSe: null }, nameEng: 'Hong', etc01: '자격증', etc02: 'SNS', mailling: 'Y', acs: 'N', cardName: null, cardNumber: null, recomId: null, testLectureCode: null },
  company: null, managedCompanies: [], enrollments: [], loginHistory: [], loginTotal: 0, identity: { certCount: 0, certSuccess: 0, lastCertAt: null }, certHistory: [], counselPhone: [],
  inquiries: [{ idx: 4, category: 'A', categoryLabel: '학습 내용 문의', name: '홍길동', title: '질문있어요', regDate: '2026-10-04 00:00:00', status: 'B', statusLabel: '완료' }],
};
const inquiry = { idx: 4, id: 'user01', name: '홍길동', category: 'A', categoryLabel: '학습 내용 문의', title: '질문있어요', contents: '<p>진도가 <b>안</b> 올라요</p>', courseName: 'HRD 아카이브 2026', contentsTitle: '1차시 소개', lectureCode: 'ARC2026', mobile: '010-****-3333', email: '*******@example.com', regDate: '2026-10-04 00:00:00', answeredAt: null, studentFile: null, status: 'B', statusLabel: '완료', answerName: '관리자', answer: '<p>확인했습니다.</p>', answerFiles: [] };
const courseInfo = { idx: 1, lectureCode: 'ARC2026', menuName: '이러닝', classGradeLabel: 'A등급', useYNLabel: '사용', contentsUrlSelect: 'A', packageLectureCode: '', hrdSeq: '', categoryName1: '', categoryName2: '', serviceTypeLabel: '이러닝', contentsTime: 900, contentsName: 'HRD 아카이브 2026', viewCount: 3, keyword1Name: '', keyword2Name: '', keyword3: '', keyword4: '', chapterLabel: '2차시', contentsStart: '', contentsEnd: '', uploadDate: '', professor: '', passTime: 15, mobileLabel: '사용', bookPrice: '0', price: '0', price01View: '0', price02View: '0', price03View: '0', bookIntro: '', attachFile: 'guide.pdf', previewImage: '', bookImage: '', intro: '', eduTarget: '', eduGoal: '' };
const aiPage = { items: [], page: 1, size: 30, total: 0, summary: { totalUsers: 0, totalCourses: 0, completedCount: 0, totalStudies: 0, generalAvgProgress: 0, avgProgress: 0, filteredUsersWithCourses: 0, progressBuckets: { high: 0, medium: 0, low: 0 }, statusBuckets: { completed: 0, notCompleted: 0 } } };

let calls: string[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/^.*\/v1/, '')}`);
    if (url.includes('/admin/learning/options')) return json(options);
    if (url.includes('/admin/learning/terms')) return json({ year: 2026, month: null, companyCode: null, items: [] });
    if (url.includes('/admin/learning/closings/certificates/pdf')) return pdf('certificate__.pdf', 'attachment');
    if (url.includes('/admin/learning/closings/receipt-xlsx')) return file('[테스트기업].xlsx');
    if (url.includes('/admin/learning/closings')) return json({ items: [closingRow], page: 1, size: 15, total: 1 });
    if (url.includes('/admin/learning/subject-certificates/row-print/pdf')) return json({ error: { code: 'NOT_FOUND', message: '수료내역이 없습니다.' } }, 404);
    if (url.includes('/admin/learning/subject-certificates')) return json({ items: [subjectRow], page: 1, size: 10, total: 1 });
    if (url.includes('/admin/learning/completion-data/export-xlsx')) return file('개인별 과정 이수 데이터_20261015.xlsx');
    if (url.includes('/admin/learning/completion-data')) return json({ items: [], page: 1, size: 30, total: 0 });
    if (url.includes('/admin/learning/ai-analysis/export-xlsx')) return file('AI_로그_로드맵_분석_20261015101010.xlsx');
    if (url.includes('/admin/learning/ai-analysis')) return json(aiPage);
    if (url.includes('/admin/learning/identity-checks')) return json({ items: [], page: 1, size: 30, total: 0 });
    if (url.includes('/admin/learning/member-info/user01/inquiries/4')) return json(inquiry);
    if (url.includes('/admin/learning/member-info/user01')) return json(memberDetail);
    if (url.includes('/admin/learning/course-info/attach')) return file('guide.pdf');
    if (url.includes('/admin/learning/course-info')) return json(courseInfo);
    if (url.includes('/admin/learning/certificates/manager/pdf')) return pdf('수료증_20261015101010.pdf', 'attachment');
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

/** AppSelect (combobox) → pick an option by its label. */
function choose(name: string, option: string) {
  const trigger = screen.getByRole('combobox', { name }); trigger.focus(); fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function mount(ui: ReactNode, path: string, admin: AdminSessionState['admin'] = adminA) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><AdminSessionContext.Provider value={sessionOf(admin)}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={ui} /></Routes></MemoryRouter>
    </AdminSessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>,
  );
}

describe('수강 관리 fix-ups', () => {
  let opened: string[]; let saved: string[];
  beforeEach(() => {
    calls = []; opened = []; saved = []; adminTokenStore.clear();
    vi.stubGlobal('fetch', apiMock());
    vi.spyOn(window, 'open').mockImplementation(((u?: string | URL) => { opened.push(String(u)); return null; }) as typeof window.open);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { saved.push(this.download); });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('수강마감: 기간 기준 / 수강마감 여부 change searches before any search once dates are filled (StudyEndTermBasisChange)', async () => {
    // company filled through the PHP names but no search requested yet (go stays 0 until a change)
    mount(<ClosingsPage />, '/admin/learning/closings');
    await screen.findByRole('combobox', { name: '수강기간 기준' });
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-03-02' } });
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-03-31' } });
    expect(calls.some((c) => c.startsWith('GET /admin/learning/closings?'))).toBe(false);
    choose('수강기간 기준', '수강종료일 기준');
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/learning/closings?') && c.includes('termBasis=end') && c.includes('lectureEnd=2026-03-31'))).toBe(true));
    calls = [];
    choose('수강마감 여부', '마감완료');
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/learning/closings?') && c.includes('endStatus=Y'))).toBe(true));
  });

  it('수강마감: one date only → the StudyEndSearch alert instead of a start-only query; empty form → nothing', async () => {
    mount(<ClosingsPage />, '/admin/learning/closings');
    await screen.findByRole('combobox', { name: '수강기간 기준' });
    choose('수강기간 기준', '수강종료일 기준');
    expect(screen.queryByText('검색 조건을 입력하세요.')).toBeNull(); // nothing filled: no search, no alert
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-03-02' } });
    choose('수강마감 여부', '미마감');
    expect(await screen.findByText('조회 종료일을 선택하세요.')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /admin/learning/closings?'))).toBe(false);
  });

  it('수강마감: 수료증 downloads the certificate_pdf02 PDF; 수납 확인서 downloads the .xlsx workbook', async () => {
    mount(<ClosingsPage />, '/admin/learning/closings?go=1&companyCode=1234567890&companyName=테스트기업');
    expect(await screen.findByText('테스트기업')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '수료증' }));
    await waitFor(() => expect(saved).toContain('certificate__.pdf'));
    expect(calls.find((c) => c.includes('/closings/certificates/pdf'))).toContain('serviceTypeYN=N');
    expect(opened).toHaveLength(0); // 'D' download: no tab
    fireEvent.click(screen.getByRole('button', { name: '수납 확인서' }));
    await waitFor(() => expect(saved).toContain('[테스트기업].xlsx'));
    expect(calls.some((c) => c.startsWith('GET /admin/learning/closings/receipt-xlsx?'))).toBe(true);
  });

  it('과목별 이수증: row 이수증 asks for the certificate_pdf04 PDF and shows the PHP alert text when there is none', async () => {
    mount(<SubjectCertificatesPage />, '/admin/learning/subject-certificates?go=1&companyName=테스트기업&id=user01');
    fireEvent.click(await screen.findByRole('button', { name: '이수증' }));
    expect(await screen.findByText('수료내역이 없습니다.')).toBeInTheDocument();
    expect(calls.find((c) => c.includes('/subject-certificates/row-print/pdf'))).toContain('lectureCode=C1');
  });

  it('수료증/이수증 테스트: card 6 downloads the manager PDF', async () => {
    mount(<CertificateTestPage />, '/admin/learning/certificate-test');
    fireEvent.change(await screen.findByLabelText('Manager ID 6'), { target: { value: 'mgr01' } });
    for (const [label, v] of [['CompanyCode 6', '1'], ['LectureStart 6', '2026-01-01'], ['LectureEnd 6', '2026-12-31'], ['LectureCode 6', 'ARC2026']]) fireEvent.change(screen.getByLabelText(label!), { target: { value: v } });
    fireEvent.click(screen.getByRole('button', { name: '교육담당자 수료증 열기' }));
    await waitFor(() => expect(saved).toContain('수료증_20261015101010.pdf'));
  });

  it('수료증/이수증 테스트 is blocked for non-A staff even with the grant', async () => {
    mount(<CertificateTestPage />, '/admin/learning/certificate-test', { ...staffB7!, subGrants: ['B8'] } as AdminSessionState['admin']);
    expect(await screen.findByText('이 메뉴는 관리자(A) 부서 전용입니다.')).toBeInTheDocument();
  });

  it('과정 이수데이터 / AI 로그 분석 export the PHPExcel .xlsx files', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount(<CompletionDataPage />, '/admin/learning/completion-data');
    fireEvent.click(await screen.findByRole('button', { name: '검색 결과 엑셀 출력' }));
    await waitFor(() => expect(saved).toContain('개인별 과정 이수 데이터_20261015.xlsx'));
  });

  it('AI 로그 분석 Excel 다운로드 → AI_로그_로드맵_분석_YmdHis.xlsx', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount(<AiAnalysisPage />, '/admin/learning/ai-analysis');
    fireEvent.click(await screen.findByRole('button', { name: 'Excel 다운로드' }));
    await waitFor(() => expect(saved).toContain('AI_로그_로드맵_분석_20261015101010.xlsx'));
  });

  it('본인인증 모니터링 accepts certification_list.php?col=a.ID&sw=<ID> (이상데이터 link)', async () => {
    mount(<IdentityChecksPage />, '/admin/learning/identity-checks?col=a.ID&sw=user01');
    await waitFor(() => expect(calls.some((c) => c.includes('/admin/learning/identity-checks?') && c.includes('col=ID') && c.includes('q=user01'))).toBe(true));
    expect(calls.some((c) => c.includes('col=a.ID'))).toBe(false);
  });

  it('수강생 상세 정보: 1:1 문의 제목 opens the inquiry inside the popup (B7-only staff, no 1:1 menu link)', async () => {
    mount(<MemberInfoDrawer id="user01" onClose={() => {}} />, '/admin/learning/completion-data', staffB7);
    fireEvent.click(await screen.findByRole('link', { name: '질문있어요' }));
    expect(await screen.findByText('1:1 상담문의 / 학습상담')).toBeInTheDocument();
    expect(await screen.findByText('1차시 소개')).toBeInTheDocument();
    expect(screen.getByText('확인했습니다.')).toBeInTheDocument();
    expect(calls).toContain('GET /admin/learning/member-info/user01/inquiries/4');
    expect(screen.queryByText('1:1 상담문의에서 답변하기')).toBeNull();
  });

  it('과정 상세 정보: blank title prefix without ctype (IP모니터링 caller), 학습자료 is a download link', async () => {
    mount(<CourseInfoDrawer lectureCode="ARC2026" onClose={() => {}} />, '/admin/learning/ip-monitor');
    expect(await screen.findByText('컨텐츠 상세 정보')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('link', { name: 'guide.pdf' }));
    await waitFor(() => expect(saved).toContain('guide.pdf'));
    expect(calls.some((c) => c.startsWith('GET /admin/learning/course-info/attach?lectureCode=ARC2026'))).toBe(true);
  });
});

describe('learningLinks (abnormal_data_view.php related links)', () => {
  it('ip / AUTH_IP_* rows link to IP 모니터링 with the metric IP; auth rows to 본인인증 목록', () => {
    expect(abnormalLearningLinks({ category: 'ip', id: 'user01', metric: { StudyIP: '', UserIP: '10.0.0.1' } })).toEqual([{ label: 'IP 모니터링에서 검색', to: '/admin/learning/ip-monitor?ID=user01&ip_addr=10.0.0.1' }]);
    expect(abnormalLearningLinks({ category: 'auth', issueCode: 'AUTH_IP_MISMATCH', id: 'user01', metric: '{"CertIP":"1.2.3.4"}' })).toEqual([
      { label: 'IP 모니터링에서 검색', to: '/admin/learning/ip-monitor?ID=user01&ip_addr=1.2.3.4' },
      { label: '본인인증 목록에서 검색', to: '/admin/learning/identity-checks?col=a.ID&sw=user01' },
    ]);
    expect(abnormalIp({ sample: 'login from 192.168.0.7 twice' })).toBe('192.168.0.7');
    expect(abnormalLearningLinks({ category: 'study', id: 'user01' })).toEqual([]);
    expect(abnormalLearningLinks({ category: 'ip', id: '' })).toEqual([]);
    expect(studyIpHref('u1')).toBe('/admin/learning/ip-monitor?ID=u1');
    expect(identityChecksHref('u 1')).toBe('/admin/learning/identity-checks?col=a.ID&sw=u+1');
  });
});
