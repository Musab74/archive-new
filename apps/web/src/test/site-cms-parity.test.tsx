import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useState, type ReactElement } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import ReviewsPage from '../features/admin/pages/site-cms/ReviewsPage';
import ArchivingPage from '../features/admin/pages/site-cms/ArchivingPage';
import EdudataPage from '../features/admin/pages/site-cms/EdudataPage';
import LectureEventsPage from '../features/admin/pages/site-cms/LectureEventsPage';
import PopupsPage from '../features/admin/pages/site-cms/PopupsPage';
import BackupsPage from '../features/admin/pages/site-cms/BackupsPage';
import MyInfoPage from '../features/admin/pages/site-cms/MyInfoPage';
import { SiteCmsHtmlEditor } from '../features/admin/pages/site-cms/SiteCmsHtmlEditor';
import { resetSiteVisitCounterForTests, useSiteVisitCounter } from '../features/admin/pages/site-cms/useSiteVisitCounter';
import { LEGACY_PAGE_SIZE, htmlToPlainText, plainTextToHtml } from '../features/admin/pages/site-cms/siteCms.helpers';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const adminA: AdminSession = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['F', 'G'], subGrants: ['F4', 'F5', 'F7', 'G2', 'G3'], canWrite: true } as AdminSession;
const sessionOf = (admin: AdminSession): AdminSessionState => ({ phase: 'authed', admin, isAuthed: true, canWrite: admin.canWrite, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true });

const empty = { items: [], page: 1, size: 30, total: 0 };
const archivingRow = { idx: 3, id: 'user01', title: '자료 요청', regDate: '2026-10-02 09:00:00', regDate2: null, status: 'A', statusLabel: '대기', replier: null, hasFile: false };
const archivingDetail = { idx: 3, id: 'user01', name: '홍길동', email: 'u@x.kr', mobile: '010-1111-2222', companyName: '테스트기업', title: '자료 요청', contents: '<p>본문</p>', regDate: '2026-10-02 09:00:00', fileName1: null, realFileName1: null, status: 'A', statusLabel: '대기', name2: '관리자', contents2: '<p><b>기존</b> 답변입니다. 열다섯 글자 이상</p>', regDate2: null };
const edudataNew = { idx: 77, useYN: 'Y', useLabel: '사용', notice: 'N', category: 'B', categoryLabel: '직무역량', title: '신규 자료', content: '<p>신규 자료 본문입니다. 열다섯 글자 이상.</p>', files: [], firstFile: null, viewCount: 0, regDate: '2026-10-15 10:00:00' };
const eventRow = { idx: 1, id: 'user01', name: '홍길동', mobile: '010-1111-2222', stage: 10, stageLabel: '10Days', stageCount: 2, status: 'A', statusLabel: '대기', regDate: '2026-10-01 00:00:00' };
const popupRow = { idx: 4, title: '추석 이벤트', imgName: '20261001.png', imgWidth: '400', imgHeight: '300', popupLeft: '200', popupTop: '50', endDate: '20261231', useYN: 'Y', regDate: '2026-10-01 00:00:00', regDay: '2026-10-01', mobile: { imgName: null, imgWidth: '', imgHeight: '', popupLeft: '', popupTop: '' } };
const myInfoB = { id: 'sales01', dept: 'B', deptIdx: 2, deptName: '영업1팀', deptPath: '영업부 > 영업1팀', name: '영업', team: '영업1팀', mobile: '010-1234-5678', phone: '', email: 'legacy-address', bankName: '국민', bankNumber: '1-2', useYN: 'Y', lastLogin: null, lastLoginIp: null, showBank: true };

const calls: { method: string; url: string; body?: unknown }[] = [];
const hit = (method: string, frag: string) => calls.some((c) => c.method === method && c.url.includes(frag));
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, ''); const method = init?.method ?? 'GET';
    let body: unknown; try { body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body instanceof FormData ? Object.fromEntries(init.body.entries()) : undefined; } catch { body = undefined; }
    calls.push({ method, url, body });
    if (url.startsWith('/admin/reviews/export')) return new Response(new Blob(['PK']), { status: 200, headers: { 'Content-Disposition': "attachment; filename=\"reviews_20261015.xlsx\"; filename*=UTF-8''%EC%88%98%EA%B0%95%ED%9B%84%EA%B8%B0_20261015.xlsx" } });
    if (url.startsWith('/admin/reviews')) return json(empty);
    if (url.startsWith('/admin/archiving/3/reply')) return json({ ok: true, updated: 1 });
    if (url.startsWith('/admin/archiving/3')) return json(archivingDetail);
    if (url.startsWith('/admin/archiving')) return json({ ...empty, items: [archivingRow], total: 1 });
    if (url.startsWith('/admin/edudata/meta')) return json({ categories: [{ value: 'A', label: '공통역량' }, { value: 'B', label: '직무역량' }], uploadEnabled: true, uploadDir: '/web/hrde/html/upload' });
    if (url.startsWith('/admin/edudata/77')) return json(edudataNew);
    if (url.startsWith('/admin/edudata') && method === 'POST') return json({ ok: true, idx: 77 }, 201);
    if (url.startsWith('/admin/edudata')) return json({ ...empty, notices: [] });
    if (url.startsWith('/admin/lecture-events/1/status')) return json({ ok: true, updated: 1 });
    if (url.startsWith('/admin/lecture-events/1')) return json({ ...eventRow, statusRegDate: null, statusName: '담당자' });
    if (url.startsWith('/admin/lecture-events')) return json({ ...empty, items: [eventRow], total: 1 });
    if (url.startsWith('/admin/popups/4/image')) return new Response(new Blob(['img'], { type: 'image/png' }), { status: 200 });
    if (url.startsWith('/admin/popups/4/links') && method === 'POST') return json({ ok: true, num: 9 }, 201);
    if (url.startsWith('/admin/popups/4')) return json({ popup: popupRow, links: [] });
    if (url.startsWith('/admin/popups')) return json({ ...empty, size: 25, items: [popupRow], total: 1, uploadEnabled: true });
    if (url.startsWith('/admin/backups')) return json(empty);
    if (url.startsWith('/admin/my-info')) return method === 'PUT' ? json({ ok: true, passwordChanged: false }) : json(myInfoB);
    if (url.startsWith('/visits')) return json({ ok: true, counted: true, year: 2026, month: 10, day: 15, hour: 14 });
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

