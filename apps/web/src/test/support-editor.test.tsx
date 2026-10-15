import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useState, type ReactElement } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import NoticesPage from '../features/admin/pages/community/NoticesPage';
import FaqsPage from '../features/admin/pages/community/FaqsPage';
import { CheatingPage, CounselPage, InquiriesPage } from '../features/admin/pages/community/InquiryPages';
import { SiteInfoPage } from '../features/admin/pages/site/SitePages';
import DashboardPage from '../features/admin/pages/DashboardPage';
import { AdminChromeGreeting, AdminFooter, AdminMainSideMenu } from '../features/admin/pages/site/AdminChrome';
import { SupportRichEditor } from '../features/admin/pages/community/SupportRichEditor';
import { buildPhpParityMenu } from '../features/admin/pages/support-menu-parity';
import { decodeStoredEntities, htmlToText, looksLikeHtml, nl2br, sanitizePastedHtml, textToHtml, toEditorHtml } from '../features/admin/pages/community/support-parity.helpers';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['E', 'F', 'G'], subGrants: ['E7', 'F1', 'F2', 'F3', 'F6', 'G1'], canWrite: true } as AdminSession;
const session: AdminSessionState = { phase: 'authed', admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true };

const noticeRow = { idx: 9, useYN: 'Y', useLabel: '사용', pinned: false, title: '점검 안내', views: 3, regDate: '2026-10-01 00:00:00', hasFile: true, realFileName1: '안내.pdf', fileCount: 1 };
const noticeDetail = { ...noticeRow, content: '<p>서버 점검이 있습니다. 이용에 참고하세요.</p>', files: [{ slot: 1, file: 'a.pdf', name: '안내.pdf', fileName: 'a.pdf', realFileName: '안내.pdf' }], uploadEnabled: true };
const faqMeta = { categories: [{ value: 'A', label: '일반' }], nextOrder: 4 };
const counselDetail = { idx: 11, lectureCode: null, courseName: null, contentsTitle: null, studySeq: null, contentsIdx: null, title: '진도 문의', name: '사용자', id: 'user01', category: 'A', categoryLabel: '학습 내용 문의', mobile: null, email: null, hasMobile: false, hasEmail: false, regDate: '2026-10-02 10:00:00', regDate2: '2026-10-03 10:00:00', contents: '<p>q</p>', studentFile: null, status: 'B', statusLabel: '완료', name2: '상담원', contents2: '첫째 줄\n둘째 줄', files: [], uploadEnabled: true };
const inquiry = { idx: 31, serviceType: '1', serviceTypeLabel: 'HRDe아카이브', companyName: '테스트기업', name: '담당자', phone: null, email: null, personnel: '3', contents: '태그 &lt;script&gt; 문의\n둘째 줄', agreeYN: 'Y', regDate: '2026-10-04 00:00:00', status: 'A', statusLabel: '대기', answer: { name: null, contents: null, regDate: null, mdfDate: null } };
const site = { idx: 2, companyName: '에이치알디이', ceo: '홍길동', companyNumber: '1', salesReportNumber: '2', phone: '3', fax: '4', email: 'e', personalInformationManager: 'p', address: '서울', copyright: 'c', kakaoUrl: null, regDate: '2026-10-14 10:52:42' };
const chrome = { id: 'admin01', name: '관리자', dept: 'A', deptName: 'LMS개발부', team: '운영팀', greeting: '관리자 (부서명:운영팀)님 안녕하세요.', serverIp: '192.168.0.9', siteName: '에이치알디이', siteAddress: '서울특별시 구로구 디지털로', browserTitle: '에이치알디이 (192.168.0.9)' };
const dashboard = { today: '2026-10-15', monthStart: '2026-10-01', logins: { today: 1, uniqueUsers: 1 }, activePlayers: { count: 0, freshnessSeconds: 90 }, learnersOver15hThisMonth: 0, activeEnrollments: 0, emon: { pending: 0, pendingStale: 0 }, support: { openInquiries: 0, openCounsel: 0, openCheating: 0 }, signupsToday: 0, welcome: { id: 'admin01', name: '관리자', deptName: 'LMS개발부', loginAt: '2026-10-15 09:00:00', clientIp: '10.0.0.5', serverIp: '192.168.0.9', team: '운영팀', greeting: chrome.greeting }, rubyShortcuts: false, siteName: chrome.siteName, siteAddress: chrome.siteAddress, browserTitle: chrome.browserTitle };
const page = (items: unknown[]) => ({ items, page: 1, size: 30, total: items.length });

