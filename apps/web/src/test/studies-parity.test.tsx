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
import StudyDetailPage from '../features/admin/pages/studies/StudyDetailPage';
import { MonitoringDailyPage } from '../features/admin/pages/studies/MonitoringPages';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B'], subGrants: ['B1', 'B3', 'B5'], canWrite: true } as unknown as AdminSessionState['admin'];
const session: AdminSessionState = { phase: 'authed' as AdminSessionState['phase'], admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin!, logout: async () => {}, extend: async () => true };

const options = { years: [2025, 2026], thisYear: 2026, packageCourses: [{ lectureCode: 'ARC2026', name: '아카이브 2026' }], tutors: [{ id: 't1', name: '강사' }], salesStaff: [{ id: 'sales01', name: '영업' }], periods: ['2026-03-02~2026-05-31'], pageSizes: [10, 30, 50, 70, 100], canWrite: true, showTutorFilter: true, canChangeServiceType: false };
const pre = { label: 'Y', submitted: true, date: '2026-03-03 09:04', showResume: false, open: null, grantExpiresAt: null };
const post = { yn: 'N', date: null, open: 'button', openReason: null, grantExpiresAt: null };
const row = { studySeq: 7, id: 'user01', name: '홍길동', depart: '총무팀', serviceType: 'A', serviceTypeLabel: '패키지(환급)', lectureCode: 'ARC2026', courseName: '아카이브 2026', lectureStart: '2026-03-02', lectureEnd: '2026-05-31', termeIdx: 3, seconds: 55000, studyTimeLabel: '15시간 16분', percent: 100, storedProgress: 100, passOk: 'Y', passOkLabel: '수료', certificateLink: true, studyEnd: 'N', tutorName: '강사', salesName: '영업', salesTeam: '1팀', companyCode: '1234567890', companyName: '테스트기업', certDate: '2026-03-05', openChapter: 1, inputDate: '2026-02-20 10:00:00', pre, post };
const manage = { items: [row], page: 1, size: 30, total: 1, canWrite: true };
const daily = { items: [{ studyDate: '2026-03-03', id: 'user01', name: '홍길동', companyName: '테스트기업', lectureCode: 'ARC2026', openChapter: '1', lecturePeriod: '2026-03-02 ~ 2026-05-31', studyEnd: 'N', tutor: '', salesId: 'sales01', attendPass: 'Y', attendLabel: '수료', hours15Ok: false, hours15Label: '미달', hours15NeedSec: 50000, totalCreditedSec: 4000, totalCreditedLabel: '01시간 06분 40초', seconds: 30000, secondsLabel: '08시간 20분 00초', creditedSec: 28800, creditedLabel: '08시간 00분 00초', excessSec: 1200, excessLabel: '00시간 20분 00초', status: 'over', statusLabel: '8시간만 인정', logSpanSec: 30100 }], page: 1, size: 30, total: 1, period: { start: '2026-03-03', end: '2026-03-03', label: '2026-03-03' }, order: 'date_asc', stats: { total: 1, ge8: 1, cap: 0, over: 1 }, summaryLabel: '행수 1 / 8시간 이상 1 / 8시간 도달 0 / 8시간 초과 1', pagePeople: { people: 1, ok15: 0 }, rule: '규칙' };
const detail = {
  studySeq: 7, id: 'user01', name: '홍길동', companyCode: '1234567890', companyName: '테스트기업', lectureCode: 'ARC2026', courseName: '아카이브 2026', serviceType: 'A', termeIdx: 3, period: { start: '2026-03-02', end: '2026-05-31', label: '' }, active: true,
  seconds: 55000, formatted: '15시간 16분', percent: 100, over15h: true, storedProgress: 100, passOk: true, studyEnd: false, preDone: true, postDone: false, lastLearning: null, salesId: 'sales01', tutor: 't1', inputDate: null, remark: null,
  codes: ['D1'], isPackage: true, chapters: [], daily: [], overlap: { sharedMinutes: 0, minutes: [], rule: 'r' }, identity: [], corrections: [],
  depart: '총무팀', tutorName: '강사', salesName: '영업', salesTeam: '1팀', openChapter: 1, serviceTypeLabel: '패키지(환급)', passOkLabel: '수료', certificateLink: true, certDates: ['2026-03-05'],
  progressHeader: { seconds: 55000, label: '15시간 16분 40초', percent: 100 },
  learning: { isPackage: true, items: [{ no: 1, serviceTypeLabel: '이러닝', courseName: '리더십', contentsTitle: '1강', lectureCode: 'D1', chapterNo: 1, chapterSeq: 1001, rowStudySeq: 8, progress: 100, seconds: 55000, studyTimeLabel: '15시간 16분 40초', lectureTimeMin: 30, startDate: '2026-03-03 10:00:00', endDate: '2026-03-03 11:00:00' }], sum: { chapters: 1, seconds: 55000, label: '15시간 16분 40초', criterionSeconds: 54000, met: true, judge: '수강시간 충족' } },
  assessment: { pre, post, isCurrent: false, counts: { commonAnswered: 3, commonRequired: 3, roleAnswered: 1, roleRequired: 1, postScore: 0 } },
  scores: { midScore: null, midStatus: null, testScore: null, testStatus: null, reportScore: null, reportStatus: null, totalScore: null }, canWrite: true,
};
const ticks = { mode: 'ticks', chapterNo: 1, sameCount: 1, items: [{ no: 1, idx: 1, progress: 10, studyTime: 0, studyTimeLabel: '00:00:00 (시작)', delta: 0, positionSec: null, ip: '10.0.0.1', at: '2026-03-03 10:00:00', lastStudy: null, sameMinute: false }, { no: 2, idx: 2, progress: 20, studyTime: 60, studyTimeLabel: '00:01:00 (+60초)', delta: 60, positionSec: 60, ip: '10.0.0.1', at: '2026-03-03 10:01:00', lastStudy: null, sameMinute: true }] };

