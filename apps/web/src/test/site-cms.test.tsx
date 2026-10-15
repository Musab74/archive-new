import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
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
import VisitStatsPage from '../features/admin/pages/site-cms/VisitStatsPage';
import MyInfoPage from '../features/admin/pages/site-cms/MyInfoPage';
import { isContinuedValue, joinPhone, rowNumber, splitPhone, staffPasswordError, validatePopupForm, ymd8ToIso } from '../features/admin/pages/site-cms/siteCms.helpers';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin: AdminSession = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['F', 'G'], subGrants: ['F4', 'F5', 'F7', 'G2', 'G3'], canWrite: true } as AdminSession;
const session: AdminSessionState = { phase: 'authed', admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin, logout: async () => undefined, extend: async () => true };

const reviews = { items: [{ idx: 7, lectureCode: 'ARC2026', courseName: '아카이브 과정', id: 'user01', starPoint: 4, stars: '★★★★☆', title: '도움이 됐어요', ip: '10.0.0.1', regDate: '2026-10-01 10:00:00', viewCount: 3 }], page: 1, size: 20, total: 1 };
const archiving = { items: [{ idx: 3, id: 'user01', title: '자료 요청', regDate: '2026-10-02 09:00:00', regDate2: null, status: 'A', statusLabel: '대기', replier: null, hasFile: true }], page: 1, size: 20, total: 1 };
const archivingDetail = { idx: 3, id: 'user01', name: '홍길동', email: 'u@x.kr', mobile: '010-1111-2222', companyName: '테스트기업', title: '자료 요청', contents: '<p>본문</p>', regDate: '2026-10-02 09:00:00', fileName1: 'a.pdf', realFileName1: '원본.pdf', status: 'A', statusLabel: '대기', name2: null, contents2: null, regDate2: null };
const edudata = { items: [{ idx: 8, useYN: 'Y', useLabel: '사용', notice: 'N', category: 'A', categoryLabel: '공통역량', title: '일반 자료', content: null, files: [{ slot: 1, fileName: 'f.pdf', realFileName: '교안.pdf' }], firstFile: '교안.pdf', viewCount: 2, regDate: '2026-10-03 00:00:00' }], notices: [{ idx: 9, useYN: 'Y', useLabel: '사용', notice: 'Y', category: 'D', categoryLabel: 'HRDe++', title: '공지 자료', content: null, files: [], firstFile: null, viewCount: 0, regDate: '2026-10-04 00:00:00' }], page: 1, size: 20, total: 1 };
const edudataMeta = { categories: [{ value: 'A', label: '공통역량' }, { value: 'E', label: '기타' }], uploadEnabled: false, uploadDir: '/web/hrde/html/upload' };
const events = { items: [{ idx: 1, id: 'user01', name: '홍길동', mobile: '010-1111-2222', stage: 10, stageLabel: '10Days', stageCount: 2, status: 'A', statusLabel: '대기', regDate: '2026-10-01 00:00:00' }], page: 1, size: 20, total: 1 };
const popups = { items: [{ idx: 4, title: '추석 이벤트', imgName: '20261001.png', imgWidth: '400', imgHeight: '300', popupLeft: '200', popupTop: '50', endDate: '20261231', useYN: 'Y', regDate: '2026-10-01 00:00:00', regDay: '2026-10-01', mobile: { imgName: null, imgWidth: '', imgHeight: '', popupLeft: '', popupTop: '' } }], page: 1, size: 25, total: 1, uploadEnabled: true };
const backups = { items: [{ idx: 1, regDate: '2026-10-01 08:10:00', regDay: '2026-10-01', backupType: 'NAS', backupInterval: 'daily', expiryDate: '2026-11-01 00:00:00', expiryDay: '2026-11-01', webFile: 'web.tgz', weblogFile: 'log.tgz', dbFile: 'db.sql.gz', vodFile: 'vod.tgz' }], page: 1, size: 20, total: 1 };
const stats = { year: 2026, month: 10, days: [{ day: 1, total: 5, hours: [2, ...Array(22).fill(0), 3] }], totals: { total: 5, hours: [2, ...Array(22).fill(0), 3] } };
const myInfo = { id: 'sales01', dept: 'B', deptIdx: 2, deptName: '영업1팀', deptPath: '영업부 > 영업1팀', name: '영업', team: '영업1팀', mobile: '010-1234-5678', phone: '02-123-4567', email: 's@x.kr', bankName: '국민', bankNumber: '1-2', useYN: 'Y', lastLogin: null, lastLoginIp: null, showBank: true };