const calls: { m: string; url: string; body?: unknown }[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, ''); const method = init?.method ?? 'GET';
    let body: unknown; try { body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body; } catch { body = init?.body; }
    calls.push({ m: method, url, body });
    if (url.startsWith('/admin/notices/9') && method === 'PATCH') return json({ ok: true, updated: 1 });
    if (url.startsWith('/admin/notices/9')) return json(noticeDetail);
    if (url.startsWith('/admin/notices')) return json({ ...page([noticeRow]), pinned: [] });
    if (url.startsWith('/admin/faqs/meta')) return json(faqMeta);
    if (url.startsWith('/admin/faqs/5')) return json({ idx: 5, order: 4, category: 'A', categoryLabel: '일반', title: '로그인 문의', useYN: 'Y', useLabel: '사용', regDate: '2026-10-15 00:00:00', content: '<p>비밀번호 찾기에서 재설정하세요.</p>' });
    if (url.startsWith('/admin/faqs')) return method === 'POST' ? json({ ok: true, idx: 5 }) : json(page([]));
    if (url.startsWith('/admin/counsel/meta')) return json({ categories: [], statuses: [{ value: 'A', label: '대기' }, { value: 'B', label: '완료' }], revealGubun: ['학습자 관리'], uploadEnabled: true });
    if (url.startsWith('/admin/counsel/11')) return json(counselDetail);
    if (url.startsWith('/admin/counsel')) return json(page([{ idx: 11, id: 'user01', name: '사용자', category: 'A', categoryLabel: '학습 내용 문의', title: '진도 문의', regDate: '2026-10-02', regDate2: '2026-10-03', status: 'B', statusLabel: '완료', answered: true, mobile: null, email: null, lectureCode: null }]));
    if (url.startsWith('/admin/cheating')) return json(page([]));
    if (url.startsWith('/admin/inquiries/31')) return json({ ...inquiry, statuses: [] });
    if (url.startsWith('/admin/inquiries')) return json(page([inquiry]));
    if (url.startsWith('/admin/site-info')) return method === 'PUT' ? json({ ok: true, updated: 1, fields: [], unchanged: true, idx: 3, previousIdx: 2 }) : json(site);
    if (url.startsWith('/admin/dashboard/chrome')) return json(chrome);
    if (url.startsWith('/admin/dashboard')) return json(dashboard);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (el: ReactElement, path = '/x') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};
const confirmDialog = () => screen.findByRole('dialog', { name: '확인' });

describe('support editor helpers', () => {
  it('nl2br decodes the Replace_Check_XSS2 entities once, then escapes (shows "<script" as text like PHP, renders no markup)', () => {
    expect(decodeStoredEntities('a &lt;s b &amp;amp; &#39;q&#039;')).toBe("a <s b &amp; 'q'");
    expect(nl2br('&lt;script&gt;x\ny')).toBe('&lt;script&gt;x<br>y');
    const div = document.createElement('div'); div.innerHTML = nl2br('태그 &lt;s 와 &lt;form');
    expect(div.textContent).toBe('태그 <s 와 <form');
    expect(div.querySelector('s, form')).toBeNull();
  });
  it('toEditorHtml / textToHtml / htmlToText / looksLikeHtml', () => {
    expect(looksLikeHtml('<p>x</p>')).toBe(true); expect(looksLikeHtml('a < b')).toBe(false);
    expect(toEditorHtml('첫째 줄\n둘째 <줄>')).toBe('첫째 줄<br>둘째 &lt;줄&gt;');
    expect(toEditorHtml('<p>그대로</p>')).toBe('<p>그대로</p>');
    expect(toEditorHtml(null)).toBe('');
    expect(textToHtml('a\r\nb')).toBe('a<br>b');
    expect(htmlToText('<p>안녕&nbsp;하세요</p><ul><li>하나</li></ul>둘<br>셋&amp;')).toBe('안녕 하세요\n- 하나\n둘\n셋&');
  });
  it('sanitizePastedHtml drops scripts, handlers and javascript: links', () => {
    const out = sanitizePastedHtml('<p onclick="x()" style="color:red">a</p><script>bad()</script><a href="javascript:alert(1)">l</a><iframe src="x"></iframe><!-- c -->');
    expect(out).toBe('<p style="color:red">a</p><a>l</a>');
  });
});

