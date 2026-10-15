import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from '../app/router';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import { tokenStore } from '../shared/auth/tokenStore';
import { deepColour, emptyStaffForm, joinPhone, splitPhone, staffIdError, treeByIdx, validateStaffForm, visibleTree } from '../features/admin/pages/members/staffParity';
import { treeOrder } from '../features/admin/pages/members/DepartmentsPage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], subGrants: ['A1', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'], canWrite: true };
const salesRow = { idx: 2, id: 'sales01', dept: 'B', deptLabel: '영업자', deptIdx: 5, deptName: '1팀', deptString: '4|5|', name: '영업', team: '영업부', mobile: '010-8888-0000', phone: null, email: 's@x', bankName: '농협', bankNumber: '123', lastLogin: null, lastLoginIp: null, useYN: 'Y', regDate: '2026-10-12 10:00:00', commissionRatio: 10 };
const staffDetail = { staff: { ...salesRow, deptPath: '영업본부 > 1팀' }, loginCount: 21, loginHistory: [] };
const logins = { items: [{ no: 21, ip: '1.2.3.4', device: 'PC', at: '2026-10-12 09:00:00' }, { no: 20, ip: '1.2.3.5', device: 'PC', at: '2026-10-11 09:00:00' }], page: 1, size: 20, total: 21 };
const grantsB = { top: [{ code: 'A', label: '회원관리' }, { code: 'B', label: '수강관리' }], sub: { A: [{ code: 'A1', label: '사업주관리' }, { code: 'A2', label: '수강생관리' }], B: [{ code: 'B5', label: '학습관리' }] } };
const departments = {
  items: [
    { idx: 4, dept: 'B', deptLabel: '영업자', parent: 0, deep: 1, name: '영업본부', deptString: '4|', topMenuGrant: 'A', subMenuGrant: 'A1', order: 2, children: 1, descendants: 1, staff: 0 },
    { idx: 5, dept: 'B', deptLabel: '영업자', parent: 4, deep: 2, name: '1팀', deptString: '4|5|', topMenuGrant: 'A', subMenuGrant: 'A1', order: 1, children: 0, descendants: 0, staff: 1 },
    { idx: 1, dept: 'A', deptLabel: '관리자', parent: 0, deep: 1, name: 'LMS개발부', deptString: '1|', topMenuGrant: 'A', subMenuGrant: 'A1', order: null, children: 0, descendants: 0, staff: 1 },
  ],
  salesOrder: [{ idx: 5, deep: 2, name: '1팀', order: 1, descendants: 0, salesCount: 1 }, { idx: 4, deep: 1, name: '영업본부', order: 2, descendants: 1, salesCount: 0 }],
  grants: { top: [{ code: 'A', label: '회원관리' }, { code: 'D', label: '컨텐츠관리' }], sub: { A: [{ code: 'A1', label: '사업주관리' }] }, byDept: { A: { top: [{ code: 'A', label: '회원관리' }, { code: 'D', label: '컨텐츠관리' }], sub: { A: [{ code: 'A1', label: '사업주관리' }], D: [{ code: 'D1', label: '과정카테고리 관리' }] } }, B: grantsB, C: { top: [{ code: 'B', label: '수강관리' }], sub: { B: [{ code: 'B5', label: '학습관리' }] } } } },
};
const categories = { dept: 'B', deptLabel: '영업자', items: [{ idx: 4, parent: 0, deep: 1, name: '영업본부', deptString: '4|', children: 1, path: '영업본부' }, { idx: 5, parent: 4, deep: 2, name: '1팀', deptString: '4|5|', children: 0, path: '영업본부 > 1팀' }] };
const withdrawn = { items: [{ idx: 9, id: 'out01', name: '탈퇴자', companyCode: 'x', companyName: null, companyLabel: '일반회원', birthDay: '1990-****-01', gender: 'F', genderLabel: '여성', email: '*******@x.com', mobile: '010-****-1234', depart: null, position: null, lastLogin: null, regDate: '2026-01-02 03:04:05', memberOutDate: '2026-02-03 04:05:06' }], page: 1, size: 30, total: 1 };
const privacy = { items: [{ idx: 1, targetId: 'user01', targetName: '홍길동', adminId: 'admin01', table: 'Member', field: '휴대폰', gubun: '기타 상담', reason: '상담 확인', url: '/x', at: '2026-10-01 10:00:00' }], page: 1, size: 30, total: 1 };

