import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from '../app/router';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import { tokenStore } from '../shared/auth/tokenStore';
import { STAFF_LIST_GRANT, staffExportFallbackName, staffListAllowed } from '../features/admin/pages/members/staffParity';

/**
 * include_submenu.php: 관리자/영업자/첨삭강사 리스트 need the exact sub code (A6/A7/A8) outside dept A; and the two
 * "검색항목 엑셀 출력" buttons now download the .xlsx the API serves (staff02_excel.php / read_reason_excel.php).
 */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deptA = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A'], subGrants: ['A6', 'A7', 'A8', 'A9'], canWrite: true };
const salesTopOnly = { id: 'sales01', name: '영업', dept: 'B', deptIdx: 5, deptName: '1팀', topGrants: ['A'], subGrants: ['A1', 'A2'], canWrite: false };
const salesWithA7 = { ...salesTopOnly, subGrants: ['A1', 'A7'] };
const salesRow = { idx: 2, id: 'sales01', dept: 'B', deptLabel: '영업자', deptIdx: 5, deptName: '1팀', deptString: '4|5|', name: '영업', team: '영업부', mobile: '010-8888-0000', phone: null, email: 's@x', bankName: '농협', bankNumber: '123', lastLogin: null, lastLoginIp: null, useYN: 'Y', regDate: '2026-10-12 10:00:00', commissionRatio: 10 };
const privacy = { items: [], page: 1, size: 30, total: 0 };
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const calls: string[] = [];
function apiMock(admin: typeof deptA, exportHeaders: Record<string, string> = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/auth/admin/refresh')) return json({ accessToken: 'adm', expiresIn: 900, admin });
    if (url.endsWith('/auth/admin/me')) return json(admin);
    if (url.endsWith('/auth/refresh')) return json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401);
    if (url.includes('/admin/staff-members/export') || url.includes('/admin/privacy-log/export')) return new Response(new Blob([new Uint8Array([0x50, 0x4b, 3, 4])]), { status: 200, headers: { 'Content-Type': XLSX, ...exportHeaders } });
    if (url.includes('/admin/staff-members')) return json({ items: [salesRow], page: 1, size: 30, total: 1 });
    if (url.includes('privacy-log')) return json(privacy);
    if (url.endsWith('/public/design')) return json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
    return json({ items: [], page: 1, size: 30, total: 0 });
  });
}
const mount = (path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><RouterProvider router={memory} /></MotionConfig></QueryClientProvider>);
  return memory;
};
function captureDownloads() {
  const names: string[] = [];
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) { if (this.download) names.push(this.download); };
  return { names, restore: () => { HTMLAnchorElement.prototype.click = orig; } };
}
const ymd = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };

describe('staff list grants (include_submenu.php A6/A7/A8)', () => {
  it('needs the exact sub code outside dept A; the top letter alone is not enough', () => {
    expect(STAFF_LIST_GRANT).toEqual({ A: 'A6', B: 'A7', C: 'A8' });
    expect(staffListAllowed(deptA, 'C')).toBe(true);
    expect(staffListAllowed({ dept: 'A', subGrants: [] }, 'B')).toBe(true);
    expect(staffListAllowed(salesTopOnly, 'B')).toBe(false);
    expect(staffListAllowed(salesWithA7, 'B')).toBe(true);
    expect(staffListAllowed(salesWithA7, 'A')).toBe(false);
    expect(staffListAllowed(null, 'B')).toBe(false);
    expect(staffExportFallbackName('B', '20261015')).toBe('영업자목록_20261015.xlsx');
  });
});

describe('staff pages: gate and Excel downloads', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); adminTokenStore.clear(); calls.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('a 영업자 account with top A but only A1/A2 gets the no-permission page and no list call', async () => {
    vi.stubGlobal('fetch', apiMock(salesTopOnly));
    mount('/admin/staff-list/B');
    expect(await screen.findByText('메뉴 권한이 없습니다.')).toBeInTheDocument();
    expect(calls.some((u) => u.includes('/admin/staff-members?'))).toBe(false);
  });

  it('the same account with A7 sees the 영업자 list', async () => {
    vi.stubGlobal('fetch', apiMock(salesWithA7));
    mount('/admin/staff-list/B');
    expect(await screen.findByText('sales01')).toBeInTheDocument();
    expect(screen.queryByText('메뉴 권한이 없습니다.')).not.toBeInTheDocument();
  });

  it('영업자 리스트 엑셀: saves the server .xlsx name; falls back to 영업자목록_YYYYMMDD.xlsx', async () => {
    const dl = captureDownloads();
    try {
      vi.stubGlobal('fetch', apiMock(deptA, { 'Content-Disposition': `attachment; filename="staff_B_20261015.xlsx"; filename*=UTF-8''${encodeURIComponent('영업자목록_20261015.xlsx')}` }));
      mount('/admin/staff-list/B');
      expect(await screen.findByText('sales01')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /검색항목 엑셀 출력/ }));
      await waitFor(() => expect(dl.names).toEqual(['영업자목록_20261015.xlsx']));
      expect(calls.find((u) => u.includes('/admin/staff-members/export'))).toContain('dept=B');
    } finally { dl.restore(); }
  });

  it('개인정보 열람내역 엑셀 without a readable Content-Disposition uses 개인정보 열람내역_YYYYMMDD.xlsx', async () => {
    const dl = captureDownloads();
    try {
      vi.stubGlobal('fetch', apiMock(deptA));
      mount('/admin/privacy-log');
      const btn = await screen.findByRole('button', { name: /검색항목 엑셀 출력/ });
      fireEvent.click(btn);
      await waitFor(() => expect(dl.names).toEqual([`개인정보 열람내역_${ymd()}.xlsx`]));
    } finally { dl.restore(); }
  });
});