describe('SupportRichEditor (SmartEditor2 Editor | HTML | TEXT)', () => {
  function Harness({ initial = '<p>처음</p>', disabled }: { initial?: string; disabled?: boolean }) {
    const [v, setV] = useState(initial);
    return <><SupportRichEditor id="ed" ariaLabel="내용" value={v} onChange={setV} disabled={disabled} /><output data-testid="value">{v}</output></>;
  }
  it('edits rich text, shows the HTML source, and TEXT mode turns plain text into <br> HTML', () => {
    render(<Harness />);
    const area = screen.getByRole('textbox', { name: '내용' });
    expect(area.innerHTML).toBe('<p>처음</p>');
    expect(screen.getByRole('toolbar')).toBeVisible();
    for (const b of ['굵게', '밑줄', '기울임꼴', '취소선', '링크', '표', '서식 지우기']) expect(screen.getByRole('button', { name: b })).toBeInTheDocument();
    area.innerHTML = '<p><b>굵은</b> 글</p>'; fireEvent.input(area);
    expect(screen.getByTestId('value').textContent).toBe('<p><b>굵은</b> 글</p>');

    fireEvent.click(screen.getByRole('tab', { name: 'HTML' }));
    const src = screen.getByRole('textbox', { name: '내용 (HTML)' });
    expect(src).toHaveValue('<p><b>굵은</b> 글</p>');
    fireEvent.change(src, { target: { value: '<h3>제목</h3>' } });
    expect(screen.getByTestId('value').textContent).toBe('<h3>제목</h3>');

    fireEvent.click(screen.getByRole('tab', { name: 'TEXT' }));
    const txt = screen.getByRole('textbox', { name: '내용 (TEXT)' });
    expect(txt).toHaveValue('제목');
    fireEvent.change(txt, { target: { value: '한 줄\n두 <줄>' } });
    expect(screen.getByTestId('value').textContent).toBe('한 줄<br>두 &lt;줄&gt;');

    fireEvent.click(screen.getByRole('tab', { name: 'Editor' }));
    expect(screen.getByRole('textbox', { name: '내용' }).innerHTML).toBe('한 줄<br>두 &lt;줄&gt;');
  });
  it('pasted HTML is cleaned; disabled editor is read-only', () => {
    const { unmount } = render(<Harness initial="" />);
    const area = screen.getByRole('textbox', { name: '내용' });
    fireEvent.paste(area, { clipboardData: { getData: (t: string) => (t === 'text/html' ? '<b onclick="x()">붙여넣기</b><script>bad()</script>' : '') } });
    expect(screen.getByTestId('value').textContent).toBe('<b>붙여넣기</b>');
    unmount();
    render(<Harness disabled />);
    expect(screen.getByRole('textbox', { name: '내용' })).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByRole('button', { name: '굵게' })).toBeDisabled();
  });
});