const calls: { url: string; method: string; body: unknown }[] = [];
function apiMock(over: { staffItems?: unknown[] } = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith('/auth/admin/refresh')) return json({ accessToken: 'adm', expiresIn: 900, admin });
    if (url.endsWith('/auth/admin/me')) return json(admin);
    if (url.endsWith('/auth/refresh')) return json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401);
    if (url.includes('/admin/staff-members/id-check')) return json({ id: 'newid1', valid: true, available: true, message: '[ 등록이 가능한 아이디입니다. ]' });
    if (url.includes('/admin/staff-members/categories')) return json(categories);
    if (url.includes('/admin/staff-members/2/logins')) return json(logins);
    if (url.endsWith('/admin/staff-members/2/login-as')) return json({ accessToken: 'swapped', expiresIn: 900, admin: { ...admin, id: 'sales01', dept: 'B', canWrite: false } });
    if (url.endsWith('/admin/staff-members/2')) return json(staffDetail);
    if (url.includes('/admin/staff-members')) return json({ items: over.staffItems ?? [salesRow], page: 1, size: 30, total: (over.staffItems ?? [salesRow]).length });
    if (url.endsWith('/admin/departments')) return json(departments);
    if (url.includes('/admin/withdrawn-members')) return json(withdrawn);
    if (url.includes('/admin/members/privacy-log')) return json(privacy);
    if (url.endsWith('/public/design')) return json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><RouterProvider router={memory} /></MotionConfig></QueryClientProvider>);
  return memory;
};

describe('staff parity helpers', () => {
  it('tree order by idx, collapsed visibility, deep colours', () => {
    const items = [{ idx: 9, parent: 0, deep: 1 }, { idx: 3, parent: 9, deep: 2 }, { idx: 2, parent: 0, deep: 1 }, { idx: 7, parent: 9, deep: 2 }, { idx: 8, parent: 3, deep: 3 }];
    const ordered = treeByIdx(items);
    expect(ordered.map((n) => n.idx)).toEqual([2, 9, 3, 8, 7]);
    expect(visibleTree(ordered, new Set()).map((n) => n.idx)).toEqual([2, 9]);
    expect(visibleTree(ordered, new Set([9])).map((n) => n.idx)).toEqual([2, 9, 3, 7]);
    expect(visibleTree(ordered, new Set([3])).map((n) => n.idx)).toEqual([2, 9]); // parent collapsed hides the grandchild
    expect(treeOrder(departments.items, 'B').map((n) => n.idx)).toEqual([4, 5]);
    expect(deepColour(1)).toBe('#f2f2f2'); expect(deepColour(3)).toBe('#ffdddd'); expect(deepColour(12)).toBeNull();
  });
  it('form rules of staffNN_write.php SubmitOk() + ID_Validity', () => {
    expect(emptyStaffForm().Pwd).toBe('1111');
    expect(staffIdError('ab')).toBe('아이디는 4자이상 20자 이내로 입력하세요.');
    expect(staffIdError('ab_cd')).toBe('아이디는 영문/숫자만 입력 가능합니다.');
    const e = validateStaffForm({ ...emptyStaffForm(), ID: 'sales9' }, 'create', 'B');
    expect(Object.values(e)).toEqual(['카테고리를 선택하세요.', '이름을 입력하세요.', '소속을 입력하세요.', '휴대폰을 입력하세요.', '이메일을 입력하세요.', '영업자 수수료율을 입력하세요.']);
    const ok = { ...emptyStaffForm(), ID: 'sales9', Dept_idx: '5', Name: 'n', Team: 't', Mobile1: '010', Mobile2: '1', Mobile3: '2', Email: 'e', CommissionRatio: '1.5' };
    expect(validateStaffForm(ok, 'create', 'B')).toEqual({ CommissionRatio: '영업자 수수료율은 숫자만(정수) 입력하세요.' });
    expect(validateStaffForm({ ...ok, CommissionRatio: '' }, 'create', 'A')).toEqual({});
    expect(splitPhone('010-1234-5678')).toEqual(['010', '1234', '5678']);
    expect(joinPhone('010', '1234', '5678')).toBe('010-1234-5678');
    expect(joinPhone('', '', '')).toBe('');
  });
});

