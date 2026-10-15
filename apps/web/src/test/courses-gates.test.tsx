import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import ContentDetailPage from '../features/admin/pages/courses/ContentDetailPage';
import ContentsPage, { SIZE as CONTENTS_SIZE } from '../features/admin/pages/courses/ContentsPage';
import CourseEditPage from '../features/admin/pages/courses/CourseEditPage';
import CoursesPage from '../features/admin/pages/courses/CoursesPage';
import ListsPage from '../features/admin/pages/courses/ListsPage';
import ChapterExcelPage from '../features/admin/pages/courses/ChapterExcelPage';
import { CTYPE_GRANT, courseRowGrants, ctypeGrants, hasAnyGrant } from '../features/admin/pages/courses/courses-parity.grants';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const op = (topGrants: string[], subGrants: string[], dept = 'C'): AdminSession => ({ id: 'op01', name: '운영자', dept, deptIdx: 3, deptName: '운영', topGrants, subGrants, canWrite: true }) as AdminSession;
const sessionOf = (admin: AdminSession): AdminSessionState => ({ phase: 'authed', admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true });

const content = (over: Record<string, unknown> = {}) => ({ idx: 5, gubun: '구분', title: '1강', lectureTimeMin: 25, goal: '목표', trainingContents: '내용', activities: '활동', regDate: null, deleted: false, details: [], usedIn: [], nextDetailOrder: 1, ...over });
let contentOver: Record<string, unknown> = {};
const calls: string[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, ''); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (url.startsWith('/admin/contents/excel-temp')) return json({ total: 0, errorCount: 0, items: [] });
    if (url.startsWith('/admin/courses/excel-temp')) return json({ ctype: 'X', total: 0, errorCount: 0, items: [] });
    if (url.startsWith('/admin/chapters/excel-temp')) return json({ total: 0, errorCount: 0, items: [] });
    if (url.startsWith('/admin/contents/meta')) return json({ contentsTypes: [], teachers: [], servers: { flash: '', movie: '', mobile: '' } });
    if (url.startsWith('/admin/contents/options')) return json({ gubuns: [], contents: [] });
    if (url.startsWith('/admin/contents/5')) return json(content(contentOver));
    if (url.startsWith('/admin/contents?')) return json({ items: [], page: 1, size: 30, total: 0 });
    if (url.startsWith('/admin/courses?')) return json({ items: [], page: 1, size: 30, total: 0 });
    if (url.startsWith('/admin/courses/9')) return json({ error: { code: 'FORBIDDEN', message: '해당 메뉴 권한이 없습니다.' } }, 403);
    if (url === '/admin/lists') return json({ items: [] });
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (el: ReactElement, admin: AdminSession, path: string, route: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={sessionOf(admin)}><MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={el} /></Routes></MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};
const noAccess = () => screen.findByText('메뉴 권한이 없습니다.');