describe('support pages: PHP page size, confirm before submit, editor values', () => {
  beforeEach(() => { calls.length = 0; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); });
  afterEach(() => { vi.unstubAllGlobals(); adminTokenStore.clear(); vi.useRealTimers(); document.title = ''; });

  it('every list asks for 30 rows (include_top.php $page_size)', async () => {
    for (const [el, path] of [[<NoticesPage key="n" />, '/admin/notices'], [<FaqsPage key="f" />, '/admin/faqs'], [<CounselPage key="c" />, '/admin/counsel'], [<CheatingPage key="ch" />, '/admin/cheating'], [<InquiriesPage key="i" />, '/admin/inquiries']] as const) {
      const { unmount } = mount(el);
      await waitFor(() => expect(calls.some((c) => c.url.startsWith(`${path}?`) && c.url.includes('size=30'))).toBe(true));
      unmount();
    }
  });

  it('공지사항 수정: existing file is a bold download link, content in the editor, 등록하시겠습니까? before PATCH', async () => {
    mount(<NoticesPage />);
    fireEvent.click(await screen.findByText('점검 안내'));
    expect(await screen.findByText('서버 점검이 있습니다. 이용에 참고하세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '정보 수정' }));
    const editor = await screen.findByRole('textbox', { name: '내 용' });
    await waitFor(() => expect(editor.innerHTML).toBe('<p>서버 점검이 있습니다. 이용에 참고하세요.</p>'));
    const link = screen.getAllByRole('button', { name: '안내.pdf' }).find((b) => b.querySelector('b'));
    expect(link).toBeTruthy();
    editor.innerHTML = '<p>서버 점검 시간이 <b>변경</b>되었습니다. 참고하세요.</p>'; fireEvent.input(editor);
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    const dialog = await confirmDialog();
    expect(dialog).toHaveTextContent('등록하시겠습니까?');
    expect(calls.some((c) => c.m === 'PATCH')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.find((c) => c.m === 'PATCH' && c.url === '/admin/notices/9')?.body).toMatchObject({ Content: '<p>서버 점검 시간이 <b>변경</b>되었습니다. 참고하세요.</p>', clearFiles: [] }));
  });

  it('FAQ: 내용을 15자 이상 입력해주세요, then confirm → POST; 취소 sends nothing', async () => {
    mount(<FaqsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '신규 등록' }));
    fireEvent.change(await screen.findByLabelText(/제목/), { target: { value: '로그인 문의' } });
    const editor = screen.getByRole('textbox', { name: '내용' });
    editor.innerHTML = '짧음'; fireEvent.input(editor);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(await screen.findByText('내용을 15자 이상 입력해주세요')).toBeInTheDocument();
    editor.innerHTML = '<p>비밀번호 찾기에서 재설정하세요.</p>'; fireEvent.input(editor);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    fireEvent.click(within(await confirmDialog()).getByRole('button', { name: '취소' }));
    expect(calls.some((c) => c.m === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    fireEvent.click(within(await confirmDialog()).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.find((c) => c.m === 'POST' && c.url === '/admin/faqs')?.body).toMatchObject({ Title: '로그인 문의', Content: '<p>비밀번호 찾기에서 재설정하세요.</p>', OrderByNum: 4 }));
  });

  it('1:1 상담: a plain-text answer opens with its line breaks (nl2br like qna_read.php)', async () => {
    mount(<CounselPage />);
    fireEvent.click(await screen.findByText('진도 문의'));
    const editor = await screen.findByRole('textbox', { name: '답변 내용' });
    await waitFor(() => expect(editor.innerHTML).toBe('첫째 줄<br>둘째 줄'));
  });

  it('수강신청관리: stored &lt;script shows as "<script" text, not as markup', async () => {
    mount(<InquiriesPage />);
    fireEvent.click(await screen.findByText('테스트기업'));
    expect(await screen.findByText(/태그 <script> 문의/)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('사이트 정보: 수정 하기 is enabled without changes and saves after 등록 하시겠습니까? (PHP inserts every time)', async () => {
    mount(<SiteInfoPage />);
    await screen.findByDisplayValue('에이치알디이');
    const btn = screen.getByRole('button', { name: '수정 하기' });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    const dialog = await confirmDialog();
    expect(dialog).toHaveTextContent('등록 하시겠습니까?');
    fireEvent.click(within(dialog).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.find((c) => c.m === 'PUT')?.body).toMatchObject({ CompanyName: '에이치알디이', Address: '서울' }));
  });

  it('대시보드: header greeting with 부서명(Team) and the PHP browser title "<SiteName> (<ServerIP>)"', async () => {
    mount(<DashboardPage />, '/admin');
    expect(await screen.findByText('관리자 (부서명:운영팀)님 안녕하세요.')).toBeInTheDocument();
    expect(screen.getByText('운영팀')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('에이치알디이 (192.168.0.9)'));
  });

  it('AdminChrome pieces: greeting, 메인 side heading, footer with the site address and a link to /admin', async () => {
    mount(<><AdminChromeGreeting /><AdminMainSideMenu /><AdminFooter /></>, '/admin/notices');
    await waitFor(() => expect(screen.getByTestId('admin-greeting')).toHaveTextContent('관리자 (부서명:운영팀)님 안녕하세요.'));
    expect(screen.getByText('관리자 (부서명:운영팀)').tagName).toBe('B'); // <strong>이름 (부서명:팀)</strong>님 안녕하세요.
    expect(screen.getByRole('heading', { name: '메인' })).toBeInTheDocument();
    expect(await screen.findByText('서울특별시 구로구 디지털로')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '관리자 메인으로' })).toHaveAttribute('href', '/admin');
    expect(calls.some((c) => c.url === '/admin/dashboard/chrome')).toBe(true);
    await act(async () => undefined);
  });
});

