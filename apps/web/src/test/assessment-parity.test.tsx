import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SessionContext, type SessionState } from '../shared/auth/useSession';
import PreAssessmentPage from '../features/assessment/PreAssessmentPage';
import PostAssessmentPage from '../features/assessment/PostAssessmentPage';
import AssessmentResultPage, { diffCell, scoreCell } from '../features/assessment/AssessmentResultPage';
import MyAssessmentHub from '../features/my/MyAssessmentHub';
import MySurveys from '../features/my/MySurveys';
import { MyReviewDetailPage } from '../features/reviews/MyReviewsPage';
import { mergeAnswers, profileMissing, togglePick } from '../features/assessment/validation';

// AxisPromo reads the published design (DesignProvider), which these page tests do not mount
vi.mock('../shared/ui/AxisPromo', () => ({ AxisPromo: () => null }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const session = { phase: 'authed', user: { id: 'u1', name: '김학습' }, roles: ['learner'], isAuthed: true, login: async () => ({}), logout: async () => {}, refresh: async () => true, patchUser: () => {} } as unknown as SessionState;
const status = (o: Record<string, unknown> = {}) => ({ status: 'not_started', submitted: false, started: false, profileComplete: false, col1: '', commonAnswered: 0, commonRequired: 3, roleAnswered: 0, roleRequired: 0, answered: 0, required: 3, nextStep: 'step01', label: 'N', ...o });
const q = (idx: number, group: string, order: number, text: string) => ({ idx, group, order, bind: 'A', text, detail: `${text} 상세` });
const preForm = {
  studySeq: 77, isGrant: false, period: { start: '2026-10-01', end: '2026-12-31' }, status: status(),
  roles: [{ value: 'W', label: '팀원 [실무자]' }, { value: 'M', label: '팀장 이상 [관리자]' }],
  common: [q(1, 'C', 1, '의사소통'), q(2, 'C', 2, '자기계발')], leader: [q(3, 'L', 1, '리더십1')],
  roleQuestions: { W: [q(4, 'W', 1, '직무1')], M: [q(5, 'M', 1, '관리1')] },
  profileOptions: { job: [q(10, 'A', 1, '기획')], interests: [q(11, 'A', 1, 'AI'), q(12, 'A', 2, '데이터'), q(13, 'A', 3, '리더십'), q(14, 'A', 4, '마케팅')], skills: [q(15, 'A', 1, '문제해결')] },
  saved: { role: '', job: null, interests: [], skills: [], answers: {} },
};
const panel = (o: Record<string, unknown> = {}) => ({
  studySeq: 77, label: { kind: 'active', year: '2026', start: '2026-10-01', end: '2026-12-31' }, isActive: true, isRetro: false, serviceType: 'A', studyEnd: false, col1: 'W', roleLabel: '실무자',
  scores: { common: { pre: 70, post: 0 }, leader: { pre: 60, post: 0 }, job: { pre: 80, post: 0 }, total: { pre: 70, post: 0 } },
  pre: { status: status({ submitted: true, status: 'complete', nextStep: 'done' }), completed: true, started: true, completedAt: '2026-10-02 10:00' },
  post: { completed: false, started: false, state: 'not_started', completedAt: '' },
  grants: { pre: false, post: false, preExpiresAt: null, postExpiresAt: null }, fifteenHours: true, retroWritable: false, ...o,
});
const panelsView = (panels: unknown[], o: Record<string, unknown> = {}) => ({ activeStudySeq: 77, hasActiveEnrollment: true, hasAssessmentGrant: false, mandatoryPre: false, studyTime: { totalSeconds: 54000, completionSeconds: 54000, requiredSeconds: 54000, fifteenHoursMet: true, gateOpen: true, earlyAccess: false }, panels, ...o });

let calls: { method: string; path: string; body: unknown }[] = [];
let routes: Record<string, () => Response> = {};
beforeEach(() => {
  calls = [];
  routes = {};
  localStorage.clear();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.replace(/^.*\/v1/, '').split('?')[0];
    const method = init?.method ?? 'GET';
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const hit = routes[`${method} ${path}`];
    return hit ? hit() : json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
  });
});

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

