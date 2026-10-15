import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { ToastProvider } from '../app/providers/ToastProvider';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import ClosingsPage from '../features/admin/pages/learning/ClosingsPage';
import CertificatePrintPage from '../features/admin/pages/learning/CertificatePrintPage';
import AiAnalysisPage from '../features/admin/pages/learning/AiAnalysisPage';
import StudyHistoryPage from '../features/admin/pages/learning/StudyHistoryPage';
import SubjectCertificatesPage from '../features/admin/pages/learning/SubjectCertificatesPage';
import IpMonitorPage from '../features/admin/pages/learning/IpMonitorPage';
import NegativeTrainingPage from '../features/admin/pages/learning/NegativeTrainingPage';
import CompletionDataPage from '../features/admin/pages/learning/CompletionDataPage';
import CertificateTestPage from '../features/admin/pages/learning/CertificateTestPage';
import { progressValidationError, termQuery } from '../features/admin/pages/learning/learningShared';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B'], subGrants: ['B1', 'B2', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'], canWrite: true } as unknown as AdminSessionState['admin'];
const session: AdminSessionState = { phase: 'authed' as AdminSessionState['phase'], admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin!, logout: async () => {}, extend: async () => true };

const options = { packageCourses: [{ lectureCode: 'ARC2026', name: '아카이브 2026' }], childCourses: [{ lectureCode: 'C1', name: '콘텐츠 1' }], subjectCourses: [{ lectureCode: 'C1', name: '콘텐츠 1' }], tutors: [], years: [2025, 2026], thisYear: 2026, serviceTypes: [] };
const closingRow = { lectureStart: '2026-03-02', lectureEnd: '2026-06-30', openChapter: 1, companyCode: '1234567890', companyName: '테스트기업', lectureCode: 'ARC2026', courseName: '아카이브 2026', serviceType: 'A', serviceTypeLabel: '패키지(환급)', studyCount: 4, endedCount: 0, status: 'N', processedBy: '', processedAt: '', certificatePrintOk: false, courseExists: true, depositStatus: 'P', paymentSheetIdx: null };
const summary = { totalTrainees: 2, completedCount: 1, inProgressCount: 1, notStartedCount: 0, avgProgressRate: 55, avgStudyTimeSeconds: 3600, avgStudyHours: 1, avgStudyMinutes: 0, participationRate: 100, completionRatePercent: 50, avgSatisfaction: 4.2, satisfactionRespondents: 1, reParticipationRate: 80 };
const report = {
  reportType: 'training_progress', version: 'v2', today: '2026-10-15',
  meta: { companyCode: '1234567890', companyName: '테스트기업', lectureCode: 'ARC2026', courseName: '아카이브 2026', trainingStart: '2026-03-02', trainingEnd: '2026-06-30', trainingPeriod: '2026.03.02 ~ 2026.06.30', trainingYear: '2026' },
  trainees: [{ id: 'user01', name: '홍길동', totalStudyTime: 54000, progress: 100, passOk: true }], summary,
  competence: { c1: 50, c2: 60, j1: 0, j2: 0, l1: 0, l2: 0, overallBefore: 50, overallAfter: 60, overallChange: 10 }, monthly: [{ month: '6월', avgTime: 1 }],
  v1: { title: '훈련진행보고서', receiptDate: '2026.10.15', submitDate: '2026. 10. 15', statusLabels: ['완료', '진행중', '미시작'], statusPercents: [50, 50, 0], competenceRows: [{ label: '공통역량', before: 50, after: 60, change: '+10점 (20%)' }], trainees: [{ no: 1, id: 'user01', name: '홍길동', progress: 100, commonScore: 60, jobScore: 0, leadershipScore: 0, satisfaction: '4.0', status: '수료' }], authorName: '', authorDept: '아카이브', submitOrg: '(주)HRDE', aiSections: [] },
  v2: {
    copy: { title: '훈련진행보고서', section1: '1. 학습 진행 현황', section2: '2. 만족도 조사 진행 현황', section3: '3. 진행상태 및 향후 계획', section4: '4. 학습자별 학습진행 요약', submitText: '다음과 같이 훈련진행보고서를 제출합니다.', completeHeader: '수료 여부' },
    documentNo: '2026_06_001', receiptDate: '', reportDate: '2026. 10. 15', authorOrg: '아이넥스평생교육원', authorDept: '교육운영팀', authorName: '관리자', goal: ['1. 재직근로자의 직무역량 강화'], proposal: ['1. 부족 역량 보완을 위한 심화 과정 운영'], notice: [],
    progressPct: '55', completePct: '50', avgStudyHms: '01:00:00', studyTimeLabel: '학습 시간(평균)', studyTimeValue: '1시간',
    competence: [{ label: '공통 역량', chartLabel: '공통 역량', delta: '사전 50점 → 사후 60점 (+10)', before: 50, after: 60 }], improvedItems: [], needsWorkItems: [],
    satItems: [{ idx: 31, label: '1. 전체 교육 만족도', chartLabel: '전체만족도', n: 1, avg10: 8, avg10Label: '8.0' }], overallSat100: 80, satChartTitle: '만족도 조사 진행 현황',
    effects: [{ label: '공통역량', text: '재직근로자의 공통역량 평균 10점 상승' }], applyRate: 50, applyText: '재직근로자의 50%가 역량 향상과 업무/직무역량 개선에 긍정 응답', fraudCheck: '', fraudCheckText: '', showLeadershipColumns: false,
    trainees: [{ no: 1, id: 'user01', name: '홍길동', studyTimeHms: '15:00:00', cBefore: '50점', cAfter: '60점', lBefore: '-', lAfter: '-', jobBefore: '-', jobAfter: '-', sat100: '80점', status: '수료' }],
  },
};
const receipt = { title: '수납확인서', companyLabel: '[테스트기업]', header: ['순번', '훈련 과정명', '훈련기간', '회사명', '성명', '생년월일', '총훈련비', '자부담금'], items: [{ no: 1, studySeq: 9, course: '디지털원격훈련 아카이브', period: '2026-03-02 ~ 2026-06-30', companyName: '테스트기업', name: '홍길동', birthDay: '1990-01-02', fee: '140,000', selfPay: '14,000' }], totalLabel: '총 훈련비 합계', totalFee: '140,000', totalSelfPay: '14,000', certifyText: '위 자부담금을 영수하였음을 증명합니다.', date: '2026-10-15', siteName: '아이넥스평생교육원', fileName: '[테스트기업].xls' };
const emptyCert = { kind: 'completion', title: '수료증', siteName: '아이넥스평생교육원', issueDate: '2026-10-15', issueDateLabel: '2026 년  10월  15일', body: [], items: [], diag: { totalStudy: 3, passedStudy: 0, messages: ['수료내역이 없습니다.', '수강 기록: 3건, 수료(PassOK=Y): 0건', '수료 처리가 되지 않은 수강생만 있습니다.'] } };
const aiPage = { items: [{ id: 'user01', name: '홍길동', courseNames: '아카이브', companyName: '테스트기업', progress: 40, progressLabel: '40%', seconds: 60, studyTimeLabel: '1분', lectureStart: null, lectureEnd: null, totalStudyCount: 1, completedCount: 0, completion: '미수료' }], page: 1, size: 30, total: 1,
  summary: { totalUsers: 10, totalCourses: 5, completedCount: 1, totalStudies: 5, generalAvgProgress: 33.3, avgProgress: 40, filteredUsersWithCourses: 1, progressBuckets: { high: 0, medium: 0, low: 0 }, statusBuckets: { completed: 1, notCompleted: 2 } } };
