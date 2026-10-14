import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { ToastProvider } from '../app/providers/ToastProvider';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import ClosingsPage from '../features/admin/pages/learning/ClosingsPage';
import IdentityChecksPage from '../features/admin/pages/learning/IdentityChecksPage';
import NegativeTrainingPage from '../features/admin/pages/learning/NegativeTrainingPage';
import CertificatePrintPage from '../features/admin/pages/learning/CertificatePrintPage';
import IpMonitorPage from '../features/admin/pages/learning/IpMonitorPage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B'], subGrants: ['B1', 'B2', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'], canWrite: true } as unknown as AdminSessionState['admin'];
const session: AdminSessionState = { phase: 'authed' as AdminSessionState['phase'], admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin!, logout: async () => {}, extend: async () => true };

const options = { packageCourses: [{ lectureCode: 'ARC2026', name: '아카이브 2026' }], childCourses: [{ lectureCode: 'C1', name: '콘텐츠 1' }], tutors: [], years: [2025, 2026], thisYear: 2026, serviceTypes: [{ value: 'A', label: '패키지(환급)' }, { value: 'W', label: '비환급' }] };
const closings = { items: [{ lectureStart: '2026-03-02', lectureEnd: '2026-06-30', openChapter: 1, companyCode: '1234567890', companyName: '테스트기업', lectureCode: 'ARC2026', courseName: '아카이브 2026', serviceType: 'A', serviceTypeLabel: '패키지(환급)', studyCount: 4, endedCount: 0, status: 'N', processedBy: '', processedAt: '', certificatePrintOk: false, courseExists: true, depositStatus: 'P', paymentSheetIdx: null }], page: 1, size: 15, total: 1 };
const identity = { items: [{ seq: 9, id: 'user01', companyName: '테스트기업', name: '홍길동', courseName: '아카이브 2026', lectureCode: 'ARC2026', studySeq: 7, certifiedAt: '2026-10-01 10:00:00', sentAt: '2026-10-01 10:00:05', ok: true, ip: '10.0.0.1' }], page: 1, size: 30, total: 1 };
const negatives = { items: [{ idx: 3, companyCode: '1234567890', companyName: '테스트기업', content: '부정훈련 의심 메모', regDate: '2026-10-01 09:00:00' }], page: 1, size: 30, total: 1 };
const cert = { kind: 'completion', title: '수료증', siteName: '아이넥스평생교육원', issueDate: '2026-10-14', issueDateLabel: '2026 년  10월  14일', body: ['위 사람은 국민 평생 직업능력 개발법 제20조 및', '제24조의 규정에 의하여 본 교육원이 실시한', '위 훈련 과정을 위 기간 동안 성실히', '수행하였기에 본 증서를 수여합니다.'], items: [{ id: 'user01', studySeq: 7, name: '홍길동', birthDay: '1990-01-02', companyName: '테스트기업', courseName: '아카이브 2026', lectureCode: 'ARC2026', contentsTime: null, lectureStart: '2026-03-02', lectureEnd: '2026-06-30', periodLabel: '2026년 03월 02일 ~ 2026년 06월 30일', seconds: 54000, hours: 15 }] };
const ipGroups = { mode: 'group', items: [{ companyCode: '1234567890', companyName: '테스트기업', address01: '서울', address02: null, ip: '10.0.0.1', userCount: 5, recordCount: 7, courseCount: 1, avgProgress: 12.5, progressDiff: 3, firstStart: '2026-03-02', lastEnd: '2026-06-30', riskLabel: '위험', riskLevel: 'danger' }], page: 1, size: 20, total: 1 };

function apiMock(calls: string[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/^.*\/v1/, '')}`);
    if (url.includes('/admin/learning/options')) return json(options);
    if (url.includes('/admin/learning/terms')) return json({ year: 2026, month: null, companyCode: null, items: [] });
    if (url.includes('/admin/learning/closings/complete')) return json({ ok: true, studies: 4, ended: 4, studyEndInserted: 4, studyEndUpdated: 0, childrenEnded: 0 });
    if (url.includes('/admin/learning/closings/certificates')) return json(cert);
    if (url.includes('/admin/learning/closings')) return json(closings);
    if (url.includes('/admin/learning/identity-checks')) return json(identity);
    if (url.includes('/admin/learning/negative-trainings')) return json(negatives);
    if (url.includes('/admin/learning/ip-monitor')) return json(ipGroups);
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

describe('수강 관리 pages', () => {
  let calls: string[];
  beforeEach(() => { calls = []; adminTokenStore.clear(); vi.stubGlobal('fetch', apiMock(calls)); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('수강마감: waits for a search, then renders the legacy columns and posts the closing on confirm', async () => {
    mount(<ClosingsPage />, '/admin/learning/closings?go=1&companyCode=1234567890&companyName=테스트기업');
    expect(await screen.findByRole('heading', { level: 1, name: '수강마감' })).toBeInTheDocument();
    expect(await screen.findByText('테스트기업')).toBeInTheDocument();
    for (const h of ['수강기간', '실시회차', '사업주명', '과정명', '환급여부', '수강생', '교육종료', '수납', '수료증 출력', '보고서']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('4명')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '수강마감' }));
    expect(await screen.findByText('교육종료(수강마감) 처리')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '마감 처리' }));
    await waitFor(() => expect(calls.some((c) => c === 'POST /admin/learning/closings/complete')).toBe(true));
    expect(await screen.findByText(/교육종료 처리가 완료되었습니다/)).toBeInTheDocument();
  });

  it('수강마감 without conditions shows the hint and does not query', async () => {
    mount(<ClosingsPage />, '/admin/learning/closings');
    expect(await screen.findByText('검색 조건을 선택하세요.')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /admin/learning/closings'))).toBe(false);
  });

  it('본인인증 모니터링 loads immediately with the legacy columns', async () => {
    mount(<IdentityChecksPage />, '/admin/learning/identity-checks');
    expect(await screen.findByText('홍길동')).toBeInTheDocument();
    for (const h of ['번호', '사업주', '아이디', '이름', '교육과정', '인증시간', '전송시간']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('2026-10-01 10:00:00')).toBeInTheDocument();
  });

  it('리포트 부정훈련 lists rows and opens the detail drawer', async () => {
    mount(<NegativeTrainingPage />, '/admin/learning/negative-training');
    expect(await screen.findByText('부정훈련 의심 메모')).toBeInTheDocument();
    fireEvent.click(screen.getByText('부정훈련 의심 메모'));
    expect(await screen.findByText('사업주 ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '정보 수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신규 등록' })).toBeInTheDocument();
  });

  it('IP모니터링 묶음 보기 renders groups with risk labels', async () => {
    mount(<IpMonitorPage />, '/admin/learning/ip-monitor?go=1&year=2026&month=03');
    expect(await screen.findByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('위험')).toBeInTheDocument();
    expect(screen.getByText('5명')).toBeInTheDocument();
    for (const h of ['사업장', '수강 IP', '인원수', '학습레코드', '과정수', '평균진도', '진도편차', '위험도']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
  });

  it('수료증 print page renders one sheet per learner with the PHP wording', async () => {
    mount(<CertificatePrintPage />, '/admin/learning/certificates/print?kind=completion&companyCode=1234567890&lectureStart=2026-03-02&lectureEnd=2026-06-30');
    expect(await screen.findByRole('heading', { level: 2, name: '수료증' })).toBeInTheDocument();
    expect(screen.getByText('2026년 03월 02일 ~ 2026년 06월 30일 (15H)')).toBeInTheDocument();
    expect(screen.getByText('수행하였기에 본 증서를 수여합니다.')).toBeInTheDocument();
    expect(screen.getByText('아이넥스평생교육원')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /인쇄/ })).toBeEnabled();
  });
});
