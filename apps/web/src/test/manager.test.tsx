import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { ToastProvider } from '../app/providers/ToastProvider';
import { tokenStore } from '../shared/auth/tokenStore';
import { ManagerProvider } from '../features/manager/ManagerContext';
import TraineesPage, { groupBySection, traineeColumns } from '../features/manager/pages/TraineesPage';
import CompletionPage from '../features/manager/pages/CompletionPage';
import NudgePage, { renderNudge } from '../features/manager/pages/NudgePage';
import EducationReportPage from '../features/manager/pages/EducationReportPage';
import OverviewPage from '../features/manager/pages/OverviewPage';
import PaymentsPage from '../features/manager/pages/PaymentsPage';
import type { TraineeRow } from '../shared/api/endpoints/manager';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const pdf = () => new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="certificate.pdf"; filename*=UTF-8''certificate.pdf` } });
const companies = [{ companyCode: 'C1', companyName: '담당본사', ceo: null, tel: null, primary: true, trainees: 2 }, { companyCode: 'C2', companyName: '관리협력사', ceo: null, tel: null, primary: false, trainees: 1 }];

function row(over: Partial<TraineeRow>): TraineeRow {
  return {
    studySeq: 1, id: 'u1', name: '가학습', depart: '영업팀', position: null, companyCode: 'C1', companyName: '담당본사', serviceType: 'A', sectionTitle: '환급 과정', sectionNo: 1, lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026',
    period: { start: '2026-10-01', end: '2026-12-31', label: '2026-10-01 ~ 2026-12-31' }, studyEnd: false, active: true, seconds: 600, timeLabel: '00시간 10분', formatted: '00시간 10분', percent: 1, storedProgress: 0,
    passOk: false, fifteenMet: false, post: { state: 'none', label: '미시작' }, postScore: 0, incomplete: { code: 'TIME', label: '학습시간 미충족' }, preLabel: 'N', preDone: false, postDone: false, certCount: 0, lastLearning: null,
    nudge: { eligible: true, reason: '인정시간 미달' }, ...over,
  };
}
const traineePage = (items: TraineeRow[], over: Record<string, unknown> = {}) => ({ items, page: 1, size: 50, total: items.length, totalPages: 1, uniqueOnPage: new Set(items.map((i) => i.id)).size, selectedYear: '', selectedCompany: '', showCompanyColumn: true, yearOptions: [2026, 2025], today: '2026-10-26', ...over });
const cohort = (over: Record<string, unknown> = {}) => ({ companyCode: 'C1', companyName: '담당본사', lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', serviceType: 'A', mode: 'refund', title: '담당본사의 2026년 HRD 아카이브 2026 · 환급', period: { start: '2026-10-01', end: '2026-12-31', label: '2026-10-01 ~ 2026-12-31 개강' }, totalCount: 2, completedCount: 1, avgProgressRate: 51, certificatePrintOk: false, confirmed: false, state: 'running', reportDeadline: '2027-01-14', reportAllowed: true, composition: { learners: 2, withRecord: 2, noRecord: 0, over15h: 1, passed: 1, notPassed: 0, pending: 1 }, ...over });
const report = {
  reportType: 'education_results', today: '2026-10-26', asOf: '2026-10-26 10:00:00', digest: 'a'.repeat(64), confirmed: false, reportDeadline: '2027-01-14', cap: 1000,
  meta: { companyCode: 'C1', companyName: '담당본사', lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', trainingStart: '2026-10-01', trainingEnd: '2026-12-31', trainingPeriod: '2026.10.01 ~ 2026.12.31', trainingYear: '2026' },
  summary: { totalTrainees: 2, completedCount: 1, inProgressCount: 1, notStartedCount: 0, avgProgressRate: 50.5, avgStudyTimeSeconds: 27800, avgStudyHours: 7, avgStudyMinutes: 43, participationRate: 100, completionRatePercent: 50, avgSatisfaction: 0, satisfactionRespondents: 0, reParticipationRate: 0 },
  competence: { overallBefore: 60, overallAfter: 70, overallChange: 10 }, monthly: [{ month: '10월', avgTime: 7.7 }],
  v1: { title: '교육결과보고서', receiptDate: '2026.10.26', submitDate: '2026. 10. 26', statusLabels: ['수료', '미수료(학습이력)', '미수료(미시작)'], statusPercents: [50, 50, 0], competenceRows: [{ label: '공통역량', before: 60, after: 80, change: '+20점 (33.3%)' }], trainees: [{ no: 1, id: 'u1', name: '가학습', progress: 100, commonScore: 80, jobScore: 0, leadershipScore: 0, satisfaction: '0.0', status: '미수료(학습이력 있음)' }], authorName: '담당자', authorDept: '아카이브', submitOrg: '(주)HRDE' },
};

let calls: string[] = []; let bodies: unknown[] = [];
let traineeItems: TraineeRow[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/^.*\/v1/, '')}`);
    if (init?.body) bodies.push(JSON.parse(String(init.body)));
    if (url.includes('/manager/companies')) return json(companies);
    if (url.includes('/manager/nudge/send')) return json({ ok: false, code: 'SEND_NOT_CONFIGURED', requested: 1, eligible: 1, sent: 0, message: '문자·알림톡 발송 설정이 없어 발송하지 않았습니다.', items: [{ studySeq: 3, id: 'u3', name: '다학습', status: 'NOT_SENT', reason: '발송 설정 없음', message: '다학습님' }] });
    if (url.includes('/manager/trainees')) return json(traineePage(traineeItems));
    if (url.includes('/manager/certificates/pdf')) return pdf();
    if (url.includes('/manager/completion')) return json({ selectedYear: '', selectedCompany: '', yearOptions: [2026], today: '2026-10-26', items: [cohort(), cohort({ companyCode: 'C2', companyName: '관리협력사', serviceType: 'W', mode: 'nonRefund', title: '관리협력사의 2026년 HRD 아카이브 2026 · 비환급', reportAllowed: false, composition: { learners: 1, withRecord: 0, noRecord: 1, over15h: null, passed: null, notPassed: null, pending: null } })], overall: { totalCompleted: 1, totalCount: 3, avgProgressRate: 34 }, insight: { completionRate: 33, status: '현재 1명이 수료했으며', warning: '수료율이 33%로 낮습니다.', suggestion: '평균 진도율 개선' } });
    if (url.includes('/manager/reports/education-results/ai')) return json({ section: 1, feedback: '대체 문구입니다.', model: 'fallback', cached: false });
    if (url.includes('/manager/reports/education-results')) return json(report);
    if (url.includes('/manager/overview')) return json({ error: { code: 'FORBIDDEN', message: '관리 가능한 기업이 없습니다.', details: { reason: 'NO_COMPANY' } } }, 403);
    if (url.includes('/manager/payments')) return json({ year: '2026', yearOptions: [2020, 2026, 2031], page: 1, size: 10, total: 2, totalPages: 1, summary: { totalCount: 2, uniqueStudents: 1, totalEducationFee: 280000, totalSelfPayment: 28000, totalDeposit: 14000, paymentRate: 50 }, items: [{ no: 1, studySeq: 1, id: 'u1', companyCode: 'C1', lectureCode: 'ARC2026', period: { start: '2026-10-01', end: '2026-12-31' }, courseName: 'HRDe 교육원의 2026년 아카이브', educationFee: 140000, selfPayment: 14000, deposit: 14000, requestAmount: 0, depositStatus: 'C', statusLabel: '입금완료', payStatus: 'R', payStatusLabel: '결제요청' }] });
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