describe('staff parity pages', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); adminTokenStore.clear(); calls.length = 0; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('영업자 리스트: 이름 search by default, 30 rows, excel export, detail with 카테고리 + numbered 로그인 내역, 현재 아이디로 로그인', async () => {
    vi.stubGlobal('fetch', apiMock());
    const memory = mount('/admin/staff-list/B');
    expect(await screen.findByText('sales01')).toBeInTheDocument();
    const listCall = calls.find((c) => c.url.includes('/admin/staff-members?'))!;
    expect(listCall.url).toContain('col=Name');
    expect(listCall.url).toContain('size=30');
    expect(screen.getByRole('button', { name: /검색항목 엑셀 출력/ })).toBeInTheDocument();

    fireEvent.click(screen.getByText('sales01'));
    expect(await screen.findByText('영업본부 > 1팀')).toBeInTheDocument();
    expect(screen.getByText('카테고리')).toBeInTheDocument();
    expect(screen.getByText('계좌정보')).toBeInTheDocument();
    expect(await screen.findByText('1.2.3.4')).toBeInTheDocument();
    for (const h of ['번호', '로그인 시각', '아이피']) expect(screen.getAllByRole('columnheader', { name: h }).length).toBeGreaterThan(0);
    expect(screen.getByText('21')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '현재 아이디로 로그인' }));
    expect(await screen.findByText(/\[sales01\]로 로그인 하시겠습니까\?/)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: '현재 아이디로 로그인' });
    fireEvent.click(within(dialog).getByRole('button', { name: /확인|Confirm/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/admin/staff-members/2/login-as'))).toBe(true));
    await waitFor(() => expect(memory.state.location.pathname).toBe('/admin'));
  });

  it('empty list wording per department and the create form (1111, 중복 검색, required fields, 은행 select)', async () => {
    vi.stubGlobal('fetch', apiMock({ staffItems: [] }));
    mount('/admin/staff-list/C');
    expect(await screen.findByText('등록된 첨삭강사가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /검색항목 엑셀 출력/ })).not.toBeInTheDocument(); // only staff02.php has it
    fireEvent.click(screen.getByRole('button', { name: '신규 등록' }));
    expect(await screen.findByRole('heading', { name: '첨삭강사 등록' })).toBeInTheDocument();
    expect(screen.getByLabelText(/비밀번호/)).toHaveValue('1111');
    expect(screen.getByLabelText(/아이디/)).toHaveAttribute('maxLength', '30');
    fireEvent.change(screen.getByLabelText(/아이디/), { target: { value: 'newid1' } });
    fireEvent.click(screen.getByRole('button', { name: '중복 검색' }));
    expect(await screen.findByText('[ 등록이 가능한 아이디입니다. ]')).toBeInTheDocument();
    expect(screen.getByLabelText('은행명')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(await screen.findByText('소속을 입력하세요.')).toBeInTheDocument();
    expect(screen.getByText('휴대폰을 입력하세요.')).toBeInTheDocument();
    expect(screen.getByText('이메일을 입력하세요.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/admin/staff-members'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '카테고리 찾기' }));
    const treeBtn = await screen.findByRole('button', { name: '영업본부 [1]' });
    expect(screen.queryByText('1팀')).not.toBeInTheDocument();
    fireEvent.click(treeBtn);
    expect(await screen.findByText('1팀')).toBeInTheDocument();
  });

  it('카테고리: collapsed trees with [N], per-dept empty text, 영업부서 정렬 by OrderByNum with Deep, 상위 카테고리, per-dept 권한, confirm', async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/departments');
    const root = await screen.findByRole('button', { name: /영업본부\s\[1\]/ });
    expect(screen.getByText('등록된 첨삭강사가 없습니다.')).toBeInTheDocument();
    const sortTable = screen.getByRole('table', { name: '영업부서 정렬' });
    const rows = within(sortTable).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.getAttribute('data-deep'))).toEqual(['2', '1']);
    expect(rows[0]).toHaveTextContent('1팀');
    expect(rows[1]).toHaveTextContent('영업본부');
    const tree = screen.getByRole('tree', { name: '영업자' });
    expect(within(tree).queryByText('1팀')).not.toBeInTheDocument();
    fireEvent.click(root);
    expect(await within(tree).findByText('1팀')).toBeInTheDocument();
    const child = within(tree).getByText('1팀').closest('li')!;
    fireEvent.click(within(child).getByRole('button', { name: '수정' }));
    expect(await screen.findByTestId('upper-category')).toHaveTextContent('영업본부');
    const drawer = screen.getByRole('dialog', { name: '영업자 수정' });
    expect(within(drawer).queryByText('컨텐츠관리')).not.toBeInTheDocument(); // not on the 영업자 form
    expect(within(drawer).getByText('학습관리')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '수정 하기' }));
    expect(await screen.findByText('등록 하시겠습니까?')).toBeInTheDocument();
  });

  it('탈퇴회원: 이름 default, 30 rows, 일반회원 / 여성 / full datetimes', async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/members/withdrawn');
    expect(await screen.findByText('out01')).toBeInTheDocument();
    const call = calls.find((c) => c.url.includes('/admin/withdrawn-members'))!;
    expect(call.url).toContain('col=Name');
    expect(call.url).toContain('size=30');
    expect(screen.getByText('일반회원')).toBeInTheDocument();
    expect(screen.getByText('여성')).toBeInTheDocument();
    expect(screen.getByText('2026-01-02 03:04:05')).toBeInTheDocument();
    expect(screen.getByText('2026-02-03 04:05:06')).toBeInTheDocument();
  });

  it('개인정보 열람내역: 열람구분 = Field, 30 rows, excel button for write accounts', async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/privacy-log');
    expect(await screen.findByText('상담 확인')).toBeInTheDocument();
    expect(screen.getByText('휴대폰')).toBeInTheDocument();
    expect(screen.queryByText('Member · 휴대폰')).not.toBeInTheDocument();
    expect(calls.find((c) => c.url.includes('/admin/members/privacy-log'))!.url).toContain('size=30');
    expect(screen.getByRole('button', { name: /검색항목 엑셀 출력/ })).toBeInTheDocument();
  });
});
