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
    const nav = screen.getByRole('complementary', { name: '관리자 메뉴' });
    expect(nav).toHaveTextContent('회원관리');
    expect(nav).toHaveTextContent('웹사이트 디자인');
    expect(screen.getByText('관리자', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText('자동 로그아웃')).toBeInTheDocument();
    expect(screen.queryByText('조회 권한만 있는 계정입니다. 변경할 수 없습니다.')).not.toBeInTheDocument();
  });

  it('renders a grant-gated list page with the DataTable', async () => {
    vi.stubGlobal('fetch', apiMock({ adminSession: true }));
    mount('/admin/members?q=sleep');
    expect(await screen.findByRole('heading', { level: 1, name: '회원 목록' })).toBeInTheDocument();
    expect(await screen.findByText('sleep01')).toBeInTheDocument();
    expect(screen.getByText('휴면', { selector: 'span' })).toBeInTheDocument();
  });

  it('sends guests on /manager to the learner login', async () => {
    vi.stubGlobal('fetch', apiMock({ adminSession: false }));
    mount('/manager/trainees');
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
  });
});
