import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { DEFAULT_DESIGN, type CompanyInfo } from '@ainex/contracts';
import { SessionContext, type SessionState } from '../shared/auth/useSession';
import { DesignContext, type DesignState } from '../shared/design/useDesign';
import { API_BASE } from '../shared/api/client';
import NoticeListPage from '../features/support/NoticeListPage';
import NoticeDetailPage from '../features/support/NoticeDetailPage';
import FaqPage from '../features/support/FaqPage';
import CounselPage from '../features/support/CounselPage';
import MyCounselPage from '../features/support/MyCounselPage';
import CounselDetailPage from '../features/support/CounselDetailPage';
import InquiryNewPage from '../features/support/InquiryNewPage';
import CheatingPage from '../features/support/CheatingPage';
import ResourcesPage from '../features/support/ResourcesPage';
import ResourceDetailPage from '../features/support/ResourceDetailPage';
import ArchivingPage from '../features/support/ArchivingPage';
import EventsPage from '../features/support/EventsPage';
import LivePage from '../features/live/LivePage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sessionOf = (authed: boolean) => ({ phase: authed ? 'authed' : 'guest', user: null, roles: [], isAuthed: authed, login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), patchUser: vi.fn() }) as unknown as SessionState;
const design = { config: DEFAULT_DESIGN, company: {} as CompanyInfo, assets: {}, etag: null, source: 'default', preview: false, reload: () => {} } as DesignState;
const CAPTCHA = { token: 'captcha-token-1', image: 'data:image/png;base64,AAAA', width: 200, height: 64, expiresIn: 600 };

interface Call { method: string; url: string; body: unknown }
let calls: Call[];
let routes: Record<string, (c: Call) => Response>;

function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, '');
    const method = init?.method ?? 'GET';
    const body = init?.body instanceof FormData ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : `file:${(v as File).name}`])) : init?.body ? JSON.parse(String(init.body)) : undefined;
    const call = { method, url, body };
    calls.push(call);
    const key = Object.keys(routes).find((k) => `${method} ${url}`.startsWith(k));
    if (key) return routes[key]!(call);
    if (url.startsWith('/support/captcha')) return json(CAPTCHA);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

function mount(ui: ReactNode, path: string, route = '*', authed = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><DesignContext.Provider value={design}><SessionContext.Provider value={sessionOf(authed)}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={ui} /></Routes></MemoryRouter>
    </SessionContext.Provider></DesignContext.Provider></MotionConfig></QueryClientProvider>,
  );
}

const page = <T,>(items: T[], extra: Record<string, unknown> = {}) => json({ items, page: 1, size: 25, total: items.length, ...extra });

