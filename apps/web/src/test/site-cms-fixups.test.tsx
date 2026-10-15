import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useState, type ReactElement } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import EdudataPage from '../features/admin/pages/site-cms/EdudataPage';
import LectureEventsPage from '../features/admin/pages/site-cms/LectureEventsPage';
import BackupsPage from '../features/admin/pages/site-cms/BackupsPage';
import { FONT_FACES, SiteCmsHtmlEditor } from '../features/admin/pages/site-cms/SiteCmsHtmlEditor';
import { SiteVisitCounter } from '../features/admin/pages/site-cms/SiteVisitCounter';
import { resetSiteVisitCounterForTests } from '../features/admin/pages/site-cms/useSiteVisitCounter';
import { edudataFormData } from '../shared/api/endpoints/admin-site-cms';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const adminA: AdminSession = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['F', 'G'], subGrants: ['F4', 'F5', 'F7', 'G2', 'G3'], canWrite: true } as AdminSession;
const sessionOf = (admin: AdminSession): AdminSessionState => ({ phase: 'authed', admin, isAuthed: true, canWrite: admin.canWrite, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true });
const empty = { items: [], page: 1, size: 30, total: 0 };
const xlsx = (name: string) => new Response(new Blob(['PK']), { status: 200, headers: { 'Content-Disposition': `attachment; filename="${name}"` } });

type Call = { method: string; url: string; body?: unknown };
const calls: Call[] = [];
const hit = (method: string, frag: string) => calls.some((c) => c.method === method && c.url.includes(frag));
let edudataPost: (body: Record<string, unknown>) => Response = () => json({ ok: true, idx: 77, files: [] }, 201);

function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, ''); const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body instanceof FormData ? Object.fromEntries(init.body.entries()) : undefined;
    calls.push({ method, url, body });
    if (url.startsWith('/admin/edudata/meta')) return json({ categories: [{ value: 'A', label: '공통역량' }], uploadEnabled: true, uploadDir: '/web/hrde/html/upload' });
    if (url.startsWith('/admin/edudata/form') && method === 'POST') return edudataPost(body as Record<string, unknown>);
    if (url.startsWith('/admin/edudata/77')) return json({ idx: 77, useYN: 'Y', useLabel: '사용', notice: 'N', category: 'A', categoryLabel: '공통역량', title: '신규', content: '<p>x</p>', files: [], firstFile: null, viewCount: 0, regDate: null });
    if (url.startsWith('/admin/edudata')) return json({ ...empty, notices: [] });
    if (url.startsWith('/admin/lecture-events/export')) return xlsx('lecture_events_20261015.xlsx');
    if (url.startsWith('/admin/lecture-events')) return json(empty);
    if (url.startsWith('/admin/backups/export')) return xlsx('backups_20261015.xlsx');
    if (url.startsWith('/admin/backups')) return json(empty);
    if (url.startsWith('/admin/site-cms/editor-photo')) return json({ ok: true, fileName: '20261015101010.png', url: '/upload/webedit/202610/20261015101010.png', html: '<img src="/upload/webedit/202610/20261015101010.png" title="20261015101010.png" ><br style="clear:both;">' });
    if (url.startsWith('/visits')) return json({ ok: true, counted: true });
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

const mount = (el: ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={sessionOf(adminA)}><MemoryRouter initialEntries={['/x']}>{el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};

beforeEach(() => {
  calls.length = 0; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock());
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
  edudataPost = () => json({ ok: true, idx: 77, files: [] }, 201);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); adminTokenStore.clear(); });