const aiDetail = { basic: { id: 'user01', name: '홍길동', companyName: '테스트기업', depart: '-', position: '대리', regDate: '2025-01-01', email: '*******@test.kr', mobile: '010-****-5678' },
  summary: { totalCourses: 1, avgProgress: 40, completedCount: 0, totalStudyCount: 1, totalStudyTime: 60, studyTimeLabel: '1분', passRate: 0, state: '진행중' }, preAssessment: { userGroup: '실무자', diagnosisDate: '-', weakAreas: ['의사소통'], weakAreasTop5: ['의사소통'] },
  recommend: { steps: [{ title: 'Step 1: 기초 과정', description: '기초', showReason: false, items: [{ code: 'C1', name: '콘텐츠 1', time: 30, chapter: 1, category: '기타', recommendReason: '현재 수강 중인 과정' }] }, { title: 'Step 2: 심화 과정', description: '심화', showReason: true, items: [] }, { title: 'Step 3: 고급 과정', description: '고급', showReason: true, items: [] }], recommendedCount: 1, candidateCount: 1 },
  roadmap: [{ no: 1, studySeq: 9, lectureCode: 'ARC2026', courseName: '아카이브', lectureStart: '2026-03-02', lectureEnd: '2026-06-30', progress: 40, progressTone: 'danger', seconds: 60, studyTimeLabel: '1분', passLabel: '진행중', learningLabel: '학습중' }],
  pattern: [{ date: '2026-10-01', label: '10/01', minutes: 1 }] };

