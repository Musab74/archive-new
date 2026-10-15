import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import AdminShellParity, { sideMenuFor } from '../features/admin/pages/site/AdminShellParity';
import { buildPhpParityMenu, phpSectionBadge, phpSideExtras } from '../features/admin/pages/support-menu-parity';
import { SupportRichEditor, editorPhotoExtOk } from '../features/admin/pages/community/SupportRichEditor';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const chrome = { id: 'staff01', name: '김담당', dept: 'B', deptName: '영업1부', team: '교육운영팀', greeting: '김담당 (부서명:교육운영팀)님 안녕하세요.', serverIp: '192.168.0.9', siteName: '에이치알디이', siteAddress: '서울특별시 구로구 디지털로 300', browserTitle: '에이치알디이 (192.168.0.9)' };
const calls: { m: string; url: string; body?: unknown }[] = [];

function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, ''); const method = init?.method ?? 'GET';
    calls.push({ m: method, url, body: init?.body });
    if (url.startsWith('/admin/dashboard/chrome')) return json(chrome);
    if (url.startsWith('/admin/support/editor-photo')) return json({ ok: true, fileName: '20261015181500.png', url: '/upload/webedit/202610/20261015181500.png', html: '<img src="/upload/webedit/202610/20261015181500.png" title="20261015181500.png" ><br style="clear:both;">' });
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

const staff = (dept: string, topGrants: string[], subGrants: string[]) => ({ id: 'staff01', name: '김담당', dept, deptIdx: 2, deptName: '영업1부', topGrants, subGrants, canWrite: true }) as AdminSession;
function mountShell(admin: AdminSession, path: string) {
  const session: AdminSessionState = { phase: 'authed', admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/admin" element={<AdminShellParity />}><Route index element={<p>대시보드 본문</p>} /><Route path="*" element={<p>페이지 본문</p>} /></Route></Routes>
      </MemoryRouter>
    </AdminSessionContext.Provider></ToastProvider></QueryClientProvider>,
  );
}
const topNav = () => screen.getByRole('navigation', { name: '주요 메뉴' });
const sideNav = () => screen.queryByRole('navigation', { name: '하위 메뉴' });

describe('AdminShellParity (include_top.php / include_submenu.php / include_bottom.php)', () => {
  beforeEach(() => { calls.length = 0; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); document.title = ''; });
  afterEach(() => { vi.unstubAllGlobals(); adminTokenStore.clear(); });

  it('dept C with top grant A: no 회원 관리, but 실시간 강의; only exact sub-grant links in the side menu', async () => {
    mountShell(staff('C', ['A', 'B'], ['A1', 'B5']), '/admin/studies');
    const top = topNav();
    expect(within(top).queryByText('회원 관리')).toBeNull();
    expect(within(top).getByText('수강 관리')).toBeInTheDocument();
    expect(within(top).getByText('실시간 강의')).toBeInTheDocument();
    expect(within(top).queryByText('Ruby 관리')).toBeNull();
    expect(within(top).queryByText('모니터링')).toBeNull();
    expect(within(sideNav()!).getAllByRole('link').map((a) => a.textContent)).toEqual(['학습관리', '학습내역관리']);
    await screen.findByText('페이지 본문');
  });

  it('top letter alone shows no link (커뮤니티 F with only F1 → 공지사항 only); Ruby needs F2; 모니터링 is dept A only', async () => {
    mountShell(staff('B', ['F', 'B'], ['F1', 'B1']), '/admin/notices');
    const top = topNav();
    expect(within(top).getByText('커뮤니티관리')).toBeInTheDocument();
    expect(within(top).queryByText('Ruby 관리')).toBeNull();
    expect(within(top).queryByText('모니터링')).toBeNull();
    expect(within(sideNav()!).getAllByRole('link').map((a) => a.textContent)).toEqual(['공지사항']);
    await screen.findByText('페이지 본문');
  });

  it('dept A: Ruby and 모니터링 (with the test badge) without grants; sections still need TopMenuGrant', async () => {
    mountShell(staff('A', ['F'], ['F1']), '/admin/notices');
    const top = topNav();
    expect(within(top).getByText('Ruby 관리')).toBeInTheDocument();
    const mon = within(top).getByText('모니터링').closest('a')!;
    expect(within(mon).getByText('test')).toBeInTheDocument();
    expect(within(top).queryByText('회원 관리')).toBeNull();
    expect(within(top).queryByText('사이트관리')).toBeNull();
    await screen.findByText('페이지 본문');
  });

  it('dashboard: 메인 heading with no links in the left column, Team greeting, footer address and link to /admin', async () => {
    mountShell(staff('B', ['F'], ['F1']), '/admin');
    await screen.findByText('대시보드 본문');
    const side = screen.getByRole('complementary', { name: '관리자 메뉴' });
    expect(within(side).getByRole('heading', { name: '메인' })).toBeInTheDocument();
    expect(within(side).queryAllByRole('link')).toHaveLength(0);
    expect(sideNav()).toBeNull();
    await waitFor(() => expect(screen.getByTestId('admin-greeting')).toHaveTextContent('김담당 (부서명:교육운영팀)님 안녕하세요.'));
    expect(screen.queryByText(/영업1부/)).toBeNull(); // DeptStructure.DeptName is not what include_top.php prints
    expect(await screen.findByText('서울특별시 구로구 디지털로 300')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '관리자 메인으로' })).toHaveAttribute('href', '/admin');
  });

  it('browser title is "<SiteName> (<ServerIP>)" on every admin page, not only the dashboard', async () => {
    mountShell(staff('B', ['F'], ['F1']), '/admin/notices');
    await waitFor(() => expect(document.title).toBe('에이치알디이 (192.168.0.9)'));
  });

  it('사이트관리 left column also lists the [AI] Ruby links for F2 (include_submenu.php case "G")', async () => {
    mountShell(staff('B', ['G'], ['G1', 'F2']), '/admin/site-info');
    const labels = within(sideNav()!).getAllByRole('link').map((a) => a.textContent);
    expect(labels).toEqual(expect.arrayContaining(['사이트 정보 관리', '[AI] Ruby FAQ 관리', '[AI] Ruby 지식베이스', '[AI] 임베딩 재생성']));
    expect(labels).not.toContain('팝업 관리');
    await screen.findByText('페이지 본문');
  });
});