describe('사전역량진단 flow (prev_test01-03)', () => {
  it('requires the 직급, sends role + C/L answers, then the 직급 questions, then caps the 3rd-step picks at 3', async () => {
    routes['GET /assessment/pre/form'] = () => json(preForm);
    routes['POST /assessment/pre/step01'] = () => json({ studySeq: 77, isGrant: false, status: status({ started: true, col1: 'M', commonAnswered: 3, roleRequired: 1, required: 4, nextStep: 'step02', status: 'needs_role_questions' }) });
    routes['POST /assessment/pre/step02'] = () => json({ studySeq: 77, isGrant: false, status: status({ started: true, submitted: true, col1: 'M', status: 'profile_optional_missing', nextStep: 'step03' }) });
    routes['POST /assessment/pre/step03'] = () => json({ studySeq: 77, isGrant: false, status: status({ started: true, submitted: true, profileComplete: true, col1: 'M', status: 'complete', nextStep: 'done' }) });
    renderAt('/assessment/pre', <PreAssessmentPage />);
    fireEvent.click(await screen.findByRole('button', { name: /사전역량진단 시작하기/ }));
    expect(await screen.findByText('직급을 선택한 뒤 모든 문항에 응답해주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('Q0. 귀하의 현재 직급을 선택해주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('팀장 이상 [관리자]'));
    fireEvent.click(screen.getByLabelText('의사소통 · 그런 편이다'));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('Q2. 자기계발 문항을 선택해주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('자기계발 · 보통이다'));
    fireEvent.click(screen.getByLabelText('리더십1 · 그렇다'));
    expect(screen.getByText('모든 항목이 선택되었습니다. 다음을 눌러주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('관리자로써의 역량을 솔직하게 판단해 보세요.')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/assessment/pre/step01')?.body).toEqual({ studySeq: 77, role: 'M', answers: [{ questionIdx: 1, value: 4 }, { questionIdx: 2, value: 3 }, { questionIdx: 3, value: 5 }], grant: false });
    fireEvent.click(screen.getByLabelText('관리1 · 그렇지 않다'));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('Q1. 귀하의 현재 직무는 무엇인가요?')).toBeInTheDocument();
    for (const t of ['AI', '데이터', '리더십']) fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(t) }));
    fireEvent.click(screen.getByRole('checkbox', { name: /마케팅/ }));
    expect(await screen.findByText('최대 3개까지 선택 가능합니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /기획/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /문제해결/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(await screen.findByText('사전역량진단이 완료되었습니다.')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/assessment/pre/step03')?.body).toEqual({ studySeq: 77, job: 10, interests: [11, 12, 13], skills: [15], grant: false });
  });

  it('shows the PHP 수강기간 종료 message when there is no active enrollment', async () => {
    routes['GET /assessment/pre/form'] = () => json({ error: { code: 'NO_ACCESS', message: '수강기간이 종료되었습니다.\n문의 1811-9530' } }, 404);
    renderAt('/assessment/pre', <PreAssessmentPage />);
    expect(await screen.findByText('수강기간이 종료되었습니다.')).toBeInTheDocument();
  });
});