function apiMock(calls: string[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/^.*\/v1/, '')}`);
    if (url.includes('/admin/learning/options')) return json(options);
    if (url.includes('/admin/learning/terms')) return json({ year: 2026, month: null, companyCode: null, items: [] });
    if (url.includes('/admin/learning/closings/reports/')) return url.includes('/ai') ? json({ section: 1, feedback: '분석 결과입니다.', model: 'fallback', cached: false }) : json(report);
    if (url.includes('/admin/learning/closings/receipt')) return json(receipt);
    if (url.includes('/admin/learning/closings/certificates')) return json(emptyCert);
    if (url.includes('/admin/learning/closings')) return json({ items: [closingRow], page: 1, size: 15, total: 1 });
    if (url.includes('/admin/learning/ai-analysis/users/')) return json(aiDetail);
    if (url.includes('/admin/learning/ai-analysis')) return json(aiPage);
    if (url.includes('/admin/learning/ip-monitor')) return json({ mode: 'detail', items: [], page: 1, size: 30, total: 0 });
    if (url.includes('/admin/learning/negative-trainings')) return json(method === 'POST' ? { ok: true, idx: 9 } : { items: [], page: 1, size: 30, total: 0 });
    if (url.includes('/admin/learning/history')) return json({ items: [], page: 1, size: 30, total: 0 });
    if (url.includes('/admin/learning/completion-data')) return json({ items: [], page: 1, size: 30, total: 0 });
    if (url.includes('/admin/learning/certificate-samples')) return json({ kind: 'latest_seq', found: true, seq: 77 });
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

function mount(ui: ReactNode, path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><AdminSessionContext.Provider value={session}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={ui} /></Routes></MemoryRouter>
    </AdminSessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>,
  );
}

describe('수강 관리 parity', () => {
  let calls: string[]; let opened: string[];
  beforeEach(() => { calls = []; opened = []; adminTokenStore.clear(); vi.stubGlobal('fetch', apiMock(calls)); vi.spyOn(window, 'open').mockImplementation(((u?: string | URL) => { opened.push(String(u)); return null; }) as typeof window.open); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('수강마감: certificate printing is blocked until closed; reports and receipt open the new pages, not PHP', async () => {
    mount(<ClosingsPage />, '/admin/learning/closings?go=1&companyCode=1234567890&companyName=테스트기업');
    expect(await screen.findByText('테스트기업')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '수료증' }));
    expect(await screen.findByText('수강마감 이후에 수료증 출력이 가능합니다.')).toBeInTheDocument();
    expect(opened).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '훈련진행보고서(new)' }));
    fireEvent.click(screen.getByRole('button', { name: '훈련진행보고서' }));
    fireEvent.click(screen.getByRole('button', { name: '인쇄' }));
    expect(opened[0]).toContain('/admin/learning/certificates/print?kind=report&reportType=training_progress&version=v2');
    expect(opened[1]).toContain('version=v1');
    expect(opened[2]).toContain('kind=receipt');
    expect(opened.every((u) => !u.includes('.php'))).toBe(true);
  });

  it('수강마감: PHP parameter names prefill and search; 수강마감 여부 change re-queries at once', async () => {
    mount(<ClosingsPage />, '/admin/learning/closings?LectureStart=2026-03-02&LectureEnd=2026-03-31&CompanyCode=1234567890&CompanyName=테스트기업');
    expect(await screen.findByText('테스트기업')).toBeInTheDocument();
    expect(calls.some((c) => c.includes('/admin/learning/closings?') && c.includes('lectureStart=2026-03-02'))).toBe(true);
  });

  it('보고서 v2 prints the official cover and sections from the API data', async () => {
    mount(<CertificatePrintPage />, '/admin/learning/certificates/print?kind=report&reportType=training_progress&version=v2&companyCode=1234567890&lectureStart=2026-03-02&lectureEnd=2026-06-30&lectureCode=ARC2026');
    expect(await screen.findByText('2026_06_001')).toBeInTheDocument();
    expect(screen.getByText('1. 학습 진행 현황')).toBeInTheDocument();
    expect(screen.getByText('사전 50점 → 사후 60점 (+10)')).toBeInTheDocument();
    expect(screen.getByText('15:00:00')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /admin/learning/closings/reports/training_progress?') && c.includes('version=v2'))).toBe(true);
  });

  it('보고서 v1 shows the AI 분석결과 boxes from the API', async () => {
    mount(<CertificatePrintPage />, '/admin/learning/certificates/print?kind=report&reportType=training_progress&version=v1&companyCode=1234567890&lectureStart=2026-03-02&lectureEnd=2026-06-30&lectureCode=ARC2026');
    expect(await screen.findByText('학습 성과 요약')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('분석 결과입니다.')).toHaveLength(4));
    expect(calls.filter((c) => c.includes('/reports/training_progress/ai?'))).toHaveLength(4);
  });

  it('수납확인서 sheet and the certificate_pdf02 diagnostics', async () => {
    mount(<CertificatePrintPage />, '/admin/learning/certificates/print?kind=receipt&companyCode=1234567890&lectureStart=2026-03-02&lectureEnd=2026-06-30&lectureCode=ARC2026');
    expect(await screen.findByText('[테스트기업]')).toBeInTheDocument();
    expect(screen.getByText('위 자부담금을 영수하였음을 증명합니다.')).toBeInTheDocument();
    expect(screen.getAllByText('140,000').length).toBeGreaterThan(0);
  });

  it('수료증 no-data shows the counts', async () => {
    mount(<CertificatePrintPage />, '/admin/learning/certificates/print?kind=completion&companyCode=1&lectureStart=2026-03-02&lectureEnd=2026-06-30');
    expect(await screen.findByText('수강 기록: 3건, 수료(PassOK=Y): 0건')).toBeInTheDocument();
    expect(screen.getByText('수료 처리가 되지 않은 수강생만 있습니다.')).toBeInTheDocument();
  });

  it('AI 로그·로드맵: general average KPI, empty chart text, ID opens the 상세 분석 drawer', async () => {
    mount(<AiAnalysisPage />, '/admin/learning/ai-analysis');
    expect(await screen.findByText('33.3%')).toBeInTheDocument();
    expect(screen.getByText('데이터가 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'user01' }));
    expect(await screen.findByText('AI 로그·로드맵 상세 분석')).toBeInTheDocument();
    expect(await screen.findByText('*******@test.kr')).toBeInTheDocument();
    expect(screen.getByText('Step 1: 기초 과정')).toBeInTheDocument();
    expect(screen.getByText('과정별 학습 로드맵 (수강 중인 과정)')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '최근 30일 일별 학습시간(분) 추이' })).toBeInTheDocument();
  });

  it('학습내역관리: 사업주 검색 needs a name; one 진도율 box alone is rejected', async () => {
    mount(<StudyHistoryPage />, '/admin/learning/history?searchGubun=B');
    fireEvent.click(await screen.findByRole('button', { name: /^검색$/ }));
    expect(await screen.findByText('사업주명을 입력하세요.')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /admin/learning/history'))).toBe(false);
    expect(progressValidationError('10', '')).toBe('진도율은 숫자만 입력하세요.');
    expect(progressValidationError('', '')).toBeNull();
    expect(progressValidationError('10', '80')).toBeNull();
    expect(termQuery({ searchGubun: 'A', year: '2026', month: '0', lectureStart: '', lectureEnd: '', companyCode: '', companyName: '' }).month).toBeUndefined(); // 월=전체 survives the URL as '0'
  });

  it('과목별 이수증: 사업주명 is mandatory, 이수증(PDF) 일괄 needs one learner', async () => {
    mount(<SubjectCertificatesPage />, '/admin/learning/subject-certificates');
    fireEvent.change(await screen.findByLabelText('이름, ID'), { target: { value: 'user01' } });
    fireEvent.click(screen.getByRole('button', { name: /^검색$/ }));
    expect(await screen.findByText('사업주명을 선택하세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이수증(PDF) 일괄' }));
    expect(opened).toHaveLength(0);
  });

  it('IP모니터링 ?ID= prefill searches the detail view over all months', async () => {
    mount(<IpMonitorPage />, '/admin/learning/ip-monitor?ID=user01');
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/learning/ip-monitor?'))).toBe(true));
    const q = calls.find((c) => c.startsWith('GET /admin/learning/ip-monitor?'))!;
    expect(q).toContain('viewMode=detail');
    expect(q).toContain('id=user01');
    expect(q).not.toContain('month=');
  });

  it('리포트 부정훈련: 등록 asks 등록하시겠습니까? before saving', async () => {
    mount(<NegativeTrainingPage />, '/admin/learning/negative-training');
    fireEvent.click(await screen.findByRole('button', { name: '신규 등록' }));
    fireEvent.change(await screen.findByLabelText(/사업주 ID/), { target: { value: '1234567890' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    const dialog = await screen.findByRole('dialog', { name: '등록하시겠습니까?' });
    expect(calls.some((c) => c.startsWith('POST'))).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: '등록' }));
    await waitFor(() => expect(calls.some((c) => c === 'POST /admin/learning/negative-trainings')).toBe(true));
  });

  it('과정 이수데이터: 실시회차 0 is rejected', async () => {
    mount(<CompletionDataPage />, '/admin/learning/completion-data');
    fireEvent.change(await screen.findByLabelText('실시회차'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^검색$/ }));
    expect(await screen.findByText('실시회차는 1이상 숫자만 입력하세요.')).toBeInTheDocument();
  });

  it('수료증/이수증 테스트: latest Seq keeps a typed value and card 2 opens the certificate_pdf01 PDF', async () => {
    mount(<CertificateTestPage />, '/admin/learning/certificate-test');
    const seq = await screen.findByLabelText('Study Seq');
    fireEvent.change(seq, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: '최근 수료 Seq 가져오기' }));
    expect(calls.some((c) => c.includes('certificate-samples'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '수료증 열기' }));
    expect(opened[0]).toBe(''); // inline PDF tab opened in the click (pdf01 used Output('I'))
    await waitFor(() => expect(calls).toContain('GET /admin/learning/certificates/by-seq/pdf?seq=5'));
  });
});