function mount(ui: ReactNode, path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><MemoryRouter initialEntries={[path]}>
      <ManagerProvider><Routes><Route path="*" element={ui} /></Routes></ManagerProvider>
    </MemoryRouter></ToastProvider></MotionConfig></QueryClientProvider>,
  );
}

describe('교육담당자 helpers', () => {
  it('groups rows by 과정 유형 in the PHP order and hides the 사업장 column for single-company views', () => {
    const g = groupBySection([row({ studySeq: 1, serviceType: 'W', sectionTitle: '비환급 과정' }), row({ studySeq: 2, serviceType: 'A' }), row({ studySeq: 3, serviceType: 'Z', sectionTitle: '마이크로러닝' })]);
    expect(g.map((s) => s.title)).toEqual(['환급 과정', '비환급 과정', '마이크로러닝']);
    expect(traineeColumns(true).map((c) => c.key)).toContain('companyName');
    expect(traineeColumns(false).map((c) => c.key)).not.toContain('companyName');
  });
  it('renderNudge substitutes the tokens', () => {
    expect(renderNudge('{이름} {종료일} {달성률}', row({}))).toBe('가학습 2026-12-31 1%');
  });
});

describe('교육담당자 pages', () => {
  let opened: string[]; let saved: string[];
  beforeEach(() => {
    calls = []; bodies = []; opened = []; saved = []; tokenStore.set('learner-token', 900);
    traineeItems = [row({ studySeq: 1 }), row({ studySeq: 2, id: 'u2', name: '나학습', passOk: true, incomplete: null, sectionNo: 2, post: { state: 'done', label: '완료' } }), row({ studySeq: 3, id: 'u3', name: '다학습', serviceType: 'W', sectionTitle: '비환급 과정', sectionNo: 1, companyName: '관리협력사', studyEnd: true })];
    vi.stubGlobal('fetch', apiMock());
    vi.spyOn(window, 'open').mockImplementation(((u?: string | URL) => { opened.push(String(u)); return null; }) as typeof window.open);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { saved.push(this.download); });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); tokenStore.clear(); });

  it('수강생 관리: sections, 사업장 column, 미수료 사유, count line, 엑셀 내려받기', async () => {
    mount(<TraineesPage />, '/manager/trainees');
    expect(await screen.findByRole('region', { name: '환급 과정' })).toBeInTheDocument();
    const refund = screen.getByRole('region', { name: '환급 과정' });
    expect(within(refund).getByText('학습시간 미충족')).toBeInTheDocument();
    expect(within(refund).getAllByText('사업장').length).toBeGreaterThan(0);
    expect(within(screen.getByRole('region', { name: '비환급 과정' })).getByText('종료 차수')).toBeInTheDocument();
    expect(screen.getByText(/전체 3건 수강/)).toBeInTheDocument();
    expect(screen.getByText(/고유 수강생 3명/)).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /manager/trainees?') && c.includes('size=50'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '엑셀 내려받기' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /manager/trainees/export.xlsx'))).toBe(true));
  });

  it('수료 관리: cards, report only for the home company, 수료증 PDF opens with the cohort ServiceType', async () => {
    mount(<CompletionPage />, '/manager/completion');
    expect(await screen.findByText('담당본사의 2026년 HRD 아카이브 2026 · 환급')).toBeInTheDocument();
    const reportLinks = screen.getAllByRole('link', { name: '교육결과보고서' });
    expect(reportLinks).toHaveLength(1);
    expect(reportLinks[0]!.getAttribute('href')).toContain('/manager/reports/education-results?companyCode=C1');
    expect(screen.getByText('교육결과보고서는 본인 기업(회원 정보의 소속 기업)만 열 수 있습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '수료증 출력' })[0]!);
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /manager/certificates/pdf?') && c.includes('serviceType=A') && c.includes('lectureStart=2026-10-01'))).toBe(true));
    expect(screen.getByText('수료율이 33%로 낮습니다.')).toBeInTheDocument();
  });

  it('확인·독려: only eligible rows, server re-check result shows SEND_NOT_CONFIGURED per target', async () => {
    traineeItems = [row({ studySeq: 3, id: 'u3', name: '다학습' }), row({ studySeq: 4, id: 'u4', name: '라학습', nudge: { eligible: false, reason: '이미 수료했습니다.' } })];
    mount(<NudgePage />, '/manager/nudge');
    expect((await screen.findAllByText('다학습')).length).toBeGreaterThan(0);
    expect(screen.queryByText('라학습')).toBeNull();
    expect(calls.some((c) => c.includes('status=guide'))).toBe(true);
    const send = screen.getByRole('button', { name: '발송 요청' });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByLabelText('다학습'));
    fireEvent.click(send);
    expect(await screen.findByText(/요청 1명 · 대상 확인 1명 · 발송 0명/)).toBeInTheDocument();
    expect(bodies[0]).toMatchObject({ studySeqs: [3] });
    expect(screen.getByText('미발송(발송 설정 없음)')).toBeInTheDocument();
  });

  it('교육결과보고서: formal body + separate AI panel, CSV export after the digest re-check', async () => {
    mount(<EducationReportPage />, '/manager/reports/education-results?companyCode=C1&lectureCode=ARC2026&lectureStart=2026-10-01&lectureEnd=2026-12-31');
    expect(await screen.findByText('훈련생별 수료현황표')).toBeInTheDocument();
    expect(screen.getByText('담당자')).toBeInTheDocument();
    expect(screen.getByText('AI 참고 의견 (사람 확인 전)')).toBeInTheDocument();
    expect(await screen.findAllByText('대체 문구입니다.')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'CSV 내려받기' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /manager/reports/education-results/export.csv?'))).toBe(true));
  });

  it('운영현황: a manager without companies sees the 배정 운영건 없음 state', async () => {
    mount(<OverviewPage />, '/manager');
    expect(await screen.findByText('배정된 운영정보가 없습니다')).toBeInTheDocument();
  });

  it('자부담금 관리: summary cards, deposit status, AR-21 proof statuses kept separate', async () => {
    mount(<PaymentsPage />, '/manager/payments');
    expect(await screen.findByText('입금완료')).toBeInTheDocument();
    expect(screen.getByText('HRDe 교육원의 2026년 아카이브')).toBeInTheDocument();
    expect(screen.getByText('수강생 1명 (수강등록 2건)')).toBeInTheDocument();
    expect(screen.getAllByText('기존 LMS 확인')).toHaveLength(3);
  });
});