describe('컨텐츠관리 fix-ups: excel routes, D2/D6/E1-3/E5 gates, page size, deleted 기초차시', () => {
  beforeEach(() => { calls.length = 0; contentOver = {}; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('grant helpers: ctype → E1/E2/E3, packages → D6, top-menu letter accepted like the API', () => {
    expect(CTYPE_GRANT).toEqual({ X: 'E1', Z: 'E2', Y: 'E3' });
    expect(ctypeGrants('Z')).toEqual(['E2']);
    expect(ctypeGrants('W')).toEqual(['E1', 'E2', 'E3']);
    expect(courseRowGrants(true, 'A')).toEqual(['D6']);
    expect(hasAnyGrant(op(['D'], ['D1']), ['E1'])).toBe(false);
    expect(hasAnyGrant(op(['E'], []), ['E1'])).toBe(true);
    expect(hasAnyGrant(op([], [], 'A'), ['D6'])).toBe(true);
  });

  it('/admin/contents/excel matched by contents/:idx renders the 기초차시 엑셀 등록 page (no NaN lookup)', async () => {
    mount(<ContentDetailPage />, op(['D'], ['D2']), '/admin/contents/excel', '/admin/contents/:idx');
    expect(await screen.findByText('기초차시 엑셀 등록')).toBeTruthy();
    await waitFor(() => expect(calls).toContain('GET /admin/contents/excel-temp'));
    expect(calls.some((c) => /\/admin\/contents\/(NaN|excel)$/.test(c))).toBe(false);
  });

  it('/admin/courses/excel?ctype=Z matched by courses/:idx renders the 마이크로닝 엑셀 등록 page', async () => {
    mount(<CourseEditPage />, op(['E'], ['E2']), '/admin/courses/excel?ctype=Z', '/admin/courses/:idx');
    expect(await screen.findByText('마이크로닝 엑셀 등록')).toBeTruthy();
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/courses/excel-temp?ctype=Z'))).toBe(true));
  });

  it('the upload row accepts .xls and says so', async () => {
    const { container } = mount(<ContentDetailPage />, op(['D'], ['D2']), '/admin/contents/excel', '/admin/contents/:idx');
    await screen.findByText('기초차시 엑셀 등록');
    expect(container.querySelector('#xl-file')?.getAttribute('accept')).toBe('.xlsx,.xls,.csv');
    expect(screen.getByText(/\.xls\(Excel 97-2003\)/)).toBeTruthy();
  });

  it('기초차시 관리 needs D2 (or top menu D, like AdminGuard): a D1-only operator without top D gets the no-grant block', async () => {
    mount(<ContentsPage />, op([], ['D1']), '/admin/contents', '/admin/contents');
    expect(await noAccess()).toBeTruthy();
    expect(calls.filter((c) => c.startsWith('GET /admin/contents?'))).toHaveLength(0);
  });
  it('기초차시 관리 list asks for size=30 (include_top.php $page_size)', async () => {
    expect(CONTENTS_SIZE).toBe(30);
    mount(<ContentsPage />, op([], ['D2']), '/admin/contents', '/admin/contents');
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/contents?') && c.includes('size=30'))).toBe(true));
  });

  it('a deleted (Del=Y) 기초차시 shows only the notice and 목록, like contents_read.php', async () => {
    contentOver = { deleted: true };
    mount(<ContentDetailPage />, op(['D'], ['D2']), '/admin/contents/5', '/admin/contents/:idx');
    expect(await screen.findByText(/삭제된\(Del=Y\) 기초차시입니다 \(#5\)/)).toBeTruthy();
    expect(screen.queryByText('기초차시 수정')).toBeNull();
    expect(screen.queryByText('기초차시 삭제')).toBeNull();
    expect(screen.queryByText('추가 하기')).toBeNull();
    expect(screen.getByText('목록')).toBeTruthy();
  });
  it('a live 기초차시 still shows 수정 / 삭제 / 상세 구성', async () => {
    mount(<ContentDetailPage />, op(['D'], ['D2']), '/admin/contents/5', '/admin/contents/:idx');
    expect(await screen.findByText('기초차시 수정')).toBeTruthy();
    expect(screen.getByText('추가 하기')).toBeTruthy();
  });

  it('course.php lists need E1/E2/E3 per ctype; 패키지 needs D6 — a D operator cannot open 이러닝', async () => {
    mount(<CoursesPage />, op(['D'], ['D1', 'D6']), '/admin/courses?ctype=X', '/admin/courses');
    expect(await noAccess()).toBeTruthy();
    expect(calls.filter((c) => c.startsWith('GET /admin/courses?'))).toHaveLength(0);
  });
  it('a D6 operator opens 패키지컨텐츠관리', async () => {
    mount(<CoursesPage />, op(['D'], ['D6']), '/admin/courses?packageYN=Y', '/admin/courses');
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/courses?') && c.includes('packageYN=Y'))).toBe(true));
    expect(screen.queryByText('메뉴 권한이 없습니다.')).toBeNull();
  });
  it('an E1-only operator (no top E) opens 이러닝 but not 패키지', async () => {
    const first = mount(<CoursesPage />, op([], ['E1']), '/admin/courses?ctype=X', '/admin/courses');
    await waitFor(() => expect(calls.some((c) => c.startsWith('GET /admin/courses?') && c.includes('ctype=X'))).toBe(true));
    first.unmount();
    mount(<CoursesPage />, op([], ['E1']), '/admin/courses?packageYN=Y', '/admin/courses');
    expect(await noAccess()).toBeTruthy();
  });
  it('a course row the API refuses (403) shows the no-access block instead of an error', async () => {
    mount(<CourseEditPage />, op(['D'], ['D6']), '/admin/courses/9', '/admin/courses/:idx');
    expect(await screen.findByText('이용권한을 확인해 주세요.')).toBeTruthy();
  });
  it('차시 엑셀 등록 needs E1/E2/E3', async () => {
    mount(<ChapterExcelPage />, op(['D'], ['D1', 'D2']), '/admin/chapters/excel?ctype=X', '/admin/chapters/excel');
    expect(await noAccess()).toBeTruthy();
  });

  it('PICK/TOP/NEW needs E5: D1 is refused, E5 opens it', async () => {
    const first = mount(<ListsPage />, op(['D'], ['D1', 'D2']), '/admin/lists', '/admin/lists');
    expect(await noAccess()).toBeTruthy();
    first.unmount();
    mount(<ListsPage />, op([], ['E5']), '/admin/lists', '/admin/lists');
    await waitFor(() => expect(calls).toContain('GET /admin/lists'));
  });
});