describe('buildPhpParityMenu (include_top.php + include_submenu.php)', () => {
  const labels = (src: Parameters<typeof buildPhpParityMenu>[0]) => Object.fromEntries(buildPhpParityMenu(src).map((g) => [g.key, g.items.map((i) => i.to)]));
  it('exact sub-grants only; the top letter alone shows nothing inside the section', () => {
    const m = labels({ dept: 'B', topGrants: ['A', 'F'], subGrants: ['A1', 'F1'] });
    expect(m).toEqual({ members: ['/admin/companies'], community: ['/admin/notices'] });
    expect(labels({ dept: 'B', topGrants: ['F'], subGrants: [] })).toEqual({});
  });
  it('회원 관리 hidden for dept C; 실시간 강의 only for dept C', () => {
    const m = labels({ dept: 'C', topGrants: ['A', 'B'], subGrants: ['A1', 'B5'] });
    expect(m.members).toBeUndefined();
    expect(m.live).toEqual(['/admin/live-class']);
    expect(m.learning).toEqual(['/admin/studies', '/admin/learning/history']);
    expect(labels({ dept: 'A', topGrants: [], subGrants: [] }).live).toBeUndefined();
  });
  it('Ruby needs sub-grant F2 (or dept A); 모니터링 only dept A; 수료증/이수증 테스트 only dept A', () => {
    expect(labels({ dept: 'B', topGrants: ['F'], subGrants: ['F1'] }).ruby).toBeUndefined();
    expect(labels({ dept: 'B', topGrants: [], subGrants: ['F2'] }).ruby).toHaveLength(6);
    expect(labels({ dept: 'B', topGrants: ['B'], subGrants: ['B1', 'B8'] })).toEqual({ learning: ['/admin/learning/ip-monitor', '/admin/learning/subject-certificates'] });
    const a = labels({ dept: 'A', topGrants: [], subGrants: [] });
    expect(a.monitoring).toHaveLength(4); expect(a.ruby).toHaveLength(6); expect(a.learning).toBeUndefined();
    // dept A with top B but no B sub-grant: only the two dept-A links of include_submenu.php case "B"
    expect(labels({ dept: 'A', topGrants: ['B'], subGrants: [] }).learning).toEqual(['/admin/learning/ai-analysis', '/admin/learning/certificate-test']);
    expect(labels({ dept: 'B', topGrants: ['B', 'F'], subGrants: ['F2'] }).monitoring).toBeUndefined();
  });
  it('dept A goes through TopMenuGrant / SubMenuGrant like everyone else (include_top.php 240-276)', () => {
    const a = labels({ dept: 'A', topGrants: ['A', 'F'], subGrants: ['A1', 'A9', 'F3', 'D2'] });
    expect(a.members).toEqual(['/admin/companies', '/admin/privacy-log']);
    expect(a.community).toEqual(['/admin/counsel']);
    expect(a.content).toBeUndefined(); // D2 without top grant D
    expect(a.site).toBeUndefined();
    expect(Object.keys(a)).toEqual(['members', 'community', 'ruby', 'monitoring']);
  });
  it('PHP codes for 아카이브 / 컨텐츠 links (E1/E2/E3/E5, D2/D6, 실시간 강의실 = any E sub-grant)', () => {
    expect(labels({ dept: 'B', topGrants: ['E'], subGrants: ['E1', 'E7'] }).archive).toEqual(['/admin/courses?ctype=X', '/admin/live-courses', '/admin/inquiries']);
    expect(labels({ dept: 'B', topGrants: ['D'], subGrants: ['D1', 'D2', 'D6'] }).content).toEqual(['/admin/categories', '/admin/contents', '/admin/courses?packageYN=Y']);
    expect(labels({ dept: 'B', topGrants: ['D'], subGrants: ['D1'] }).content).toEqual(['/admin/categories']);
  });
});
