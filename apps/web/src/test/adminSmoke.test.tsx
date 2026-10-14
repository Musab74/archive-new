import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from '../app/router';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import { tokenStore } from '../shared/auth/tokenStore';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], subGrants: ['A1', 'A2', 'B1', 'B2', 'C1', 'D1', 'E1', 'F1', 'G1'], canWrite: true };
const dashboard = { today: '2026-10-12', monthStart: '2026-10-01', logins: { today: 7, uniqueUsers: 3 }, activePlayers: { count: 0, freshnessSeconds: 90 }, learnersOver15hThisMonth: 1, activeEnrollments: 2, emon: { pending: 3, pendingStale: 0 }, support: { openInquiries: 0, openCounsel: 0 }, signupsToday: 4 };
const companies = { items: [{ idx: 2144, companyCode: '7568002646', bizNo: '756-80-02646', companyName: '(A)+기쁨드림방문요양센터', scale: 'C', scaleLabel: '우선지원대상', companyId: 't003', manageCode: 't003', cyberEnabled: false, eduManager: '이명아', eduManagerPhone: '010-9960-1163', eduManagerEmail: '77malee@naver.com', sendSMS: 'Y', sendSMSLabel: '수신허용', salesManager: 't000', salesName: '탑플러스', salesTeam: '탑플러스', regDate: '2026-10-01 09:00:00' }], page: 1, size: 20, total: 1 };
const companyMeta = { scales: [{ value: 'C', label: '우선지원대상' }, { value: 'A', label: '대규모 1000인 이상' }, { value: 'B', label: '대규모 1000인 미만' }], sendSMS: [{ value: 'Y', label: '수신허용' }, { value: 'N', label: '수신거부' }], yn: [], banks: ['국민은행'], salesManagers: [{ id: 't000', name: '탑플러스', team: '탑플러스', mobile: null, deptIdx: 2, deptName: '영업부' }] };
const members = { items: [{ idx: 4, id: 'sleep01', name: '휴면', memberType: 'A', companyCode: '1234567890', companyName: '테스트기업', depart: null, position: null, useYN: 'Y', eduManager: false, testId: false, protectId: 'Y', sleep: true, memberOut: false, lastLogin: null, regDate: '2026-10-12 17:49:44', passChange: 'Y', enrollments: 0 }], page: 1, size: 20, total: 1 };

/** Routes fetch by URL so pages render against the real API shapes captured from the local seed. */
function apiMock(opts: { adminSession: boolean }) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.endsWith('/auth/admin/refresh')) return opts.adminSession ? json({ accessToken: 'adm', expiresIn: 900, admin }) : json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401);
    if (url.endsWith('/auth/admin/me')) return json(admin);
    if (url.endsWith('/auth/refresh')) return json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401);
    if (url.endsWith('/admin/dashboard')) return json(dashboard);
    if (url.includes('/admin/members')) return json(members);
    if (url.endsWith('/admin/companies/meta')) return json(companyMeta);
    if (url.includes('/admin/companies')) return json(companies);
    if (url.endsWith('/public/design')) return json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

const mount = (path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><RouterProvider router={memory} /></MotionConfig></QueryClientProvider>);
};

describe('admin + manager routes', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); adminTokenStore.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('redirects /admin to /admin/login when there is no staff session', async () => {
    vi.stubGlobal('fetch', apiMock({ adminSession: false }));
    mount('/admin/members');
    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
    expect(screen.getByLabelText(/2차 인증/)).toBeInTheDocument();
  });

  it('renders the dashboard, sidebar menu from grants and the countdown for a staff session', async () => {
    vi.stubGlobal('fetch', apiMock({ adminSession: true }));
    mount('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: '대시보드' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('EMON 전송함 →')).toBeInTheDocument());
    const top = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(top).toHaveTextContent('회원 관리');
    expect(top).toHaveTextContent('모니터링');
    expect(top).toHaveTextContent('사이트관리');
    const side = screen.getByRole('complementary', { name: '관리자 메뉴' });
    expect(side).toHaveTextContent('사업주 관리'); // first section (회원 관리) is shown on the dashboard
    expect(screen.getByText(/관리자 \(LMS개발부\)님 안녕하세요/)).toBeInTheDocument();
    expect(screen.getByText(/자동 로그아웃/)).toBeInTheDocument();
    expect(screen.queryByText('조회 권한만 있는 계정입니다. 변경할 수 없습니다.')).not.toBeInTheDocument();
  });

  it('renders a grant-gated list page with the DataTable', async () => {
    vi.stubGlobal('fetch', apiMock({ adminSession: true }));
    mount('/admin/members?q=sleep');
    expect(await screen.findByRole('heading', { level: 1, name: '회원 목록' })).toBeInTheDocument();
    expect(await screen.findByText('sleep01')).toBeInTheDocument();
    expect(screen.getByText('휴면', { selector: 'span' })).toBeInTheDocument();
  });

  it('renders 사업주 관리 with the legacy columns, the sidebar entry and the 신규 등록 action', async () => {
    vi.stubGlobal('fetch', apiMock({ adminSession: true }));
    mount('/admin/companies?q=기쁨');
    expect(await screen.findByRole('heading', { level: 1, name: '사업주 관리' })).toBeInTheDocument();
    expect(await screen.findByText('(A)+기쁨드림방문요양센터')).toBeInTheDocument();
    expect(screen.getByText('756-80-02646')).toBeInTheDocument();
    expect(screen.getAllByText('수신허용').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: /기업관리코드/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신규 등록' })).toBeEnabled();
    expect(screen.getByRole('complementary', { name: '관리자 메뉴' })).toHaveTextContent('사업주 관리');
  });

  it('sends guests on /manager to the learner login', async () => {
    vi.stubGlobal('fetch', apiMock({ adminSession: false }));
    mount('/manager/trainees');
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
  });
});