async function fillEdudataForm() {
  mount(<EdudataPage />);
  fireEvent.click(await screen.findByRole('button', { name: '자료 등록' }));
  fireEvent.change(screen.getByLabelText(/제목/), { target: { value: '신규 자료' } });
  const editor = screen.getByRole('textbox', { name: '내 용' });
  editor.innerHTML = '<p>신규 자료 본문입니다. 열다섯 글자 이상.</p>'; fireEvent.input(editor);
}
const confirmSave = async () => {
  fireEvent.click(screen.getByRole('button', { name: '등록' }));
  expect(await screen.findByText('등록하시겠습니까?')).toBeInTheDocument();
  const btns = screen.getAllByRole('button', { name: '등록' });
  fireEvent.click(btns[btns.length - 1]!);
};

describe('학습자료실: checkFileSecure aborts the whole save (edudata_script.php)', () => {
  it('text and files go in ONE multipart request; a rejected zip leaves the form open with the message on that slot', async () => {
    edudataPost = () => json({ error: { code: 'VALIDATION', message: '압축파일에 금지된 파일이 포함되어 있습니다: run.sh', details: { slot: 2, file: 'tools.zip' } } }, 400);
    await fillEdudataForm();
    const zip = new File(['PK'], 'tools.zip', { type: 'application/zip' });
    fireEvent.change(screen.getByLabelText('첨부파일 2'), { target: { files: [zip] } });
    await confirmSave();
    await waitFor(() => expect(hit('POST', '/admin/edudata/form')).toBe(true));
    const sent = calls.find((c) => c.url.startsWith('/admin/edudata/form'))!.body as Record<string, unknown>;
    expect(sent).toMatchObject({ Title: '신규 자료', UseYN: 'Y', Notice: 'N', Category: 'A' });
    expect((sent.file2 as File).name).toBe('tools.zip');
    expect((await screen.findAllByText('압축파일에 금지된 파일이 포함되어 있습니다: run.sh')).length).toBeGreaterThan(0);
    // nothing else was written and the new-record view did not open
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(1);
    expect(hit('POST', '/files/')).toBe(false);
    expect(hit('GET', '/admin/edudata/77')).toBe(false);
    expect(screen.queryByText('처리되었습니다.')).toBeNull();
    expect(screen.getByText('학습자료실 등록')).toBeInTheDocument(); // still on the form
    expect(screen.getByLabelText(/제목/)).toHaveValue('신규 자료');
  });

  it('an accepted save opens the new record (edudata_read.php?idx=신규)', async () => {
    await fillEdudataForm();
    await confirmSave();
    await waitFor(() => expect(hit('GET', '/admin/edudata/77')).toBe(true));
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual(['/admin/edudata/form']);
  });

  it('edudataFormData: FileDelN wins over a new file in the same slot; clearFiles is "1,3"', () => {
    const f = new File(['x'], 'a.pdf');
    const fd = edudataFormData({ Title: 't' }, { 1: f, 2: f }, [3, 1]);
    expect(fd.get('Title')).toBe('t');
    expect(fd.get('clearFiles')).toBe('1,3');
    expect(fd.get('file1')).toBeNull();
    expect((fd.get('file2') as File).name).toBe('a.pdf');
  });
});