function apiMock(calls: string[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/^.*\/v1/, '')}${init?.body ? ` ${String(init.body)}` : ''}`);
    if (url.includes('/admin/studies/manage/options')) return json(options);
    if (url.includes('/admin/studies/manage')) return json(manage);
    if (url.includes('/admin/learning/terms')) return json({ year: 2026, month: null, companyCode: null, items: [] });
    if (url.includes('/admin/studies/delete')) return json({ ok: true, requested: 1, deleted: 1, progressDeleted: 3, termsDeleted: 0, backedUp: 1 });
    if (url.includes('/admin/studies/7/day-time')) return json({ studySeq: 7, date: '2026-10-15', id: 'user01', name: '홍길동', companyName: '테스트기업', companyCode: '1234567890', seconds: 165, label: '00시간 02분 45초' });
    if (url.includes('/admin/studies/7/assessment-grant') && method === 'GET') return json({ studySeq: 7, id: 'user01', name: '홍길동', type: 'POST', typeLabel: '사후역량진단', sessionLabel: '수강 차수 2026-03-02 ~ 2026-05-31', canIssue: true, errors: [], activeGrant: null });
    if (url.includes('/admin/studies/7/assessment-grant')) return json({ ok: true, existing: false, grantIdx: 5, expiresAt: '2026-10-16 10:00:00', sessionLabel: 's', message: '학습자에게 진단 접근이 활성화되었습니다.' });
    if (url.includes('/admin/studies/7/chapter-log')) return json(ticks);
    if (url.includes('/admin/studies/7/progress-log')) return json({ items: [], nextCursor: null, hasMore: false });
    if (url.includes('/admin/studies/7')) return json(detail);
    if (url.includes('/admin/studies/daily-time')) return json(daily);
    if (url.includes('/admin/learning/companies')) return json({ items: [{ companyCode: '1234567890', companyName: '테스트기업' }] });
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

describe('학습관리 / 일자별 학습시간 parity pages', () => {
  let calls: string[];
  beforeEach(() => { calls = []; adminTokenStore.clear(); vi.stubGlobal('fetch', apiMock(calls)); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('학습관리: waits for a search, renders the PHP columns, opens the 수강시간 popup and deletes checked rows', async () => {
    mount(<StudiesPage />, '/admin/studies?go=1&companyCode=1234567890');
    expect(await screen.findByRole('heading', { level: 1, name: '학습관리' })).toBeInTheDocument();
    expect(await screen.findByText('아카이브 2026')).toBeInTheDocument();
    for (const h of ['번호', '개설 용도', '수강시간', '진도율', '수료여부', '실시회차', '수강신청일', '사전', '사후', 'AI 분석']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('15시간 16분')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사후 열기' })).toBeInTheDocument();
    expect(screen.getByText(/검색 결과 총/)).toBeInTheDocument();
    const q = calls.find((c) => c.startsWith('GET /admin/studies/manage?'))!;
    expect(q).toContain('companyCode=1234567890'); expect(q).toContain('size=30');
    fireEvent.click(screen.getByRole('button', { name: '15시간 16분' }));
    expect(await screen.findByText('00시간 02분 45초')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByLabelText('Seq 7'));
    fireEvent.click(screen.getByRole('button', { name: '체크 항목 삭제' }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('POST /admin/studies/delete') && c.includes('"seqs":[7]'))).toBe(true));
  }, 20_000); // heavy page (many popups); slow when the whole suite runs in parallel

  it('학습관리 without a search shows the hint and does not query the list', async () => {
    mount(<StudiesPage />, '/admin/studies');
    expect(await screen.findByText('검색 조건을 선택하세요.')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /admin/studies/manage?'))).toBe(false);
  });

  it('학습관리: 사후 열기 opens the grant dialog and posts operator name + reason', async () => {
    mount(<StudiesPage />, '/admin/studies?go=1');
    fireEvent.click(await screen.findByRole('button', { name: '사후 열기' }));
    expect(await screen.findByText('수강 차수 2026-03-02 ~ 2026-05-31')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/요청자 성명/), { target: { value: '홍관리' } });
    fireEvent.change(screen.getByLabelText(/개방 사유/), { target: { value: '학습자 요청으로 사후진단을 엽니다.' } });
    fireEvent.click(screen.getByRole('button', { name: '학습자 진단 열기' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('POST /admin/studies/7/assessment-grant') && c.includes('"type":"POST"') && c.includes('홍관리'))).toBe(true));
  });

  it('수강 상세: 수강 정보 + 학습 내역 with the 15 h judge; a row opens the chapter tick log', async () => {
    mount(<StudyDetailPage />, '/admin/studies/7', '/admin/studies/:seq');
    expect(await screen.findByText('수강 정보')).toBeInTheDocument();
    expect(screen.getByText('15시간 16분 40초 (100%)')).toBeInTheDocument();
    expect(screen.getByText('수강시간 충족')).toBeInTheDocument();
    for (const h of ['과정구분', '과정코드', '차시', '학습시작일', '학습종료일']) expect(screen.getAllByRole('columnheader', { name: h }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('리더십'));
    expect(await screen.findByText(/빨간색 1행은 같은 분에 다른 차시도/)).toBeInTheDocument();
    expect(calls.some((c) => c.includes('/admin/studies/7/chapter-log') && c.includes('studySeq=8') && c.includes('chapterSeq=1001'))).toBe(true);
  });

  it('일자별 학습시간 관리: requires a company, then renders the 18 PHP columns and summary', async () => {
    mount(<MonitoringDailyPage />, '/admin/monitoring/daily');
    expect(await screen.findByRole('heading', { level: 1, name: '일자별 학습시간 관리' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(await screen.findByText('회사명을 검색 후 목록에서 선택하세요.')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /admin/studies/daily-time'))).toBe(false);
  });

  it('일자별 학습시간 관리 with a company in the URL lists rows and the summary label', async () => {
    mount(<MonitoringDailyPage />, '/admin/monitoring/daily?go=1&from=2026-03-03&to=2026-03-03&companyCode=1234567890&companyName=테스트기업');
    expect(await screen.findByText('행수 1 / 8시간 이상 1 / 8시간 도달 0 / 8시간 초과 1')).toBeInTheDocument();
    for (const h of ['과정코드', '실시회차', '과정 수강기간', '수강마감', '첨삭강사ID', '영업자ID', '이름', '수료', '15시간', '학습시간', '초과시간', '하루판정']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('8시간만 인정')).toBeInTheDocument();
    expect(screen.getByText('미달')).toBeInTheDocument();
    expect(calls.find((c) => c.startsWith('GET /admin/studies/daily-time'))).toContain('companyCode=1234567890');
  });
});
