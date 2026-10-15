import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import NoticesPage from '../features/admin/pages/community/NoticesPage';
import FaqsPage from '../features/admin/pages/community/FaqsPage';
import { CheatingPage, CounselPage, InquiriesPage } from '../features/admin/pages/community/InquiryPages';
import { SiteInfoPage } from '../features/admin/pages/site/SitePages';
import DashboardPage from '../features/admin/pages/DashboardPage';
import { nl2br, revealReasonError, rowNo, statusChecks, statusFilterOf, tooShort } from '../features/admin/pages/community/support-parity.helpers';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['E', 'F', 'G'], subGrants: ['E7', 'F1', 'F2', 'F3', 'F6', 'G1'], canWrite: true } as AdminSession;
const session: AdminSessionState = { phase: 'authed', admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true };

const notices = {
  pinned: [{ idx: 9, useYN: 'Y', useLabel: '사용', pinned: true, title: '고정 공지', views: 3, regDate: '2026-10-01 00:00:00', hasFile: true, realFileName1: '안내.pdf', fileCount: 1 }],
  items: [{ idx: 5, useYN: 'N', useLabel: '미사용', pinned: false, title: '일반 공지', views: 1, regDate: '2026-09-01 00:00:00', hasFile: false, realFileName1: null, fileCount: 0 }], page: 1, size: 20, total: 1,
};
const noticeDetail = { ...notices.pinned[0], content: '<p>고정 공지 본문</p>', files: [{ slot: 1, file: 'a.pdf', name: '안내.pdf', fileName: 'a.pdf', realFileName: '안내.pdf' }], uploadEnabled: true };
const faqs = { items: [{ idx: 3, order: 2, category: 'D', categoryLabel: '로그인', title: '로그인이 안 돼요', useYN: 'Y', useLabel: '사용', regDate: '2026-10-01 00:00:00' }], page: 1, size: 20, total: 1 };
const faqMeta = { categories: [{ value: 'A', label: '일반' }, { value: 'B', label: '동영상' }, { value: 'C', label: '학습진도' }, { value: 'D', label: '로그인' }, { value: 'E', label: '기타문의' }], nextOrder: 9 };
const counsel = { items: [{ idx: 11, id: 'user01', name: '사용자', category: 'A', categoryLabel: '학습 내용 문의', title: '진도 문의', regDate: '2026-10-02 10:00:00', regDate2: '-', status: 'A', statusLabel: '대기', answered: false, mobile: '010-****-3333', email: '*******@example.com', lectureCode: 'D00001' }], page: 1, size: 20, total: 1 };
const counselMeta = { categories: faqMeta.categories.map((c, i) => ({ value: c.value, label: ['학습 내용 문의', '시스템 문의', '이의 제기', '수강 관련 문의', '결제 관련 문의'][i]! })), statuses: [{ value: 'A', label: '대기' }, { value: 'B', label: '완료' }], revealGubun: ['학습자 관리', '학습자 요청', '기타 상담'], uploadEnabled: true };
const counselDetail = { idx: 11, lectureCode: 'D00001', courseName: '리더십 과정', contentsTitle: '1. 리더십, 왜 필요한데?', studySeq: 0, contentsIdx: 11, title: '진도 문의', name: '사용자', id: 'user01', category: 'A', categoryLabel: '학습 내용 문의', mobile: '010-****-3333', email: '*******@example.com', hasMobile: true, hasEmail: true, regDate: '2026-10-02 10:00:00', regDate2: '-', contents: '<p>진도가 안 올라가요</p>', studentFile: { fileName: 's.png', realFileName: '캡처.png' }, status: 'A', statusLabel: '대기', name2: '관리자', contents2: null, files: [], uploadEnabled: true };
const cheating = { items: [{ idx: 21, name: '제보자', category: 'B', categoryLabel: '이메일', mobile: '010-9999-0000', email: 'rep@example.com', title: '대리수강 제보', contents: '내용', regDate: '2026-10-03 00:00:00', status: 'A', statusLabel: '대기', answeredBy: null, answeredAt: null }], page: 1, size: 20, total: 1 };
const inquiries = { items: [{ idx: 31, serviceType: '1', serviceTypeLabel: 'HRDe아카이브', companyName: '테스트기업', name: '담당자', phone: '02-123-4567', email: 'hr@example.com', personnel: '30', contents: '교육 문의\n두번째 줄', agreeYN: 'Y', regDate: '2026-10-04 00:00:00', status: 'A', statusLabel: '대기', answer: { name: null, contents: null, regDate: null, mdfDate: null } }], page: 1, size: 20, total: 1 };
const site = { idx: 2, companyName: '에이치알디이', ceo: '홍길동', companyNumber: '123-45-67890', salesReportNumber: '2026-0001', phone: '1811-9530', fax: '02-000-0000', email: 'help@example.com', personalInformationManager: '책임자', address: '서울', copyright: 'Copyright', kakaoUrl: null, regDate: '2026-10-14 10:52:42' };
const dashboard = { today: '2026-10-15', monthStart: '2026-10-01', logins: { today: 7, uniqueUsers: 3 }, activePlayers: { count: 0, freshnessSeconds: 90 }, learnersOver15hThisMonth: 1, activeEnrollments: 2, emon: { pending: 3, pendingStale: 0 }, support: { openInquiries: 1, openCounsel: 2, openCheating: 4 }, signupsToday: 4, welcome: { id: 'admin01', name: '관리자', deptName: 'LMS개발부', loginAt: '2026-10-15 09:00:00', clientIp: '10.0.0.5', serverIp: '192.168.0.9' }, rubyShortcuts: true };