describe('shell helpers', () => {
  it('sideMenuFor: 메인 on /admin, 정보 변경 on /admin/my-info, the page section otherwise', () => {
    const src = { dept: 'B', topGrants: ['F'], subGrants: ['F1', 'F3'] };
    const menu = buildPhpParityMenu(src);
    expect(sideMenuFor('/admin', '', menu, src)).toEqual({ kind: 'main' });
    const my = sideMenuFor('/admin/my-info', '', menu, src);
    expect(my?.kind === 'group' && my.group.label).toBe('정보 변경');
    const c = sideMenuFor('/admin/counsel', '', menu, src);
    expect(c?.kind === 'group' && c.items.map((i) => i.to)).toEqual(['/admin/notices', '/admin/counsel']);
    expect(phpSectionBadge({ key: 'monitoring' })).toBe('test');
    expect(phpSectionBadge({ key: 'site' })).toBeNull();
    expect(phpSideExtras({ dept: 'A', topGrants: [], subGrants: [] }, { key: 'site' })).toHaveLength(3);
    expect(phpSideExtras({ dept: 'B', topGrants: ['G'], subGrants: ['G1'] }, { key: 'site' })).toEqual([]);
  });
});

describe('SupportRichEditor 사진 (SmartEditor2 photo_uploader)', () => {
  beforeEach(() => { calls.length = 0; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); });
  afterEach(() => { vi.unstubAllGlobals(); adminTokenStore.clear(); });
  function Harness() {
    const [v, setV] = useState('<p>본문</p>');
    return <><SupportRichEditor ariaLabel="내용" value={v} onChange={setV} /><output data-testid="value">{v}</output></>;
  }

  it('uploads a picked image to POST /admin/support/editor-photo and inserts the returned <img> tag', async () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: '사진' })).toBeEnabled();
    const input = screen.getByTestId('editor-photo-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], '캡처.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByTestId('value').textContent).toContain('<img src="/upload/webedit/202610/20261015181500.png" title="20261015181500.png"'));
    const call = calls.find((c) => c.url === '/admin/support/editor-photo');
    expect(call?.m).toBe('POST');
    expect(call?.body).toBeInstanceOf(FormData);
    expect(((call!.body as FormData).get('file') as File).name).toBe('캡처.png');
  });

  it('other extensions are refused before upload with the jindo message', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId('editor-photo-input'), { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('JPG, GIF, PNG, BMP 확장자만 가능합니다');
    expect(calls.some((c) => c.url === '/admin/support/editor-photo')).toBe(false);
    expect(editorPhotoExtOk('A.JPG')).toBe(true); expect(editorPhotoExtOk('a.jpeg')).toBe(false); expect(editorPhotoExtOk('bmp')).toBe(false);
  });

  it('onUploadPhoto={null} hides the button; a disabled editor disables it', () => {
    const { unmount } = render(<SupportRichEditor ariaLabel="내용" value="" onChange={() => undefined} onUploadPhoto={null} />);
    expect(screen.queryByRole('button', { name: '사진' })).toBeNull();
    unmount();
    render(<SupportRichEditor ariaLabel="내용" value="" onChange={() => undefined} disabled />);
    expect(screen.getByRole('button', { name: '사진' })).toBeDisabled();
  });
});