describe('SiteCmsHtmlEditor: SmartEditor2 글꼴 + 사진 첨부', () => {
  function Host({ uploadPhoto }: { uploadPhoto?: ((f: File) => Promise<{ html: string }>) | null }) {
    const [v, setV] = useState('<p>본문</p>');
    return <><SiteCmsHtmlEditor id="ed" label="내 용" value={v} onChange={setV} uploadPhoto={uploadPhoto} /><output data-testid="v">{v}</output></>;
  }

  it('offers the SmartEditor font list and applies it with fontName', () => {
    const exec = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    render(<Host />);
    const sel = screen.getByLabelText('글꼴') as HTMLSelectElement;
    expect(Array.from(sel.options).slice(1).map((o) => o.textContent)).toEqual(FONT_FACES.map((f) => f.label));
    expect(FONT_FACES.map((f) => f.label)).toEqual(['돋움', '돋움체', '굴림', '굴림체', '바탕', '바탕체', '궁서', 'Arial', 'Tahoma', 'Times New Roman', 'Verdana', 'Courier New', '나눔고딕', '나눔명조', '나눔고딕코딩']);
    fireEvent.change(sel, { target: { value: "'굴림',Gulim,Sans-serif" } });
    expect(exec).toHaveBeenCalledWith('fontName', false, "'굴림',Gulim,Sans-serif");
    delete (document as unknown as { execCommand?: unknown }).execCommand;
  });

  it('사진: uploads to POST /admin/site-cms/editor-photo and inserts the SmartEditor <img> tag into the body', async () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: '사진' }));
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], '사진.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('ed-photo-input'), { target: { files: [png] } });
    await waitFor(() => expect(screen.getByTestId('v').textContent).toContain('<img src="/upload/webedit/202610/20261015101010.png" title="20261015101010.png"'));
    expect(hit('POST', '/admin/site-cms/editor-photo')).toBe(true);
    expect((calls.find((c) => c.url.startsWith('/admin/site-cms/editor-photo'))!.body as { file: File }).file.name).toBe('사진.png');
    expect(screen.getByTestId('v').textContent).toContain('<p>본문</p>');
  });

  it('사진: refuses non jpg/png/bmp/gif before uploading, and shows the API message on a server rejection', async () => {
    const upload = vi.fn().mockRejectedValue(Object.assign(new Error('x'), {}));
    render(<Host uploadPhoto={upload} />);
    fireEvent.change(screen.getByTestId('ed-photo-input'), { target: { files: [new File(['x'], 'a.webp')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('이미지 파일(jpg, png, bmp, gif)만 올릴 수 있습니다: a.webp');
    expect(upload).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('ed-photo-input'), { target: { files: [new File(['x'], 'b.gif')] } });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('사진을 올리지 못했습니다.');
    expect(screen.getByTestId('v').textContent).toBe('<p>본문</p>');
  });

  it('uploadPhoto={null} hides the 사진 button', () => {
    render(<Host uploadPhoto={null} />);
    expect(screen.queryByRole('button', { name: '사진' })).toBeNull();
    expect(screen.getByLabelText('사진(URL)')).toBeInTheDocument();
  });
});

describe('이벤트관리 / 백업 목록: 검색항목 엑셀 출력 is .xlsx and works with no rows', () => {
  it('lecture_event_excel.php', async () => {
    mount(<LectureEventsPage />);
    await waitFor(() => expect(hit('GET', '/admin/lecture-events?')).toBe(true));
    const btn = screen.getByRole('button', { name: '검색항목 엑셀 출력' });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    await waitFor(() => expect(hit('GET', '/admin/lecture-events/export')).toBe(true));
    expect(calls.find((c) => c.url.startsWith('/admin/lecture-events/export'))!.url).toContain('format=xlsx');
  });

  it('backup_list_excel.php', async () => {
    mount(<BackupsPage />);
    await waitFor(() => expect(hit('GET', '/admin/backups?')).toBe(true));
    const btn = screen.getByRole('button', { name: '검색항목 엑셀 출력' });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    await waitFor(() => expect(hit('GET', '/admin/backups/export')).toBe(true));
    const url = calls.find((c) => c.url.startsWith('/admin/backups/export'))!.url;
    expect(url).toContain('format=xlsx');
    expect(url).toContain('col=reg_date');
  });
});

describe('SiteVisitCounter (mount in the public shells)', () => {
  beforeEach(() => { resetSiteVisitCounterForTests(); window.sessionStorage.clear(); });
  it('renders nothing and records one visit per browser session', async () => {
    const { container, rerender } = render(<SiteVisitCounter />);
    expect(container.innerHTML).toBe('');
    await waitFor(() => expect(hit('POST', '/visits')).toBe(true));
    rerender(<SiteVisitCounter />);
    render(<SiteVisitCounter />);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.filter((c) => c.url.startsWith('/visits'))).toHaveLength(1);
  });
});