const calls: { m: string; url: string; body?: unknown }[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/v1/, ''); const method = init?.method ?? 'GET';
    let body: unknown; try { body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body; } catch { body = init?.body; }
    calls.push({ m: method, url, body });
    if (url.startsWith('/admin/notices/9')) return json(noticeDetail);
    if (url.startsWith('/admin/notices')) return json(notices);
    if (url.startsWith('/admin/faqs/meta')) return json(faqMeta);
    if (url.startsWith('/admin/faqs')) return json(faqs);
    if (url.startsWith('/admin/counsel/meta')) return json(counselMeta);
    if (url.startsWith('/admin/counsel/11/reveal')) return json({ ok: true, field: 'Mobile', label: '휴대폰', value: '010-2222-3333' });
    if (url.startsWith('/admin/counsel/11/answer')) return json({ ok: true, status: 'B', answerDateSet: true, notify: { attempted: true, ok: false, code: 'SEND_NOT_CONFIGURED', logIdx: 1, message: 'x' } });
    if (url.startsWith('/admin/counsel/11')) return json(counselDetail);
    if (url.startsWith('/admin/counsel')) return json(counsel);
    if (url.startsWith('/admin/cheating/21/status')) return json({ ok: true, status: 'B' });
    if (url.startsWith('/admin/cheating/21')) return json({ ...cheating.items[0], statuses: counselMeta.statuses });
    if (url.startsWith('/admin/cheating')) return json(cheating);
    if (url.startsWith('/admin/inquiries/31/answer')) return json({ ok: true, status: 'B', firstAnswer: true });
    if (url.startsWith('/admin/inquiries/31')) return json({ ...inquiries.items[0], statuses: counselMeta.statuses });
    if (url.startsWith('/admin/inquiries')) return json(inquiries);
    if (url.startsWith('/admin/site-info')) return method === 'PUT' ? json({ ok: true, updated: 1, fields: ['Phone'], idx: 3, previousIdx: 2 }) : json(site);
    if (url.startsWith('/admin/dashboard')) return json(dashboard);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (el: ReactElement, path = '/x') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};

describe('support-parity.helpers', () => {
  it('rowNo / statusFilterOf / statusChecks / revealReasonError / tooShort / nl2br', () => {
    expect(rowNo(45, 2, 20, 0)).toBe(25);
    expect(statusFilterOf(true, false)).toBe('A'); expect(statusFilterOf(true, true)).toBe('A,B'); expect(statusFilterOf(false, false)).toBe('');
    expect(statusChecks('')).toEqual({ all: true, wait: false, done: false }); expect(statusChecks('A,B')).toEqual({ all: false, wait: true, done: true });
    expect(revealReasonError('본인 요청')).toBe(''); expect(revealReasonError('')).toMatch(/사유/); expect(revealReasonError('확인!')).toMatch(/공백만/);
    expect(tooShort('짧음')).toBe(true); expect(tooShort('열다섯 글자 이상인 답변 내용입니다')).toBe(false);
    expect(nl2br('a<b>\nc')).toBe('a&lt;b&gt;<br>c');
  });
});