const calls: string[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/^.*\/v1/, '')}`);
    if (url.includes('/admin/reviews/7')) return json({ ...reviews.items[0], contents: '강의가 알찼습니다.' });
    if (url.includes('/admin/reviews')) return json(reviews);
    if (url.includes('/admin/archiving/3/reply')) return json({ ok: true, updated: 1 });
    if (url.includes('/admin/archiving/3')) return json(archivingDetail);
    if (url.includes('/admin/archiving')) return json(archiving);
    if (url.endsWith('/admin/edudata/meta')) return json(edudataMeta);
    if (url.includes('/admin/edudata')) return json(edudata);
    if (url.includes('/admin/lecture-events/1')) return json({ ...events.items[0], statusRegDate: null, statusName: null });
    if (url.includes('/admin/lecture-events')) return json(events);
    if (url.includes('/admin/popups')) return json(popups);
    if (url.includes('/admin/backups')) return json(backups);
    if (url.includes('/admin/visit-stats')) return json(stats);
    if (url.endsWith('/admin/my-info')) return method === 'PUT' ? json({ ok: true, passwordChanged: false }) : json(myInfo);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}

const mount = (el: ReactElement, path = '/x') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};

describe('siteCms.helpers', () => {
  it('splitPhone / joinPhone round-trip like the three my_info inputs', () => {
    expect(splitPhone('010-1234-5678')).toEqual(['010', '1234', '5678']);
    expect(splitPhone('0212345678')).toEqual(['0212345678', '', '']);
    expect(splitPhone(null)).toEqual(['', '', '']);
    expect(joinPhone('010', '1234', '5678')).toBe('010-1234-5678');
    expect(joinPhone('', '', '')).toBe('');
  });
  it('staffPasswordError mirrors my_info.php CheckPassword()', () => {
    expect(staffPasswordError('Ainex2026ok')).toBe('');
    expect(staffPasswordError('Abc!2345')).toBe('');
    expect(staffPasswordError('zxqwvpmnbt')).toMatch(/2개 이상/);
    expect(staffPasswordError('abcdef!234')).toMatch(/연속 또는 반복/);
    expect(isContinuedValue('123456', 6)).toBe(true);
    expect(isContinuedValue('12345', 6)).toBe(false);
  });
  it('validatePopupForm reproduces send_ok() checks', () => {
    const ok = { EndDate: '20261231', Title: 't', ImgWidth: '400', ImgHeight: '300', PopupLeft: '200', PopupTop: '50', ImgWidthMobile: '', ImgHeightMobile: '', PopupLeftMobile: '', PopupTopMobile: '' };
    expect(validatePopupForm(ok)).toEqual({});
    const bad = validatePopupForm({ ...ok, EndDate: '2026-12', Title: '', ImgWidth: 'abc', PopupTop: '', ImgWidthMobile: 'x' });
    expect(bad.EndDate).toMatch(/8자리/); expect(bad.Title).toMatch(/제목/); expect(bad.ImgWidth).toMatch(/숫자만/); expect(bad.PopupTop).toMatch(/입력하세요/); expect(bad.ImgWidthMobile).toMatch(/숫자만/);
  });
  it('ymd8ToIso / rowNumber', () => {
    expect(ymd8ToIso('20261231')).toBe('2026-12-31'); expect(ymd8ToIso('x')).toBe('x');
    expect(rowNumber(45, 2, 20, 0)).toBe(25); expect(rowNumber(45, 1, 20, 4)).toBe(41);
  });
});

describe('site-cms admin pages render the legacy columns from the API shapes', () => {
  beforeEach(() => { calls.length = 0; adminTokenStore.set('adm', 900); vi.stubGlobal('fetch', apiMock()); });
  afterEach(() => { vi.unstubAllGlobals(); adminTokenStore.clear(); });

  it('수강후기: list columns, ★ rating and the detail drawer', async () => {
    mount(<ReviewsPage />, '/admin/reviews?col=ID&q=user');
    expect(await screen.findByRole('heading', { level: 1, name: '수강후기' })).toBeInTheDocument();
    expect(await screen.findByText('아카이브 과정')).toBeInTheDocument();
    for (const h of ['번호', '과정명', '별점', '아이디', '제목', '등록 IP', '등록일', '조회수']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('★★★★☆')).toBeInTheDocument();
    expect(calls.some((c) => c.includes('/admin/reviews?') && c.includes('col=ID') && c.includes('q=user'))).toBe(true);
    fireEvent.click(screen.getByText('아카이브 과정'));
    expect(await screen.findByText('강의가 알찼습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭 제' })).toBeEnabled();
  });

  it('아카이빙: list + reply form in the drawer posts PATCH /archiving/:idx/reply', async () => {
    mount(<ArchivingPage />);
    expect(await screen.findByText('자료 요청')).toBeInTheDocument();
    for (const h of ['번호', 'ID', '제목', '등록일', '처리일', '처리상태']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    fireEvent.click(screen.getByText('자료 요청'));
    expect(await screen.findByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('원본.pdf')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/작성자/), { target: { value: '관리자' } });
    const editor = screen.getByRole('textbox', { name: '답변 내용' });
    editor.innerHTML = '<p>답변 내용입니다. 15자 이상 작성합니다.</p>';
    fireEvent.input(editor);
    fireEvent.click(screen.getByRole('button', { name: '답변 하기' }));
    expect(await screen.findByText('등록하시겠습니까?')).toBeInTheDocument();
    expect(calls).not.toContain('PATCH /admin/archiving/3/reply');
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(calls).toContain('PATCH /admin/archiving/3/reply'));
  });

  it('학습자료실: pinned 공지 row first, upload callout when the folder is missing', async () => {
    mount(<EdudataPage />);
    expect(await screen.findByText('공지 자료')).toBeInTheDocument();
    expect(screen.getByText('일반 자료')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('공지');
    expect(rows[1]).toHaveTextContent('공지 자료');
    expect(rows[2]).toHaveTextContent('교안.pdf');
    for (const h of ['번호', '분류', '제목', '첨부', '등록일', '조회', '사용 유무']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('/web/hrde/html/upload/StudyPDS');
    expect(screen.getByRole('button', { name: '자료 등록' })).toBeEnabled();
  });

  it('이벤트관리: legacy columns with "10Days" and the status form', async () => {
    mount(<LectureEventsPage />);
    expect(await screen.findByText('10Days')).toBeInTheDocument();
    for (const h of ['번호', '아이디', '이름', '전화번호', '스테이지', '카운트', '상태']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    fireEvent.click(screen.getByText('홍길동'));
    expect(await screen.findByRole('button', { name: '상태 변경' })).toBeInTheDocument();
  });

  it('팝업 관리: list columns incl. 미리보기/삭제 buttons and the 등록 drawer validation', async () => {
    mount(<PopupsPage />);
    expect(await screen.findByText('추석 이벤트')).toBeInTheDocument();
    for (const h of ['번호', '제목', '이미지 사이즈', '팝업 위치', '마감일', '사용여부', '등록일', '미리보기', '삭제']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('400(W) X 300(H)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '팝업 등록' }));
    fireEvent.click(await screen.findByRole('button', { name: '등록' }));
    expect(await screen.findByText('마감일을 입력하세요.')).toBeInTheDocument();
    expect(calls.filter((c) => c.startsWith('POST'))).toHaveLength(0);
  });

  it('백업 목록: 10 columns and the 08:10 note', async () => {
    mount(<BackupsPage />);
    expect(await screen.findByText('db.sql.gz')).toBeInTheDocument();
    for (const h of ['번호', '백업일자', '백업수단', '백업주기', '보관만료일', '백업_WebSource', '백업_WebLog', '백업_DB', '백업_VOD', '등록일']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText(/매일 오전 08:10/)).toBeInTheDocument();
  });

  it('접속 통계: 일/총카운터/0..23 columns and the 합계 row', async () => {
    mount(<VisitStatsPage />, '/x?year=2026&month=10');
    expect(await screen.findByText('합계')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '총카운터' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '23' })).toBeInTheDocument();
    expect(calls.some((c) => c.includes('/admin/visit-stats?') && c.includes('year=2026') && c.includes('month=10'))).toBe(true);
  });

  it('정보변경: loads the staff row, shows bank fields for 영업, submits PUT /my-info', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mount(<MyInfoPage />);
    expect(await screen.findByText('영업부 > 영업1팀')).toBeInTheDocument();
    expect(screen.getByLabelText('은행명')).toHaveValue('국민');
    expect(screen.getByLabelText('Mobile 1')).toHaveValue('010');
    fireEvent.change(screen.getByLabelText(/소 속/), { target: { value: '영업2팀' } });
    fireEvent.click(screen.getByRole('button', { name: '수정 하기' }));
    await waitFor(() => expect(calls).toContain('PUT /admin/my-info'));
  });
});
