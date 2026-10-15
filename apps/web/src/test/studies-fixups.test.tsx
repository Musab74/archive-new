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

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Admin = NonNullable<AdminSessionState['admin']>;
/** 영업 account with 학습관리 (B5) but no 사업주 관리 (A1) — the case company_info_pop.php still serves. */
const b5Only = { id: 'sales01', name: '영업', dept: 'B', deptIdx: 5, deptName: '영업팀', topGrants: ['B'], subGrants: ['B5'], canWrite: true } as unknown as Admin;
const a1Admin = { ...b5Only, id: 'mgr', topGrants: ['A', 'B'], subGrants: ['A1', 'B5'] } as unknown as Admin;
const sessionOf = (admin: Admin): AdminSessionState => ({ phase: 'authed' as AdminSessionState['phase'], admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin, logout: async () => {}, extend: async () => true });

const options = { years: [2026], thisYear: 2026, packageCourses: [], tutors: [], salesStaff: [], periods: [], pageSizes: [10, 30, 50, 70, 100, 120, 150, 200], canWrite: true, showTutorFilter: false, canChangeServiceType: false };
const pre = { label: 'Y', submitted: true, date: null, showResume: false, open: null, grantExpiresAt: null };
const post = { yn: 'N', date: null, open: null, openReason: null, grantExpiresAt: null };
const row = { studySeq: 7, id: 'user01', name: '홍길동', depart: '총무팀', serviceType: 'A', serviceTypeLabel: '패키지(환급)', lectureCode: 'ARC2026', courseName: '아카이브 2026', lectureStart: '2026-03-02', lectureEnd: '2026-05-31', termeIdx: 3, seconds: 55000, studyTimeLabel: '15시간 16분', percent: 100, storedProgress: 100, passOk: 'Y', passOkLabel: '수료', certificateLink: true, studyEnd: 'N', tutorName: '강사', salesName: '영업', salesTeam: '1팀', companyCode: '1234567890', companyName: '테스트기업', companyIdx: 55, certDate: null, openChapter: 1, inputDate: '2026-02-20 10:00:00', pre, post };
const company = {
  idx: 55, companyScale: 'A', companyScaleLabel: '대규모', companyName: '테스트기업', companyCode: '1234567890', hrd: 'H1', companyId: 'testco', ceo: '대표', tel: '02-111-2222', tel2: '1588-0000', csEnabled: true,
  uptae: '서비스', upjong: '교육', fax: '', fax2: '', zipcode: '06000', address01: '서울', address02: '1층', bankName: '국민은행', bankNumber: '123', email: 'a@b.c', homePage: 'h', eduManager: '김담당', eduManagerPhone: '010-1', eduManagerEmail: 'e@x',
  salesManager: 'sales01', salesName: '영업', remark: '메모', cyberUrl: 'cyber', cyberEnabled: false, sendSms: 'Y', sendSmsLabel: '수신', salesDeptName: '본부 > 1팀',
};
const companyInfo = {
  company,
  studies: [{ no: 1, lectureCode: 'ARC2026', contentsName: '아카이브 2026', lectureStart: '2026-03-02', lectureEnd: '2026-05-31', studyCount: 4, passCount: 1, passRatio: 25, price: 100000, rPrice: 80000 }],
  members: [{ no: 1, id: 'user01', name: '홍길동', birthDay: '1990-****-01', genderLabel: '남', email: '*******@test.com', mobile: '010-****-5678', depart: '총무팀', position: '대리', lastLogin: null, regDate: '2025-01-01', useYNLabel: '사용' }],
};
const sheet = { kind: 'completion', title: '수료증', siteName: '아이넥스평생교육원', issueDate: '2026-10-15', issueDateLabel: '2026 년  10월  15일', body: ['위 사람은'], items: [{ id: 'user01', studySeq: 7, name: '홍길동', birthDay: '1990-01-01', companyName: '테스트기업', courseName: '아카이브 2026', lectureCode: 'ARC2026', contentsTime: null, lectureStart: '2026-03-02', lectureEnd: '2026-05-31', periodLabel: '2026년 03월 02일 ~ 2026년 05월 31일', seconds: 55000, hours: 15 }] };