describe('고객지원 learner pages', () => {
  beforeEach(() => { calls = []; routes = {}; vi.stubGlobal('fetch', apiMock()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('공지사항: 25 per page, 공지 label instead of a number, 번호 for the rest, detail attachment links to the API file route', async () => {
    routes['GET /support/notices?'] = () => page([{ idx: 9, no: 2, title: '중요 공지', pinned: true, viewCount: 3, regDate: '2026-10-20 10:00:00', hasAttachment: false }, { idx: 8, no: 1, title: '일반 공지', pinned: false, viewCount: 1, regDate: '2026-10-19 10:00:00', hasAttachment: true }]);
    const { unmount } = mount(<NoticeListPage />, '/support/notice');
    expect(await screen.findByText('중요 공지')).toBeInTheDocument();
    expect(calls[0]!.url).toContain('size=25');
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]!).getByText('공지')).toBeInTheDocument();
    expect(within(rows[2]!).getAllByRole('cell')[0]).toHaveTextContent(/^1$/);
    unmount();
    routes['GET /support/notices/8'] = () => json({ idx: 8, title: '일반 공지', content: '<p>본문</p>', pinned: false, viewCount: 2, regDate: '2026-10-19 10:00:00', attachments: [{ slot: 1, name: '안내.pdf', url: '/support/notices/8/files/1' }] });
    mount(<NoticeDetailPage />, '/support/notice/8', '/support/notice/:id');
    expect(await screen.findByRole('link', { name: /안내\.pdf/ })).toHaveAttribute('href', `${API_BASE}/support/notices/8/files/1`);
  });

  it('FAQ: all five 분류 tabs plus 전체, a tab sends category=, answers fold out', async () => {
    routes['GET /support/faqs'] = () => json({ items: [{ idx: 1, no: 1, category: 'B', categoryName: '동영상', title: '영상이 멈춰요', content: '새로고침 해 보세요.' }], page: 1, size: 10, total: 1, categories: [{ value: 'A', label: '일반' }, { value: 'B', label: '동영상' }, { value: 'C', label: '학습진도' }, { value: 'D', label: '로그인' }, { value: 'E', label: '기타문의' }] });
    mount(<FaqPage />, '/support/faq');
    expect(await screen.findByText('영상이 멈춰요')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: '자주 묻는 질문' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['전체', '일반', '동영상', '학습진도', '로그인', '기타문의']);
    fireEvent.click(within(group).getByRole('button', { name: '동영상' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('category=B'))).toBe(true));
    expect(calls.every((c) => !c.url.includes('size=') || c.url.includes('size=10'))).toBe(true);
  });

  it('1:1 문의: login required; sends $Counsel_array code, 보안코드 and the optional file as multipart; refreshes the picture after a failure', async () => {
    const { unmount } = mount(<CounselPage />, '/support/counsel', '*', false);
    expect(await screen.findByText('로그인 후 문의를 남겨 주세요.')).toBeInTheDocument();
    unmount();
    routes['GET /support/counsel/options'] = () => json({ categories: [{ value: 'A', label: '학습 내용 문의' }, { value: 'B', label: '시스템 문의' }], enrollments: [{ studySeq: 2, lectureCode: 'ARC2026', title: 'HRD 아카이브 2026', lectureStart: null, lectureEnd: null }] });
    let attempt = 0;
    routes['POST /support/counsel'] = () => (++attempt === 1 ? json({ error: { code: 'VALIDATION', message: '보안코드가 일치하지 않습니다. 보안코드 이미지를 새로고침하여 다시 시도해주세요.', details: [{ path: 'captchaCode', message: '보안코드가 일치하지 않습니다.' }] } }, 400) : json({ ok: true, idx: 77 }));
    mount(<CounselPage />, '/support/counsel');
    expect(await screen.findByAltText('보안코드 그림')).toHaveAttribute('src', CAPTCHA.image);
    expect(screen.getByRole('combobox', { name: /관련 콘텐츠/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/문의 제목/), { target: { value: '학습시간 문의' } });
    fireEvent.change(screen.getByLabelText(/문의 내용/), { target: { value: '인정시간 확인 요청' } });
    fireEvent.change(screen.getByLabelText(/^보안코드/), { target: { value: '1234a5' } });
    const file = new File(['%PDF'], '캡처.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/첨부파일/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '문의 등록' }));
    expect(await screen.findByText('보안코드가 일치하지 않습니다.')).toBeInTheDocument();
    const first = calls.find((c) => c.method === 'POST')!;
    expect(first.body).toMatchObject({ category: 'A', title: '학습시간 문의', contents: '인정시간 확인 요청', captchaToken: 'captcha-token-1', captchaCode: '12345', file: 'file:캡처.pdf' });
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/support/captcha')).length).toBeGreaterThanOrEqual(2));
    expect(screen.getByLabelText(/^보안코드/)).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/^보안코드/), { target: { value: '54321' } });
    fireEvent.click(screen.getByRole('button', { name: '문의 등록' }));
    expect(await screen.findByText('상담 문의 등록 완료')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '접수한 문의 보기' })).toHaveAttribute('href', '/support/my/77');
  });

  it('내 문의: own list with 대기/완료 and the answer block with "…의 답변입니다."', async () => {
    routes['GET /support/counsel?'] = () => page([{ idx: 5, no: 1, category: 'A', categoryName: '학습 내용 문의', title: '질문', status: 'B', statusLabel: '완료', answered: true, regDate: '2026-10-20 10:00:00', answeredAt: '2026-10-21 09:00:00', lectureCode: null, studySeq: null }]);
    const { unmount } = mount(<MyCounselPage />, '/support/my');
    expect(await screen.findByText('질문')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /질문/ })).toHaveAttribute('href', '/support/my/5');
    unmount();
    routes['GET /support/counsel/5'] = () => json({ idx: 5, category: 'A', categoryName: '학습 내용 문의', title: '질문', contents: '본문', status: 'B', statusLabel: '완료', answered: true, regDate: '2026-10-20 10:00:00', lectureCode: null, courseName: null, studySeq: null, studentFile: null, answer: { name: '운영자', contents: '<p>답변</p>', regDate: '2026-10-21 09:00:00', attachments: [] } });
    mount(<CounselDetailPage />, '/support/my/5', '/support/my/:id');
    expect(await screen.findByText('AINEX 아카이브 운영자의 답변입니다.')).toBeInTheDocument();
  });

  it('기업교육상담 (비회원): PHP-required fields and messages, extras + 보안코드 in the body, notified=false explained', async () => {
    routes['POST /support/inquiries'] = () => json({ ok: true, idx: 3, notified: false, notifyCode: 'SEND_NOT_CONFIGURED' });
    mount(<InquiryNewPage />, '/support/inquiry/new', '*', false);
    await screen.findByAltText('보안코드 그림');
    fireEvent.click(screen.getByRole('button', { name: '상담 신청' }));
    expect((await screen.findAllByText('회사명을 입력하세요.')).length).toBeGreaterThan(0);
    expect(screen.getByText('예상인원을 입력하세요.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.change(screen.getByLabelText(/기업·기관명/), { target: { value: '아이넥스' } });
    fireEvent.change(screen.getByLabelText(/담당자명/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/^연락처/), { target: { value: '010-1234-5678' } });
    fireEvent.change(screen.getByLabelText(/^이메일/), { target: { value: 'hr@example.co.kr' } });
    fireEvent.change(screen.getByLabelText(/교육 예정 인원/), { target: { value: '30명' } });
    fireEvent.change(screen.getByLabelText(/교육 대상/), { target: { value: '신입사원' } });
    fireEvent.change(screen.getByLabelText(/교육 목적·상담 내용/), { target: { value: '상담 요청' } });
    fireEvent.change(screen.getByLabelText(/^보안코드/), { target: { value: '24680' } });
    fireEvent.click(screen.getByLabelText('위 개인정보 수집 및 이용에 동의합니다.'));
    fireEvent.click(screen.getByRole('button', { name: '상담 신청' }));
    expect(await screen.findAllByText('예상인원은 숫자만 입력하세요.')).not.toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/교육 예정 인원/), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: '상담 신청' }));
    expect(await screen.findByText('상담 신청이 접수되었습니다.')).toBeInTheDocument();
    expect(screen.getByText(/담당자 자동 알림은 아직 연결되지 않아/)).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toMatchObject({ companyName: '아이넥스', phone: '010-1234-5678', personnel: '30', operatingType: 'undecided', target: '신입사원', agree: true, captchaToken: 'captcha-token-1', captchaCode: '24680' });
    expect((post.body as Record<string, unknown>).website).toBeUndefined();
  });

  it('부정행위 제보: 성명·이메일·연락처 are required like cheating_ok.php, no member id is sent', async () => {
    routes['POST /support/cheating-reports'] = () => json({ ok: true, idx: 4 });
    mount(<CheatingPage />, '/support/cheating?tab=report', '*', false);
    await screen.findByAltText('보안코드 그림');
    fireEvent.change(screen.getByLabelText(/^제목/), { target: { value: '대리수강 제보' } });
    fireEvent.change(screen.getByLabelText(/^내용/), { target: { value: '의심 사례' } });
    fireEvent.click(screen.getByRole('button', { name: '제보하기' }));
    expect(await screen.findAllByText('필수 입력 항목이 누락되었습니다.')).toHaveLength(3);
    expect(screen.getByText('제보회신 방법을 선택해주세요.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('학습자료실: 공통역량 tab by default, public download link, 찜 toggle', async () => {
    routes['GET /support/edudata?'] = () => json({ items: [{ idx: 21, no: 1, title: '교안 모음', category: 'A', categoryName: '공통역량', viewCount: 0, regDate: '2026-10-01 00:00:00', hasAttachment: true }], page: 1, size: 10, total: 1, categories: [{ value: 'A', label: '공통역량' }] });
    const { unmount } = mount(<ResourcesPage />, '/support/resources');
    expect(await screen.findByText('교안 모음')).toBeInTheDocument();
    expect(calls[0]!.url).toContain('category=A');
    unmount();
    let scrapped = false;
    routes['GET /support/edudata/21'] = () => json({ idx: 21, title: '교안 모음', content: '본문', category: 'A', categoryName: '공통역량', viewCount: 1, regDate: '2026-10-01 00:00:00', attachments: [{ slot: 1, name: '교안.pdf', url: '/support/edudata/21/files/1' }], scrapped });
    routes['POST /support/edudata/21/scrap'] = () => { scrapped = true; return json({ ok: true, scrapped: true }); };
    mount(<ResourceDetailPage />, '/support/resources/21', '/support/resources/:id');
    expect(await screen.findByRole('link', { name: /교안\.pdf/ })).toHaveAttribute('href', `${API_BASE}/support/edudata/21/files/1`);
    fireEvent.click(screen.getByRole('button', { name: '학습자료 찜하기' }));
    expect(await screen.findByText('학습자료 찜하기가 완료되었습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '학습자료 찜 취소하기' })).toBeInTheDocument();
  });

  it('아카이빙: requires a file of an allowed type before posting', async () => {
    routes['GET /support/archiving'] = () => page([]);
    routes['POST /support/archiving'] = () => json({ ok: true, idx: 1 });
    mount(<ArchivingPage />, '/support/archiving');
    expect(await screen.findByText('등록된 콘텐츠가 없습니다.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^내용/), { target: { value: '사내 교육 영상' } });
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    expect(await screen.findByText('파일을 등록해주세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/파일 업로드/), { target: { files: [new File(['x'], 'a.zip')] } });
    expect(await screen.findByText('mp4, vod, pdf, doc, docx, xls, xlsx, hwp 파일만 업로드 가능합니다.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/파일 업로드/), { target: { files: [new File(['%PDF'], '교육.pdf')] } });
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    expect(await screen.findByText('등록되었습니다.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ title: '기업자체컨텐츠 등록 요청', contents: '사내 교육 영상', file: 'file:교육.pdf' });
  });

  it('이벤트: static page, no API call', () => {
    mount(<EventsPage />, '/support/events');
    expect(screen.getByText('진행 중인 이벤트가 없습니다.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('토론방·라이브: my 실시간 강의실 enrolments, the blocked reasons, and the PHP-shaped entry opened in a new window', async () => {
    routes['GET /support/live'] = () => json({ liveClassUrl: 'https://live.hrdeedu.co.kr', entryAvailable: true, signedIn: true,
      enrollments: [{ studySeq: 1, lectureCode: 'L1', title: '라이브 특강', professor: '김강사', contentsTime: '1', lectureStart: '2026-10-01', lectureEnd: '2026-12-31', window: 'open', windowLabel: '이용 중' }],
      schedule: { available: false, reason: '라이브 일정·참여기록은 라이브 클래스 서버에 있습니다.' }, discussions: { available: false, reason: '토론방 게시판은 현재 데이터베이스에 없습니다.', items: [] } });
    routes['POST /support/live/entry'] = () => json({ launchUrl: 'https://live.hrdeedu.co.kr?token=abc', records: false, notice: 'x' });
    const tab = { opener: {} as unknown };
    const open = vi.fn(() => tab as Window);
    vi.stubGlobal('open', open);
    mount(<LivePage />, '/live');
    expect(await screen.findByText('라이브 특강')).toBeInTheDocument();
    expect(screen.getByText('이용 중')).toBeInTheDocument();
    expect(screen.getByText('토론방 게시판은 현재 데이터베이스에 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '입장하기' }));
    // new tab without 'noopener' (that feature makes window.open return null → the page reported a blocked popup); opener cut instead
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://live.hrdeedu.co.kr?token=abc', '_blank'));
    expect(tab.opener).toBeNull();
    expect(screen.queryByText('새 창을 열지 못했습니다. 팝업 허용 상태를 확인한 뒤 다시 입장해 주세요.')).not.toBeInTheDocument();
  });
});
