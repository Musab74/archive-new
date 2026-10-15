import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from '../app/router';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import { tokenStore } from '../shared/auth/tokenStore';
import { residentNoValid, validateMemberForm } from '../features/admin/pages/members/members-parity-form';
import { closingsHref, stagedEditBody, stagedEditError } from '../features/admin/pages/members/members-parity-staged';
import { memberPostcodePick } from '../features/admin/pages/members/members-parity-postcode';
import { membersListHref, rememberMembersSearch } from '../features/admin/pages/members/members-parity-nav';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], subGrants: ['A1', 'A2', 'A3'], canWrite: true };
const detail = {
  profile: { idx: 2, id: 'user01', name: '홍길동', memberType: 'A', memberTypeLabel: '아카이브', companyCode: '1234567890', companyName: '테스트기업', depart: '교육팀', position: '대리', gender: 'M', genderLabel: '남성', address: { zipcode: '06000', address01: '서울', address02: '1층' }, email: '*******@example.com', mobile: '010-****-3333', tel: null, birthDay: '1991-****-03', masked: true, useYN: 'Y', eduManager: 'Y', testId: 'N', protectId: 'Y', memberRemark: null, sleep: 'N', sleepDate: null, memberOut: 'N', memberOutDate: null, lastLogin: null, lastLoginIp: null, regDate: '2026-10-01 10:00:00', editDate: null, passChange: 'Y', mandatory: 'Y', marketing: 'Y', marketingLabel: '수신허용', abilityYN: null, abilityAfterYN: null, hrd: { nwIno: null, trneeSe: null, irglbrSe: null }, nameEng: 'Hong', etc01: '자격증', etc02: 'SNS', mailling: 'Y', acs: 'N', cardName: null, cardNumber: null, recomId: null, testLectureCode: null },
  company: { idx: 1, scale: 'C', scaleLabel: '우선지원대상', companyName: '테스트기업', companyCode: '1234567890', hrd: 'H1', companyId: 'co1', ceo: '대표', tel: '02-1', tel2: null, csEnabled: false, uptae: null, upjong: null, fax: null, fax2: null, address: { zipcode: null, address01: null, address02: null }, bankName: null, bankNumber: null, email: null, homePage: null, eduManager: '담당', eduManagerPhone: '010', eduManagerEmail: 'e@x', salesManager: 'sales01', salesName: '영업', remark: null, cyberUrl: null, cyberEnabled: true },
  managedCompanies: [{ idx: 5, companyCode: '1234567890', companyName: '관리기업', regDate: '2026-10-02 00:00:00' }],
  enrollments: [{ studySeq: 849, lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', serviceType: 'A', serviceTypeLabel: '패키지', companyCode: '1234567890', companyName: '테스트기업', depart: '교육팀', memberName: '홍길동', packageYN: 'Y', period: { start: '2026-10-01', end: '2026-12-31' }, termeIdx: 1, storedProgress: 0, seconds: 27000, formatted: '7:30:00', percent: 50, over15h: false, passOk: false, passOkRaw: 'N', studyEnd: false, studyEndInPeriod: false, inputDate: null, tutor: null, tutorName: '강사', certCount: 2 }],
  loginHistory: [{ idx: 1, device: 'PC', ip: '1.2.3.4', userAgent: 'Chrome', uaLabel: 'Chrome · Windows', at: '2026-10-12 09:00:00' }], loginTotal: 1,
  identity: { certCount: 1, certSuccess: 1, lastCertAt: '2026-10-12' },
  certHistory: [{ seq: 1, lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', studySeq: 849, certDate: '2026-10-12', certType: 'otp', result: 'T', ip: null, at: '2026-10-12 09:01:00' }],
  counselPhone: [{ idx: 3, category: 'B', categoryLabel: '시스템 문의', name: '상담원', contents: '로그인 문의', regDate: '2026-10-03 00:00:00', status: 'A', statusLabel: '처리중' }],
  inquiries: [{ idx: 4, category: 'A', categoryLabel: '학습 내용 문의', name: '홍길동', title: '질문있어요', regDate: '2026-10-04 00:00:00', status: 'B', statusLabel: '완료' }],
};
const staged = { items: [{ no: 1, idx: 900001, lectureCode: 'NOPE', tutor: '', name: '엑셀', resNo: '990101-1******', mobile: null, email: null, companyCode: '1234567890', depart: null, lectureStart: '2026-11-01', lectureEnd: '2026-11-30', reStudy: '2026-12-07', serviceType: 'A', serviceTypeLabel: '패키지', userId: '', userIdLabel: '자동 설정', pwd: '1111', nwIno: null, trneeSe: '007', trneeSeLabel: '자사근로자', irglbrSe: '000', irglbrSeLabel: '비정규직해당없음', openChapter: '1', salesId: 'sales01', eduManager: 'N', status: 'error', errors: ['과정코드 [NOPE]를 찾을 수 없습니다.'], errorCells: ['LectureCode'], studyOverlap: false, regDate: null }], total: 1, errorCount: 1 };

const calls: { url: string; method: string; body: unknown }[] = [];
let extraRoutes: (url: string, method: string) => Response | undefined = () => undefined;
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    let body: unknown;
    if (init?.body instanceof FormData) body = init.body; else if (init?.body) { try { body = JSON.parse(String(init.body)); } catch { body = init.body; } }
    calls.push({ url, method, body });
    const extra = extraRoutes(url, method);
    if (extra) return extra;
    if (url.endsWith('/auth/admin/refresh')) return json({ accessToken: 'adm', expiresIn: 900, admin });
    if (url.endsWith('/auth/admin/me')) return json(admin);
    if (url.endsWith('/auth/refresh')) return json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401);
    if (url.endsWith('/admin/members/user01/reveal')) return json({ field: 'Mobile', label: '휴대폰', value: '010-2222-3333' });
    if (url.endsWith('/admin/members/user01')) return json(detail);
    if (url.endsWith('/admin/enrollments/staged')) return json(staged);
    if (url.endsWith('/admin/enrollments/options')) return json({ courses: [{ lectureCode: 'ARC2026', name: 'HRD 아카이브 2026', ctype: null }], tutors: [{ id: 'tutor01', name: '강사', team: '1팀' }], sales: [{ id: 'sales01', name: '영업', team: '영업1팀', mobile: '010-9999-0000', label: '영업 | sales01 | 영업1팀 | 010-9999-0000' }], serviceTypes: [{ value: 'A', label: '패키지' }, { value: 'W', label: '비환급' }], progress: [0, 50, 80, 100] });
    if (url.includes('/admin/enrollments/members?')) return json({ items: [{ id: 'user01', name: '홍길동', companyCode: '1234567890', companyName: '테스트기업', depart: null, label: '홍길동 | user01 | 테스트기업' }], total: 1, truncated: false });
    if (url.includes('/admin/studies')) return json({ items: [], page: 1, size: 10, total: 0 });
    if (url.endsWith('/public/design')) return json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  return render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><RouterProvider router={memory} /></MotionConfig></QueryClientProvider>);
};

describe('수강생 관리 parity', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); adminTokenStore.clear(); calls.length = 0; extraRoutes = () => undefined; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('member_read.php sections in order, masked contacts revealed only after a logged reason', async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/members/user01');
    // header: identity, badges, facts, everyday action; tabs carry the old page's sections
    expect(await screen.findByRole('heading', { level: 1, name: /홍길동/ })).toBeInTheDocument();
    for (const t of ['기본 정보', '소속 정보', '수강 내역', '로그인 · 본인인증', '상담 · 문의', '관리 업체']) expect(screen.getByRole('tab', { name: new RegExp(t) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '정보 수정' })).toBeEnabled();
    // rare / destructive actions sit in the 더보기 menu
    fireEvent.click(screen.getByRole('button', { name: /더보기/ }));
    for (const b of ['비밀번호 초기화 (1111)', '회원 탈퇴처리', '회원 미사용처리', '회원 데이터 삭제']) expect(screen.getByRole('menuitem', { name: b })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: '회원으로 로그인' })).toBeEnabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    // each tab shows its section
    fireEvent.click(screen.getByRole('tab', { name: /소속 정보/ }));
    expect(await screen.findByText('우선지원대상')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /로그인 · 본인인증/ }));
    expect(await screen.findByText('Chrome · Windows')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /상담 · 문의/ }));
    expect(await screen.findByText('질문있어요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /관리 업체/ }));
    expect(await screen.findByText('관리기업')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /수강 내역/ }));
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByText('미마감')).toBeInTheDocument();
    // 진도 로그: each 수강 내역 row links to the enrollment page's 학습 내역 block; 학습내역 엑셀 is a real export (no PHP link)
    const logLink = screen.getByRole('link', { name: '보기' });
    expect(logLink.getAttribute('href')).toMatch(/^\/admin\/studies\/\d+\?tab=learning$/);
    expect(screen.getByRole('button', { name: '학습내역 엑셀 출력' })).toBeEnabled();
    expect(document.body.innerHTML).not.toContain('hrd_manager/');

    fireEvent.click(screen.getByRole('tab', { name: /기본 정보/ }));
    fireEvent.click(screen.getByRole('button', { name: '010-****-3333' }));
    expect(await screen.findByText('개인정보 열람사유 작성')).toBeInTheDocument();
    fireEvent.change(document.getElementById('pr-reason')!, { target: { value: '상담 <확인>' } });
    fireEvent.click(screen.getByRole('button', { name: '등록 하기' }));
    expect(await screen.findByText('사유에는 한글, 영문, 숫자, 공백만 입력 가능합니다.')).toBeInTheDocument();
    fireEvent.change(document.getElementById('pr-reason')!, { target: { value: '상담 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '등록 하기' }));
    expect(await screen.findByText('010-2222-3333')).toBeInTheDocument();
    const rv = calls.find((c) => c.url.endsWith('/reveal'))!;
    expect(rv.method).toBe('POST');
    expect(rv.body).toEqual({ field: 'Mobile', gubun: '학습자 관리', reason: '상담 확인', url: '/admin/members/user01' });
  }, 20_000);

  it('lecture_reg.php shows the uploaded-row list with the row errors and blocks 수강 등록하기 while errors exist', async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/enrollments/new');
    expect(await screen.findByText('수강등록 엑셀파일로 등록')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('- 과정코드 [NOPE]를 찾을 수 없습니다.')).toBeInTheDocument());
    expect(screen.getByText('990101-1******')).toBeInTheDocument();
    expect(screen.getByText(/오류 건수가 \[ 1 \]건이 있습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '수강 등록하기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /선택항목 삭제/ })).toBeDisabled();
  });

  it('주민번호 checksum and member_write.php validation', () => {
    expect(residentNoValid('820304', '1172917')).toBe(false);
    expect(residentNoValid('900101', '1234568')).toBe(true);
    expect(residentNoValid('9001', '1234568')).toBe(false);
    const base = { ID: 'abcd1', Pwd: '1111', Name: '홍', ResNo: '900101-1234568', checkResNo: true, Gender: '', Email: '', Tel: ['', '', ''] as [string, string, string], Mobile: ['010', '1234', '5678'] as [string, string, string], Zipcode: '', Address01: '', Address02: '', NameEng: '', CompanyCode: '', CompanyName: '', Depart: '', Position: '', Etc01: [], Etc02: [], Mailling: true, ACS: true, EduManager: false, UseYN: 'Y' as const, Marketing: 'N', recomId: null };
    expect(validateMemberForm(base, 'new')).toEqual({});
    expect(Object.keys(validateMemberForm({ ...base, ID: 'a!', ResNo: '900101-1234567', Email: 'a@b', Mobile: ['010', '', '1'] }, 'new')).sort()).toEqual(['Email', 'ID', 'Mobile', 'ResNo']);
    // member_write.php SubmitOk() asks for the 주민번호 in edit mode too
    expect(validateMemberForm({ ...base, ResNo: '' }, 'edit')).toEqual({ ResNo: '주민번호를 입력하세요.' });
    expect(validateMemberForm({ ...base, ID: '', Pwd: '' }, 'edit')).toEqual({});
  });

  it('회원으로 로그인 (member_login.php): confirm, POST login-as, then the learner site opens in the tab opened by the click', async () => {
    extraRoutes = (url, method) => (method === 'POST' && url.endsWith('/admin/members/user01/login-as') ? json({ ok: true, id: 'user01', name: '홍길동', url: '/' }) : undefined);
    vi.stubGlobal('fetch', apiMock());
    const tab = { location: { href: 'about:blank' }, close: vi.fn() };
    const open = vi.fn(() => tab);
    vi.stubGlobal('open', open);
    mount('/admin/members/user01');
    expect(await screen.findByRole('heading', { level: 1, name: /홍길동/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /더보기/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '회원으로 로그인' }));
    expect(await screen.findByText('[user01]로 로그인 하시겠습니까?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(tab.location.href).toBe('/'));
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/admin/members/user01/login-as'))).toBe(true);
    // 대리수강 방지 row (member_info_pop.php)
    expect(screen.getByText('대리수강 방지')).toBeInTheDocument();
    }, 20_000);

  it('1:1 문의 제목 opens that inquiry (qna_read.php?idx=) in a drawer; the answer link goes to 1:1 상담문의 with ?open=', async () => {
    extraRoutes = (url) => (url.endsWith('/admin/members/user01/inquiries/4') ? json({ idx: 4, id: 'user01', name: '홍길동', category: 'A', categoryLabel: '학습 내용 문의', title: '질문있어요', contents: '<p>진도가 <b>안</b> 올라요</p><script>alert(1)</script>', courseName: 'HRD 아카이브 2026', contentsTitle: '1차시 소개', lectureCode: 'ARC2026', mobile: '010-****-3333', email: '*******@example.com', regDate: '2026-10-04 00:00:00', answeredAt: null, studentFile: '캡처.png', status: 'A', statusLabel: '대기', answerName: '관리자', answer: '', answerFiles: [] }) : undefined);
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/members/user01?tab=counsel');
    fireEvent.click(await screen.findByRole('button', { name: '질문있어요' }));
    expect(await screen.findByText('1차시 소개')).toBeInTheDocument();
    for (const t of ['HRD 아카이브 2026', '010-****-3333', '*******@example.com', '캡처.png', '대기', '관리자']) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.getByText('안').tagName).toBe('B');
    expect(document.body.innerHTML).not.toContain('alert(1)');
    const answer = screen.getByRole('link', { name: '1:1 상담문의에서 답변하기' });
    expect(answer.getAttribute('href')).toBe('/admin/counsel?col=ID&q=user01&open=4');
    expect(calls.some((c) => c.url.endsWith('/admin/members/user01/inquiries/4'))).toBe(true);
  });

  it('A2-only staff open 진도율 / 진도 로그 in a drawer through /admin/members/:id/studies/:seq (progress_info_pop.php)', async () => {
    const a2 = { ...admin, dept: 'D', topGrants: [], subGrants: ['A2'] };
    const learning = { isPackage: false, items: [{ no: 1, serviceTypeLabel: '패키지', courseName: 'HRD 아카이브 2026', contentsTitle: '오리엔테이션', lectureCode: 'ARC2026', chapterNo: 1, chapterSeq: 11, rowStudySeq: 849, progress: 100, seconds: 1800, studyTimeLabel: '30분', lectureTimeMin: 30, startDate: '2026-10-02 09:00:00', endDate: '2026-10-02 09:30:00' }], sum: { chapters: 1, seconds: 1800, label: '30분', criterionSeconds: 54000, met: false, judge: '미달' } };
    extraRoutes = (url) => {
      if (url.endsWith('/auth/admin/refresh')) return json({ accessToken: 'adm', expiresIn: 900, admin: a2 });
      if (url.endsWith('/auth/admin/me')) return json(a2);
      if (url.endsWith('/admin/members/user01/studies/849')) return json({ studySeq: 849, id: 'user01', name: '홍길동', courseName: 'HRD 아카이브 2026', lectureCode: 'ARC2026', companyCode: '1234567890', companyName: '테스트기업', period: { start: '2026-10-01', end: '2026-12-31' }, seconds: 1800, formatted: '0:30:00', percent: 3, progressHeader: { seconds: 1800, label: '0시간 30분', percent: 3 }, passOk: false, studyEnd: false, tutor: 't', tutorName: '강사', serviceTypeLabel: '패키지', openChapter: 1, learning });
      if (url.includes('/admin/members/user01/studies/849/chapter-log?')) return json({ mode: 'ticks', chapterNo: 1, sameCount: 1, items: [{ no: 1, idx: 501, progress: 50, studyTime: 900, studyTimeLabel: '15분', delta: 60, positionSec: 900, ip: '1.2.3.4', at: '2026-10-02 09:15:00', lastStudy: 'p2', sameMinute: true }] });
      return undefined;
    };
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/members/user01?tab=studies');
    fireEvent.click(await screen.findByRole('button', { name: '보기' }));
    expect(await screen.findByText('0시간 30분 (3%)')).toBeInTheDocument();
    expect(screen.getByText('오리엔테이션', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '보기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('2026-10-02 09:00:00'));
    expect(await screen.findByText(/빨간색 1행은/)).toBeInTheDocument();
    const tick = calls.find((c) => c.url.includes('/studies/849/chapter-log?'))!;
    expect(tick.url).toContain('lectureCode=ARC2026');
    expect(tick.url).toContain('chapterSeq=11');
    expect(calls.some((c) => c.url.includes('/admin/studies/849'))).toBe(false);
  });

  it('목록 returns to the same search and member.php pages by 30', async () => {
    rememberMembersSearch('?col=Name&sw=%ED%99%8D&page=3');
    expect(membersListHref(null)).toBe('/admin/members?col=Name&sw=%ED%99%8D&page=3');
    expect(membersListHref({ from: '?sw=x' })).toBe('/admin/members?sw=x');
    extraRoutes = (url) => (url.includes('/admin/members?') ? json({ items: [], page: 1, size: 30, total: 0 }) : undefined);
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/members');
    await waitFor(() => expect(calls.some((c) => c.url.includes('/admin/members?') && c.url.includes('size=30'))).toBe(true));
  });

  it('lecture_reg.php SubmitOk: 수강기간/수강생/첨삭강사/영업담당자 required, 실시회차 digits (0 allowed), empty search refused, sales label with mobile', async () => {
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/enrollments/new');
    expect(await screen.findByText('수강등록 엑셀파일로 등록')).toBeInTheDocument();
    fireEvent.change(document.getElementById('er-oc')!, { target: { value: '1a' } });
    fireEvent.click(screen.getByRole('button', { name: '등록 하기' }));
    for (const t of ['수강기간을 선택하세요.', '수강생을 검색하세요.', '첨삭강사를 검색하세요.', '영업담당자를 검색하세요.', '실시회차는 숫자만 입력하세요.']) expect(await screen.findByText(t)).toBeInTheDocument();
    // empty learner search is refused like LectureRegIDSearch()
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(await screen.findByText('수강생 아이디 또는 이름을 입력하세요.')).toBeInTheDocument();
    // sales options carry the mobile number
    expect(await screen.findByText('-- 1건이 검색되었습니다. 영업담당자를 선택하세요. --')).toBeInTheDocument();
    fireEvent.click(document.getElementById('er-sales')!);
    expect(await screen.findByRole('option', { name: '영업 | sales01 | 영업1팀 | 010-9999-0000' })).toBeInTheDocument();
    fireEvent.keyDown(document.getElementById('er-sales')!, { key: 'Escape' });
    // 실시회차 0 is accepted (IsNumber)
    fireEvent.change(document.getElementById('er-oc')!, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '등록 하기' }));
    await waitFor(() => expect(screen.queryByText('실시회차는 숫자만 입력하세요.')).not.toBeInTheDocument());
  }, 20_000);

  it('엑셀 업로드: file required, confirm, multipart POST; template downloads', async () => {
    extraRoutes = (url, method) => (method === 'POST' && url.endsWith('/admin/enrollments/staged/upload') ? json({ ok: true, inserted: 2, skipped: 0, idxs: [1, 2] }, 201) : undefined);
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/enrollments/new');
    expect(await screen.findByText('등록 샘플')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '양식 다운로드' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '샘플 다운로드' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '업로드 하기' }));
    expect(await screen.findByText('엑셀 파일을 선택하세요.')).toBeInTheDocument();
    const file = new File(['x'], '수강등록.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(document.getElementById('st-file')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '업로드 하기' }));
    expect(await screen.findByText('업로드 하시겠습니까?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/admin/enrollments/staged/upload'))).toBe(true));
    const up = calls.find((c) => c.url.endsWith('/staged/upload'))!;
    expect(up.body).toBeInstanceOf(FormData);
    expect((up.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('수강 등록하기 runs lecture_reg_complete.php row by row and shows 처리중 → 등록 / 오류 per row; overlap rows link to 수강마감', async () => {
    const wait = { ...staged.items[0]!, idx: 900002, no: 1, status: 'wait', errors: [], errorCells: [], lectureCode: 'ARC2026' };
    const second = { ...wait, idx: 900003, no: 2 };
    extraRoutes = (url, method) => {
      if (url.endsWith('/admin/enrollments/staged')) return json({ items: [wait, second], total: 2, errorCount: 0 });
      if (method === 'POST' && url.endsWith('/staged/900002/commit')) return json({ idx: 900002, status: 'done', label: '등록', reasons: [], userId: 'co1990101', studySeq: 77, memberCreated: true });
      if (method === 'POST' && url.endsWith('/staged/900003/commit')) return json({ idx: 900003, status: 'error', label: '오류', reasons: ['[중복]'], userId: 'user01', studySeq: null, memberCreated: false });
      return undefined;
    };
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/enrollments/new');
    const go = await screen.findByRole('button', { name: '수강 등록하기' });
    await waitFor(() => expect(go).toBeEnabled());
    fireEvent.click(go);
    expect(await screen.findByText(/등록한 엑셀파일로 수강등록을 시작하시겠습니까/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(await screen.findByText(/수강등록 처리가 완료되었습니다/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('[중복]')).toBeInTheDocument();
    expect(screen.getByText('co1990101 · Seq 77')).toBeInTheDocument();
    const order = calls.filter((c) => c.url.includes('/commit')).map((c) => c.url.replace(/.*staged\//, ''));
    expect(order).toEqual(['900002/commit', '900003/commit']);
    expect(screen.getByText('등록 1건 · 오류 1건')).toBeInTheDocument();
  }, 20_000);

  it('an overlapping staged row links to 수강마감 with the open Study filters, in a new tab with the PHP tooltip', async () => {
    const ov = { ...staged.items[0]!, studyOverlap: true, errors: ['진행중인 기존 수강이 이 과정/기간과 겹칩니다. 재등록하려면 먼저 기존 수강을 수강마감 처리하세요.'], overlapStudy: { seq: 77, lectureStart: '2026-10-01', lectureEnd: '2026-12-31', companyCode: '1234567890', companyName: '테스트기업', title: '기존 수강을 마감하면 기존 학습/이수 기록은 유지되고, 새 환급 수강을 별도 Study_Seq로 등록할 수 있습니다. 마감 후 이 목록을 새로고침하세요.' } };
    extraRoutes = (url) => (url.endsWith('/admin/enrollments/staged') ? json({ items: [ov], total: 1, errorCount: 2 }) : undefined);
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/enrollments/new');
    const link = await screen.findByRole('link', { name: '기존 수강 수강마감 열기' });
    expect(link.getAttribute('href')).toBe('/admin/learning/closings?lectureStart=2026-10-01&lectureEnd=2026-12-31&companyCode=1234567890&companyName=%ED%85%8C%EC%8A%A4%ED%8A%B8%EA%B8%B0%EC%97%85&go=1');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('title')).toContain('기존 수강을 마감하면');
  });

  it('영업 담당자 검색 (salesmanager_search.php): typed term → GET /admin/enrollments/sales?q=, count text, empty result text', async () => {
    let n = 0;
    extraRoutes = (url) => {
      if (!url.includes('/admin/enrollments/sales?')) return undefined;
      n++;
      return n === 1 ? json({ items: [{ id: 'sales02', name: '김영업', team: '2팀', mobile: '010-1', label: '김영업 | sales02 | 2팀 | 010-1' }, { id: 'sales03', name: '이영업', team: null, mobile: null, label: '이영업 | sales03 |  | ' }], total: 2 }) : json({ items: [], total: 0 });
    };
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/enrollments/new');
    expect(await screen.findByText('-- 1건이 검색되었습니다. 영업담당자를 선택하세요. --')).toBeInTheDocument();
    fireEvent.change(document.getElementById('er-sales-q')!, { target: { value: '영업' } });
    fireEvent.click(screen.getByRole('button', { name: '영업 담당자 검색' }));
    expect(await screen.findByText('-- 2건이 검색되었습니다. 영업담당자를 선택하세요. --')).toBeInTheDocument();
    expect(calls.find((c) => c.url.includes('/admin/enrollments/sales?'))!.url).toContain(`q=${encodeURIComponent('영업')}`);
    fireEvent.change(document.getElementById('er-sales-q')!, { target: { value: 'zzz' } });
    fireEvent.keyDown(document.getElementById('er-sales-q')!, { key: 'Enter' });
    expect(await screen.findByText('[ 검색된 영업담당자가 없습니다. ]')).toBeInTheDocument();
  }, 20_000);

  it('엑셀 목록: the full 주민등록번호 like lecture_reg_list.php, .xls accepted; 수정 never sends 복습종료일 back', async () => {
    extraRoutes = (url, method) => {
      if (url.endsWith('/admin/enrollments/staged')) return json({ ...staged, items: [{ ...staged.items[0]!, resNoFull: '990101-1234567' }] });
      if (method === 'GET' && url.endsWith('/admin/enrollments/staged/900001')) return json({ idx: 900001, LectureCode: 'ARC2026', Tutor: 'tutor01', Name: '엑셀', ResNo: '990101-1234567', Mobile: '010-1-2', Email: '', CompanyCode: '1234567890', Depart: '', LectureStart: '2026-11-01', LectureEnd: '2026-11-30', LectureReStudy: '2026-12-07', ServiceType: 'A', UserID: '', Pwd: '', nwIno: '', trneeSe: '007', IrglbrSe: '000', OpenChapter: '1', SalesID: 'sales01', EduManager: 'N' });
      if (url.endsWith('/admin/enrollments/staged/courses')) return json({ items: [{ lectureCode: 'ARC2026', name: 'HRD', packageYN: 'Y', serviceType: null, label: 'HRD | ARC2026 | 패키지' }] });
      if (method === 'PUT' && url.endsWith('/admin/enrollments/staged/900001')) return json({ ok: true });
      return undefined;
    };
    vi.stubGlobal('fetch', apiMock());
    mount('/admin/enrollments/new');
    expect(await screen.findByText('990101-1234567')).toBeInTheDocument();
    expect(document.getElementById('st-file')!.getAttribute('accept')).toContain('.xls,');
    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    expect(await screen.findByDisplayValue('010-1-2')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: '수정 하기' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '수정 하기' }));
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.url.endsWith('/staged/900001'))).toBe(true));
    const put = calls.find((c) => c.method === 'PUT')!.body as Record<string, string>;
    expect(put.LectureReStudy).toBe('');
    expect(put.LectureEnd).toBe('2026-11-30');
    expect(stagedEditBody({ LectureReStudy: '2026-12-07', LectureEnd: '2026-12-31' } as never)).toMatchObject({ LectureReStudy: '', LectureEnd: '2026-12-31' });
  }, 20_000);

  it('주소 찾기 keeps the clicked address type (member_write.php stores data.address)', () => {
    expect(memberPostcodePick({ zonecode: '06000', address: '서울 강남구 역삼동 1-1', roadAddress: '서울 강남구 테헤란로 1', jibunAddress: '서울 강남구 역삼동 1-1', userSelectedType: 'J', buildingName: '' })).toEqual({ zonecode: '06000', address: '서울 강남구 역삼동 1-1', buildingName: '' });
    expect(memberPostcodePick({ zonecode: '06000', address: '서울 강남구 테헤란로 1', roadAddress: '서울 강남구 테헤란로 1', userSelectedType: 'R', buildingName: '빌딩' }).address).toBe('서울 강남구 테헤란로 1');
  });

  it('staged-row helpers: lecture_reg_edit.php checks and the 수강마감 link', () => {
    const ok = { Tutor: 't', Name: 'n', ResNo: 'r', Mobile: 'm', CompanyCode: 'c', LectureStart: '2026-01-01', LectureEnd: '2026-01-31', SalesID: 's' };
    expect(stagedEditError(ok)).toBeNull();
    expect(stagedEditError({ ...ok, Tutor: '' })).toEqual({ key: 'Tutor', message: '첨삭강사 아이디를 입력하세요.' });
    expect(stagedEditError({ ...ok, SalesID: ' ' })?.message).toBe('영업담당자 아이디를 입력하세요.');
    expect(stagedEditError({ ...ok, UserID: 'abc' })?.message).toBe('아이디는 4자이상 20자 이내로 입력하세요.');
    expect(stagedEditError({ ...ok, UserID: 'abcd_1' })?.message).toBe('아이디는 영문/숫자만 입력 가능합니다.');
    expect(stagedEditError({ ...ok, OpenChapter: '1.5' })?.message).toBe('실시회차는 숫자만 입력하세요.');
    expect(closingsHref({ lectureStart: '2026-01-01', lectureEnd: '2026-01-31', companyCode: '123', companyName: '회사 A' })).toBe('/admin/learning/closings?lectureStart=2026-01-01&lectureEnd=2026-01-31&companyCode=123&companyName=%ED%9A%8C%EC%82%AC+A&go=1');
  });
});