const mount = (el: ReactElement, admin: AdminSession = adminA) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={sessionOf(admin)}><MemoryRouter initialEntries={['/x']}>{el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};

beforeEach(() => {
  calls.length = 0; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock());
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); adminTokenStore.clear(); });

describe('SmartEditor2 replacement helpers', () => {
  it('htmlToPlainText / plainTextToHtml (TEXT mode)', () => {
    expect(htmlToPlainText('<p>첫 줄</p><p>둘째 &amp; 줄<br>셋째</p>')).toBe('첫 줄\n둘째 & 줄\n셋째');
    expect(htmlToPlainText('<script>x()</script><b>굵게</b>&nbsp;끝')).toBe('굵게 끝');
    expect(plainTextToHtml('a < b\n\nc')).toBe('<p>a &lt; b</p><p>&nbsp;</p><p>c</p>');
    expect(plainTextToHtml('')).toBe('');
    expect(LEGACY_PAGE_SIZE).toBe(30);
  });

  it('SiteCmsHtmlEditor: Editor surface emits HTML; HTML and TEXT tabs edit the same value', () => {
    function Host() { const [v, setV] = useState('<p><b>굵게</b> 시작</p>'); return <><SiteCmsHtmlEditor id="ed" label="내 용" value={v} onChange={setV} /><output data-testid="v">{v}</output></>; }
    render(<Host />);
    const surface = screen.getByRole('textbox', { name: '내 용' });
    expect(surface.innerHTML).toBe('<p><b>굵게</b> 시작</p>');
    surface.innerHTML = '<p><i>바뀐</i> 내용</p>'; fireEvent.input(surface);
    expect(screen.getByTestId('v').textContent).toBe('<p><i>바뀐</i> 내용</p>');
    for (const t of ['굵게', '기울임꼴', '밑줄', '글자색', '가운데 정렬', '번호 매기기', '링크', '사진(URL)']) expect(screen.getByLabelText(t)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));
    const html = screen.getByLabelText('내 용 (HTML)') as HTMLTextAreaElement;
    expect(html.value).toBe('<p><i>바뀐</i> 내용</p>');
    fireEvent.change(html, { target: { value: '<h3>제목</h3>' } });
    fireEvent.click(screen.getByRole('button', { name: 'TEXT' }));
    expect((screen.getByLabelText('내 용 (TEXT)') as HTMLTextAreaElement).value).toBe('제목');
    fireEvent.change(screen.getByLabelText('내 용 (TEXT)'), { target: { value: '한 줄\n두 줄' } });
    expect(screen.getByTestId('v').textContent).toBe('<p>한 줄</p><p>두 줄</p>');
    fireEvent.click(screen.getByRole('button', { name: 'Editor' }));
    expect(screen.getByRole('textbox', { name: '내 용' }).innerHTML).toBe('<p>한 줄</p><p>두 줄</p>');
  });
});