describe('support parity pages', () => {
  beforeEach(() => { calls.length = 0; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); });
  afterEach(() => { vi.unstubAllGlobals(); adminTokenStore.clear(); });

  it('공지사항: pinned 공지 row first, PHP columns, read drawer with 첨부 파일 1~5', async () => {
    mount(<NoticesPage />, '/admin/notices?col=Content&q=점검');
    expect(await screen.findByText('고정 공지')).toBeInTheDocument();
    for (const h of ['번호', '제목', '첨부', '등록일', '조회', '사용 유무']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('공지'); expect(rows[1]).toHaveTextContent('안내.pdf');
    expect(rows[2]).toHaveTextContent('1'); expect(rows[2]).toHaveTextContent('미사용');
    expect(calls.some((c) => c.url.includes('col=Content') && c.url.includes('q='))).toBe(true);
    fireEvent.click(screen.getByText('고정 공지'));
    expect(await screen.findByText('고정 공지 본문')).toBeInTheDocument();
    for (const n of [1, 2, 3, 4, 5]) expect(screen.getByText(`첨부 파일 ${n}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '정보 수정' })).toBeEnabled();
  });

  it('FAQ: 구분 tabs, PHP columns, 신규 등록 prefills 정렬 순서 = MAX+1', async () => {
    mount(<FaqsPage />);
    expect(await screen.findByText('로그인이 안 돼요')).toBeInTheDocument();
    for (const h of ['번호', '정렬 순서', '구분', '제목', '등록일', '사용 유무']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '동영상' }));
    await waitFor(() => expect(calls.some((c) => c.url.startsWith('/admin/faqs?') && c.url.includes('category=B'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '신규 등록' }));
    expect(await screen.findByLabelText(/정렬 순서/)).toHaveValue('9');
  });

  it('1:1 상담: filters, masked contact → reveal with reason, answer posts Status/Name2', async () => {
    mount(<CounselPage />);
    expect(await screen.findByText('진도 문의')).toBeInTheDocument();
    for (const h of ['번호', '문의종류', 'ID', '이름', '제목', '등록일시', '답변일시', '처리상태']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /검색항목 엑셀 출력/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText('진도 문의'));
    expect(await screen.findByText('리더십 과정')).toBeInTheDocument();
    expect(screen.getByText('1. 리더십, 왜 필요한데?')).toBeInTheDocument();
    expect(screen.getByText('캡처.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '010-****-3333' }));
    const dialog = await screen.findByRole('dialog', { name: /개인정보 열람사유/ });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '본인 확인 요청' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '등록 하기' }));
    expect(await screen.findByText('010-2222-3333')).toBeInTheDocument();
    expect(calls.find((c) => c.url === '/admin/counsel/11/reveal')?.body).toEqual({ field: 'Mobile', gubun: '학습자 관리', reason: '본인 확인 요청' });
    const st = screen.getByRole('combobox', { name: /처리 상태/ }); st.focus(); fireEvent.keyDown(st, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: '완료' }));
    fireEvent.change(screen.getByLabelText(/답변 내용/), { target: { value: '진도가 반영되었습니다. 확인 부탁드립니다.' } });
    fireEvent.click(screen.getByRole('button', { name: '답변 하기' }));
    await waitFor(() => expect(calls.find((c) => c.m === 'PATCH' && c.url === '/admin/counsel/11/answer')?.body).toMatchObject({ Status: 'B', Name2: '관리자', Contents2: '진도가 반영되었습니다. 확인 부탁드립니다.' }));
  });

  it('부정제보: PHP columns and the 상태 변경 form', async () => {
    mount(<CheatingPage />);
    expect(await screen.findByText('대리수강 제보')).toBeInTheDocument();
    for (const h of ['번호', '문의종류', '이름', '제목', '등록일', '상태', '답변자']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    fireEvent.click(screen.getByText('대리수강 제보'));
    expect(await screen.findByText('rep@example.com')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/작성자/), { target: { value: '관리자' } });
    fireEvent.click(screen.getByRole('button', { name: '상태 변경' }));
    await waitFor(() => expect(calls.find((c) => c.url === '/admin/cheating/21/status')?.body).toEqual({ Status: 'A', Name2: '관리자' }));
  });

  it('수강신청관리: PHP columns, detail with 예상인원, first answer needs 작성자', async () => {
    mount(<InquiriesPage />);
    expect(await screen.findByText('테스트기업')).toBeInTheDocument();
    for (const h of ['번호', '문의종류', '회사명', '문의자 이름', '문의일', '처리상태']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    fireEvent.click(screen.getByText('테스트기업'));
    expect(await screen.findByText('30명')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/답변 내용/), { target: { value: '담당자가 곧 연락드리겠습니다. 감사합니다.' } });
    fireEvent.click(screen.getByRole('button', { name: '답변 하기' }));
    expect(await screen.findByText('작성자를 입력하세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/작성자/), { target: { value: '영업팀' } });
    fireEvent.click(screen.getByRole('button', { name: '답변 하기' }));
    await waitFor(() => expect(calls.find((c) => c.url === '/admin/inquiries/31/answer')?.body).toEqual({ Status: 'A', Contents2: '담당자가 곧 연락드리겠습니다. 감사합니다.', Name2: '영업팀' }));
  });

  it('사이트 정보 관리: PHP labels, required check, PUT with every field', async () => {
    mount(<SiteInfoPage />);
    expect(await screen.findByDisplayValue('에이치알디이')).toBeInTheDocument();
    for (const l of ['상호명', '대표자명', '사업자등록번호', '통신판매업신고번호', '고객상담센터 번호', 'FAX', '이메일', '개인정보책임자', '주소', 'Copyright', 'Kakao 채널 URL']) expect(screen.getByText(l)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/FAX/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '수정 하기' }));
    expect(await screen.findByText('FAX를 입력하세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/FAX/), { target: { value: '02-111-1111' } });
    fireEvent.click(screen.getByRole('button', { name: '수정 하기' }));
    await waitFor(() => expect(calls.find((c) => c.m === 'PUT')?.body).toMatchObject({ CompanyName: '에이치알디이', Fax: '02-111-1111', KakaoURL: '' }));
  });

  it('대시보드: main.php welcome box and Ruby RAG shortcuts', async () => {
    mount(<DashboardPage />, '/admin');
    expect(await screen.findByText('2026-10-15 09:00:00')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.9')).toBeInTheDocument();
    expect(screen.getByText('Ruby RAG 관리 바로가기')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Knowledge Base' })).toHaveAttribute('href', '/admin/ruby/kb');
    expect(screen.getByText('미처리 부정제보')).toBeInTheDocument();
  });
});