function apiMock(calls: string[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/^.*\/v1/, '')}`);
    if (url.includes('/admin/studies/manage/options')) return json(options);
    if (url.includes('/admin/studies/manage')) return json({ items: [row], page: 1, size: 30, total: 1, canWrite: true });
    if (url.includes('/admin/learning/terms')) return json({ year: 2026, month: null, companyCode: null, items: [] });
    if (url.includes('/admin/studies/company-info/1234567890')) return json(companyInfo);
    if (url.includes('/admin/studies/7/certificate/print')) return json(sheet);
    if (url.includes('/admin/studies/progress-log/excel')) return new Response('PK', { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': "attachment; filename=\"progress_log_search.xlsx\"; filename*=UTF-8''ARC2026_1%ED%9A%8C%EC%B0%A8_%EC%A7%84%EB%8F%84%EB%A1%9C%EA%B7%B8_20261015.xlsx" } });
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

function mount(ui: ReactNode, path: string, route: string, admin: Admin = b5Only) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><AdminSessionContext.Provider value={sessionOf(admin)}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={ui} /></Routes></MemoryRouter>
    </AdminSessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>,
  );
}

describe('학습관리 verifier fix-ups', () => {
  let calls: string[];
  beforeEach(() => { calls = []; adminTokenStore.clear(); vi.stubGlobal('fetch', apiMock(calls)); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('사업주 click opens company_info_pop (B5 endpoint) for an account without A1 — card, 수강 정보, masked 수강생 정보, no company-page link', async () => {
    mount(<StudiesPage />, '/admin/studies?go=1', '*');
    fireEvent.click(await screen.findByRole('button', { name: '테스트기업' }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('본부 > 1팀')).toBeInTheDocument();
    for (const t of ['회사 규모', 'HRD 번호', '고객센터 전화번호', '교육 담당자', '독려문자 수신', '영업팀 카테고리', '수강 정보', '수강생 정보']) expect(within(drawer).getAllByText(t).length).toBeGreaterThan(0);
    expect(within(drawer).getByText('김담당 / 010-1 / e@x')).toBeInTheDocument();
    expect(within(drawer).getByText('4 / 1')).toBeInTheDocument();
    expect(within(drawer).getByText('25%')).toBeInTheDocument();
    expect(within(drawer).getByText('*******@test.com')).toBeInTheDocument();
    expect(within(drawer).queryByRole('link', { name: '사업주 상세 페이지' })).toBeNull();
    expect(calls.some((c) => c === 'GET /admin/studies/company-info/1234567890')).toBe(true);
    expect(calls.some((c) => c.includes('/admin/companies'))).toBe(false);
  });

  it('A1 holders also get the link to the full 사업주 page', async () => {
    mount(<StudiesPage />, '/admin/studies?go=1', '*', a1Admin);
    fireEvent.click(await screen.findByRole('button', { name: '테스트기업' }));
    expect(await screen.findByRole('link', { name: '사업주 상세 페이지' })).toHaveAttribute('href', '/admin/companies/55');
  });

  it('수료증 PDF로 출력하기 target (/admin/studies/:seq?print=certificate) renders the certificate on the existing studies/:seq route', async () => {
    mount(<StudyDetailPage />, '/admin/studies/7?print=certificate', '/admin/studies/:seq');
    expect(await screen.findByLabelText('수료증 홍길동')).toBeInTheDocument();
    expect(screen.getByText('2026년 03월 02일 ~ 2026년 05월 31일 (15H)')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('GET /admin/studies/7/certificate/print'))).toBe(true);
    expect(calls.some((c) => c === 'GET /admin/studies/7')).toBe(false);
  });

  it('체크 항목 진도로그 엑셀 출력 downloads the .xlsx endpoint (not the CSV)', async () => {
    mount(<StudiesPage />, '/admin/studies?go=1', '*');
    fireEvent.click(await screen.findByLabelText('Seq 7'));
    fireEvent.click(screen.getByRole('button', { name: '체크 항목 진도로그 엑셀 출력' }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: '출력' }));
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/studies/progress-log/excel?seqs=7'))).toBe(true));
    expect(calls.some((c) => c.includes('/admin/studies/progress-log/export'))).toBe(false);
  });
});