describe('사후역량진단 gate (post_test01.html)', () => {
  it('blocks under 15 hours with the current study time', async () => {
    routes['GET /assessment/post/form'] = () => json({ error: { code: 'FORBIDDEN', message: '사후역량진단은 학습 시간이 15시간 이상일 때 진행할 수 있습니다.\n\n현재 학습 시간: 3시간 20분', details: { reason: 'STUDY_TIME', totalSeconds: 12000 } } }, 403);
    renderAt('/assessment/post', <PostAssessmentPage />);
    expect(await screen.findByText('사후역량진단은 학습 시간이 15시간 이상일 때 진행할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByText(/현재 학습 시간: 3시간 20분/)).toBeInTheDocument();
  });
});

describe('역량진단 hub (tab-assessment.php)', () => {
  it('opens the 사후 CTA after 15 h, shows the 15h banner, and keeps a non-cohort 1차 panel locked', async () => {
    routes['GET /assessment/panels'] = () => json(panelsView([panel(), panel({ studySeq: 66, isActive: false, isRetro: true, label: { kind: 'retro', year: '2025', start: '2025-09-01', end: '2025-12-31' }, pre: { status: status(), completed: false, started: false, completedAt: '' }, scores: { common: { pre: 0, post: 0 }, leader: { pre: 0, post: 0 }, job: { pre: 0, post: 0 }, total: { pre: 0, post: 0 } }, fifteenHours: false })]));
    renderAt('/my/assessment', <MyAssessmentHub />);
    expect(await screen.findByText('누적 학습 15시간을 달성하셨습니다. 사후역량진단을 완료하시면 수료 처리됩니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '사후역량진단 시작하기' })).toHaveAttribute('href', '/assessment/post');
    expect(screen.getByText('2025 1차 수강 (2025-09-01 ~ 2025-12-31)')).toBeInTheDocument();
    expect(screen.getByText(/1차 사후역량진단은 관리자 개방 후 진행할 수 있습니다/)).toBeInTheDocument();
  });

  it('mandatory 사전 notice when the active enrollment has no 사전', async () => {
    routes['GET /assessment/panels'] = () => json(panelsView([panel({ pre: { status: status({ started: true, nextStep: 'step01' }), completed: false, started: true, completedAt: '' } })], { mandatoryPre: true }));
    renderAt('/my/assessment', <MyAssessmentHub />);
    expect(await screen.findByText('사전역량진단이 필요합니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '사전역량진단 이어하기' })).toHaveAttribute('href', '/assessment/pre');
  });
});

describe('AR-17 만족도조사 list', () => {
  it('lists the service survey per enrollment with its 접수시각 and marks the course survey as not available', async () => {
    routes['GET /assessment/satisfaction'] = () => json({ items: [{ studySeq: 77, label: { kind: 'active', year: '2026', start: '2026-10-01', end: '2026-12-31' }, isActive: true, grant: false, questionCount: 2, required: 2, answered: 2, submitted: true, submittedAt: '2026-10-20 09:00', open: true, blockedReason: null }] });
    renderAt('/my/surveys', <MySurveys />);
    expect(await screen.findByText('제출 완료')).toBeInTheDocument();
    expect(screen.getByText('접수 2026-10-20 09:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '응답 수정' })).toHaveAttribute('href', '/satisfaction/77');
    expect(screen.getByText('과정별 만족도조사는 준비 중입니다')).toBeInTheDocument();
  });
});

describe('역량진단 결과 (assessment_report.html / prev_test_result.html)', () => {
  it('formats cells like PHP and renders the 개선 권장사항', async () => {
    expect(scoreCell(null)).toBe('-');
    expect(scoreCell(0)).toBe('-');
    expect(scoreCell(66.67)).toBe('67점');
    expect(diffCell(60, null)).toBe('-');
    expect(diffCell(60, 80)).toBe('+20');
    expect(diffCell(80, 60)).toBe('-20');
    const sc = { col1: 'W', common: 70, leader: 60, job: 80, total: 70, submitted: true };
    routes['GET /assessment/result'] = () => json({ studySeq: 77, isActive: true, period: { start: '2026-10-01', end: '2026-12-31' }, col1: 'W', roleLabel: '실무자', learner: { name: '김학습', companyName: '테스트기업' },
      scores: { common: { pre: 70, post: 80 }, leader: { pre: 60, post: 60 }, job: { pre: 80, post: 100 }, total: { pre: 70, post: 80 } },
      rows: { common: [{ question: '의사소통', detail: null, pre: 60, post: 80 }, { question: '자기계발', detail: null, pre: 80, post: 80 }, { question: '문제해결', detail: null, pre: 70, post: null }], leader: [], job: [] },
      pre: { ...sc, started: true, completedAt: '2026-10-02 10:00' }, post: { ...sc, common: 80, total: 80, completedAt: '2026-10-25 11:00' }, comparable: true, improvement: 10, recommendations: ['KEEP_GROWING'] });
    renderAt('/assessment/result', <AssessmentResultPage />);
    expect(await screen.findByText('우수한 성장세를 유지하기 위해 지속적인 학습을 권장합니다.')).toBeInTheDocument();
    expect(screen.getByText('역량 향상도: 10점 상승')).toBeInTheDocument();
    const table = screen.getByRole('region', { name: '공통 역량 진단 상세 보기' });
    expect(within(table).queryByText('문제해결')).not.toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: /더 보기/ }));
    expect(within(table).getByText('문제해결')).toBeInTheDocument();
  });
});

describe('수강후기 수정 (survey_modify.html)', () => {
  it('confirms and PATCHes title, contents and the star', async () => {
    routes['GET /my/reviews/5'] = () => json({ idx: 5, lectureCode: 'D1', courseName: '리더십', title: '좋아요', starPoint: 4, regDate: '2026-10-01 10:00:00', viewCount: 2, contents: '내용', visible: true });
    routes['PATCH /my/reviews/5'] = () => json({ idx: 5, lectureCode: 'D1', courseName: '리더십', title: '최고', starPoint: 4, regDate: '2026-10-01 10:00:00', viewCount: 2, contents: '내용', visible: true });
    renderAt('/my/reviews/5', <MyReviewDetailPage />, '/my/reviews/:idx');
    fireEvent.click(await screen.findByRole('button', { name: '수정' }));
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: '최고' } });
    fireEvent.click(screen.getAllByRole('button', { name: '수정' }).at(-1)!);
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ title: '최고', contents: '내용', starPoint: 4 }));
  });
});

describe('assessment helpers', () => {
  it('togglePick / profileMissing / mergeAnswers', () => {
    expect(togglePick([1, 2, 3], 4)).toEqual({ next: [1, 2, 3], overflow: true });
    expect(togglePick([1, 2], 2)).toEqual({ next: [1], overflow: false });
    expect(profileMissing(null, [], [1])).toEqual(['job', 'interests']);
    expect(mergeAnswers({ 1: 5 }, { 1: 2, 2: 3, 3: 9 })).toEqual({ 1: 5, 2: 3 });
  });
});