describe('site-cms parity with hrd_manager', () => {
  it('lists ask for 30 rows per page (include_top.php $page_size)', async () => {
    mount(<BackupsPage />);
    await waitFor(() => expect(hit('GET', '/admin/backups?')).toBe(true));
    expect(calls.find((c) => c.url.startsWith('/admin/backups'))!.url).toContain('size=30');
  });

  it('수강후기: 검색항목 엑셀 출력 downloads .xlsx even with no rows (survey_excel.php)', async () => {
    mount(<ReviewsPage />);
    await waitFor(() => expect(hit('GET', '/admin/reviews?')).toBe(true));
    expect(calls[0]!.url).toContain('size=30');
    const btn = screen.getByRole('button', { name: '검색항목 엑셀 출력' });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    await waitFor(() => expect(hit('GET', '/admin/reviews/export')).toBe(true));
    expect(calls.find((c) => c.url.startsWith('/admin/reviews/export'))!.url).toContain('format=xlsx');
  });

  it('아카이빙: answer prefilled in the rich-text editor; 등록하시겠습니까? confirm, cancel sends nothing', async () => {
    mount(<ArchivingPage />);
    fireEvent.click(await screen.findByText('자료 요청'));
    const editor = await screen.findByRole('textbox', { name: '답변 내용' });
    await waitFor(() => expect(editor.innerHTML).toBe('<p><b>기존</b> 답변입니다. 열다섯 글자 이상</p>'));
    fireEvent.click(screen.getByRole('button', { name: '답변 하기' }));
    expect(await screen.findByText('등록하시겠습니까?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(hit('PATCH', '/admin/archiving/3/reply')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '답변 하기' }));
    fireEvent.click(await screen.findByRole('button', { name: '등록' }));
    await waitFor(() => expect(hit('PATCH', '/admin/archiving/3/reply')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toMatchObject({ Name2: '관리자', Contents2: '<p><b>기존</b> 답변입니다. 열다섯 글자 이상</p>' });
  });

  it('학습자료실: confirm before POST, then the new record opens (edudata_read.php?idx=신규)', async () => {
    mount(<EdudataPage />);
    fireEvent.click(await screen.findByRole('button', { name: '자료 등록' }));
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: '신규 자료' } });
    const editor = screen.getByRole('textbox', { name: '내 용' });
    editor.innerHTML = '<p>신규 자료 본문입니다. 열다섯 글자 이상.</p>'; fireEvent.input(editor);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(await screen.findByText('등록하시겠습니까?')).toBeInTheDocument();
    expect(hit('POST', '/admin/edudata')).toBe(false);
    const dialogBtns = screen.getAllByRole('button', { name: '등록' });
    fireEvent.click(dialogBtns[dialogBtns.length - 1]!);
    // one multipart request (edudata_script.php): text fields + files, checked before anything is written
    await waitFor(() => expect(hit('POST', '/admin/edudata/form')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ Title: '신규 자료', Content: '<p>신규 자료 본문입니다. 열다섯 글자 이상.</p>' });
    await waitFor(() => expect(hit('GET', '/admin/edudata/77')).toBe(true));
    expect(await screen.findByRole('button', { name: '정보 수정' })).toBeInTheDocument();
    expect(await screen.findByText('2026-10-15 10:00:00')).toBeInTheDocument();
  });

  it('이벤트관리: 상태 변경 asks 등록하시겠습니까? before PATCH', async () => {
    mount(<LectureEventsPage />);
    fireEvent.click(await screen.findByText('홍길동'));
    const btn = await screen.findByRole('button', { name: '상태 변경' });
    await waitFor(() => expect(screen.getByLabelText(/작성자/)).toHaveValue('담당자'));
    fireEvent.click(btn);
    expect(await screen.findByText('등록하시겠습니까?')).toBeInTheDocument();
    expect(hit('PATCH', '/status')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(hit('PATCH', '/admin/lecture-events/1/status')).toBe(true));
  });

  it('팝업: 보기 shows the image at ImgWidth with the close bar; 링크 등록 asks 등록합니까?', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    mount(<PopupsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '보기' }));
    const img = await screen.findByRole('img', { name: '추석 이벤트' });
    expect(img).toHaveAttribute('width', '400');
    expect(screen.getByText('오늘 하루 창 열지 않기')).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('popup-preview')).getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByTestId('popup-preview')).toBeNull());
    fireEvent.click(screen.getAllByText('추석 이벤트')[0]!);
    fireEvent.change(await screen.findByLabelText('링크 URL'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '등록 하기' }));
    expect(confirm).toHaveBeenCalledWith('등록합니까?');
    expect(hit('POST', '/admin/popups/4/links')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '등록 하기' }));
    await waitFor(() => expect(hit('POST', '/admin/popups/4/links')).toBe(true));
  });

  it('정보변경: a 영업(B) read-only account can still save its own profile (no e-mail format check)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const sales = { ...adminA, id: 'sales01', dept: 'B', canWrite: false } as AdminSession;
    mount(<MyInfoPage />, sales);
    expect(await screen.findByText('영업부 > 영업1팀')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    const save = screen.getByRole('button', { name: '수정 하기' });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(hit('PUT', '/admin/my-info')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toMatchObject({ Email: 'legacy-address', BankName: '국민' });
  });
});

describe('useSiteVisitCounter (include_bottom.php 접속 통계)', () => {
  beforeEach(() => { resetSiteVisitCounterForTests(); window.sessionStorage.clear(); });
  it('posts /visits once per browser session', async () => {
    const first = renderHook(() => useSiteVisitCounter());
    await waitFor(() => expect(window.sessionStorage.getItem('hrde_sta')).toBe('Y'));
    first.unmount();
    renderHook(() => useSiteVisitCounter());
    await act(async () => { await Promise.resolve(); });
    expect(calls.filter((c) => c.method === 'POST' && c.url.startsWith('/visits'))).toHaveLength(1);
  });
  it('does nothing when disabled', async () => {
    renderHook(() => useSiteVisitCounter(false));
    await act(async () => { await Promise.resolve(); });
    expect(calls).toHaveLength(0);
  });
});
