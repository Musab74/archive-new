import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ToastProvider } from '../app/providers/ToastProvider';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import StudyNudgePage, { highlight, nudgeSearchError } from '../features/admin/pages/nudge/StudyNudgePage';
import SmsReservationsPage from '../features/admin/pages/nudge/SmsReservationsPage';
import AlarmLogPage from '../features/admin/pages/nudge/AlarmLogPage';
import { LearnerMailLogPage, ManagerMailLogPage } from '../features/admin/pages/nudge/MailLogPages';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const writer = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['C'], subGrants: ['C1', 'C2', 'C3', 'C4', 'C5'], canWrite: true } as AdminSessionState['admin'];
const sales = { ...writer!, id: 'sales01', dept: 'B', canWrite: false } as AdminSessionState['admin'];
const sessionOf = (admin: AdminSessionState['admin'], canWrite: boolean): AdminSessionState => ({ phase: 'authed', admin, isAuthed: true, canWrite, secondsLeft: 900, login: async () => admin!, logout: async () => undefined, extend: async () => true });

const meta = { salesManagers: [{ id: 'sales01', name: '영업', team: '영업부' }], salesTeams: ['영업부'], courses: [], modes: [{ mode: 'start', label: '학습시작', templateIdx: 3, templateCode: 'UA_0001', hasTemplate: true }], years: [2026], bulkMax: 200, sendConfigured: false };
const target = (seq: number) => ({ seq, serviceType: 'A', serviceTypeLabel: '패키지', id: `u${seq}`, name: `학습자${seq}`, depart: null, eduManager: false, lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', lectureStart: '2026-10-04', lectureEnd: '2027-01-02', tutorLimit: '2027-01-06', progress: 0, passOk: 'N', passLabel: '미수료', studyEnd: 'N', certCount: 0, certDate: null, companyCode: '1234567890', companyIdx: 7, companyName: '테스트기업', salesName: null, salesTeam: null, tutorName: null, openChapter: 1, pre: seq === 1 ? '진행중 2/5' : 'Y', post: 'N', preSubmitted: seq !== 1 });
const targets = Array.from({ length: 12 }, (_, i) => target(12 - i));
const company = { idx: 7, companyScale: 'C', companyScaleLabel: '우선지원대상', companyName: '테스트기업', companyCode: '1234567890', hrd: 'H1', companyId: 'testco', ceo: '대표', tel: '02-1', tel2: '02-2', csEnabled: true, uptae: '서비스', upjong: '교육', fax: '', fax2: '', zipcode: '04000', address01: '서울', address02: '1층', bankName: '국민은행', bankNumber: '123', email: 'co@example.com', homePage: '', eduManager: '담당', eduManagerPhone: '010', eduManagerEmail: 'e@x', salesManager: 'sales01', salesName: '영업', remark: '', cyberUrl: '', cyberEnabled: false, sendSms: 'Y', sendSmsLabel: '수신허용', salesDeptName: '영업본부 > 영업1팀' };
const companyInfo = { company, studies: [{ no: 1, lectureCode: 'ARC2026', contentsName: 'HRD 아카이브 2026', lectureStart: '2026-10-04', lectureEnd: '2027-01-02', studyCount: 3, passCount: 2, passRatio: 67, price: 300000, rPrice: 270000 }], members: [{ no: 1, id: 'u1', name: '학습자1', birthDay: '1990-****-02', genderLabel: '여성', email: '*******@example.com', mobile: '010-****-3333', depart: '', position: '', lastLogin: null, regDate: '2026-01-01', useYNLabel: '사용' }] };
const memberInfo = { profile: { id: 'u1', name: '학습자1', useYN: 'Y', unused: false, gender: 'F', genderLabel: '여성', email: '*******@example.com', tel: null, mobile: '010-****-3333', birthDay: null, hasEmail: true, hasTel: false, hasMobile: true, hasBirthDay: false, nameEng: '', zipcode: '', address01: '', address02: '', depart: '', position: '', etc01: '', etc02: '', mailling: 'Y', acs: 'Y', regDate: '2026-01-01', eduManager: 'N', protectId: 'Y', marketing: 'Y', marketingLabel: '수신허용', cardName: '', cardNumber: '', companyCode: '1234567890', masked: true }, company, loginHistory: [{ no: 1, regDate: '2026-10-01 09:00:00', ip: '1.2.3.4', device: 'PC', userAgent: 'UA', browser: 'Chrome' }], certHistory: [], inquiries: [] };
const alarm = { items: [{ key: 'KAKAO-1', idx: 1, sendType: 'KAKAO', typeLabel: '카톡', category: '20H 독려', templateCode: 'UA', id: 'u1', name: '학습자1', mobile: '010', message: '첫째 줄\n둘째 줄 전체 문장이 잘리지 않고 그대로 보여야 하는 아주 긴 독려 메시지 본문입니다. 칠십 자를 넘겨도 전부 나와야 합니다.', regDate: '2026-10-12 10:00:00', status: '전송성공', code: '0000', apiCode: '', apiMessage: '', mid: 'M', batchKey: 'B', companyName: '테스트기업' }], page: 1, size: 30, total: 1, from: '2026-10-05', to: '2026-10-12', sendType: 'KAKAO', category: '20H 독려', result: '', counts: { total: 1, ok: 1, fail: 0, unknown: 0, reasons: {} }, resultFilters: [{ value: '', label: '전체', group: '', count: 1 }, { value: 'fail', label: '전송실패 전체', group: '실패', count: 0 }], kakaoTableAvailable: true };
const mail = { items: [{ idx: 5, id: 'u1', name: '학습자1', eduManager: '담당', email: 'u1@example.com', companyCode: '1234567890', companyIdx: 7, companyName: '테스트기업', title: '제목', message: '<p><b>굵은</b> 메일 본문</p><script>alert(1)</script>', messageText: '굵은 메일 본문', regDate: '2026-10-12 11:00:00', reciveDate: null, code: 'N', status: '발송', studySeq: 2, inputId: 'admin01' }, { idx: 6, id: 'u2', name: '학습자2', eduManager: null, email: 'u2@example.com', companyCode: null, companyIdx: null, companyName: '일반회원', title: '제목', message: '<p>일반</p>', messageText: '일반', regDate: '2026-10-12 11:00:00', reciveDate: null, code: 'N', status: '발송', studySeq: 3, inputId: 'admin01' }], page: 1, size: 30, total: 2 };
const reservations = { items: [{ idx: 11, resDate: '2026-10-20 14:00:00', companyName: '테스트기업', name: '학습자1', id: 'u1', mobile: '010-2222-3333', studySeq: 2, message: '예약 본문', inputId: 'admin01', regDate: '2026-10-12 09:00:00' }], page: 1, size: 30, total: 1 };

const calls: { method: string; url: string; body: any }[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (url.includes('/admin/nudge/meta')) return json(meta);
    if (url.includes('/admin/nudge/terms')) return json({ items: [] });
    if (url.includes('/admin/nudge/companies')) return json({ items: url.includes('q=%EC%97%86') ? [] : [{ companyCode: '1234567890', companyName: '테스트기업' }] });
    if (url.includes('/admin/nudge/company-info/')) return json(companyInfo);
    if (url.includes('/reveal')) return json({ field: body.field, label: '휴대폰', value: '010-2222-3333' });
    if (url.includes('/admin/nudge/member-info/')) return json(memberInfo);
    if (url.includes('/admin/nudge/targets')) return json({ items: targets, page: 1, size: 30, total: targets.length });
    if (url.includes('/admin/nudge/send')) return json({ ok: false, code: 'SEND_NOT_CONFIGURED', mode: 'start', sendMode: 'sms', requested: body.seqs.length, logged: body.seqs.length, sent: 0, items: body.seqs.map((seq: number) => ({ seq, id: `u${seq}`, name: null, channel: 'alimtalk', status: 'N', label: '미발송 (발송 설정 없음)', logIdx: 500 + seq, ok: false, code: 'SEND_NOT_CONFIGURED' })) });
    if (url.includes('/admin/nudge/reservations') && method === 'POST') return json({ ok: true, created: 1, skipped: [], resDate: '2026-12-01 00:00:00' }, 201);
    if (url.includes('/admin/nudge/reservations')) return json(reservations);
    if (url.includes('/admin/nudge/alarm-log')) return json(alarm);
    if (url.includes('/admin/nudge/manager-mail-log')) return json(mail);
    if (url.includes('/admin/nudge/mail-log')) return json(mail);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (el: ReactElement, path = '/', session = sessionOf(writer, true)) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};

describe('독려 관리 parity helpers', () => {
  it('nudgeSearchError mirrors StudySmsSearch() alerts', () => {
    expect(nudgeSearchError({ gubun: 'B', companyName: ' ', openChapter: '' })).toBe('사업주명을 입력하세요.');
    expect(nudgeSearchError({ gubun: 'A', companyName: '', openChapter: 'x' })).toBe('실시회차는 숫자만 입력하세요.');
    expect(nudgeSearchError({ gubun: 'A', companyName: '', openChapter: '0' })).toBe('실시회차는 1이상 숫자만 입력하세요.');
    expect(nudgeSearchError({ gubun: 'A', companyName: '', openChapter: '3' })).toBeNull();
  });
  it('highlight wraps every match', () => {
    render(<p data-testid="h">{highlight('테스트기업 테스트', '테스트')}</p>);
    expect(screen.getByTestId('h').querySelectorAll('b')).toHaveLength(2);
  });
});

describe('독려 관리 pages — parity behaviour', () => {
  beforeEach(() => { calls.length = 0; adminTokenStore.set({ accessToken: 'adm', expiresIn: 900 } as never); vi.stubGlobal('fetch', apiMock()); });
  afterEach(() => { vi.unstubAllGlobals(); adminTokenStore.clear(); });

  it('학습참여독려: 사업주 검색 without a name and a bad 실시회차 are rejected before any search', async () => {
    mount(<StudyNudgePage />);
    await screen.findByRole('heading', { level: 1, name: '학습참여독려' });
    fireEvent.click(document.querySelector('input[name="gubun"][value="B"]')!);
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(await screen.findByText('사업주명을 입력하세요.')).toBeInTheDocument();
    fireEvent.click(document.querySelector('input[name="gubun"][value="A"]')!);
    fireEvent.change(document.getElementById('sn-oc')!, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(await screen.findByText('실시회차는 1이상 숫자만 입력하세요.')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/admin/nudge/targets'))).toBe(false);
  });

  it('학습참여독려: company autocomplete numbers rows, highlights the match, shows "검색 결과가 없습니다." and closes', async () => {
    mount(<StudyNudgePage />);
    await screen.findByRole('heading', { level: 1, name: '학습참여독려' });
    fireEvent.click(document.querySelector('input[name="gubun"][value="B"]')!);
    fireEvent.change(document.getElementById('sn-cname')!, { target: { value: '테스트' } });
    const list = await screen.findByRole('listbox', { name: '사업주 검색 결과' }, { timeout: 2000 });
    expect(within(list).getByRole('option')).toHaveTextContent('1. 테스트기업');
    expect(list.querySelector('b')).toHaveTextContent('테스트');
    fireEvent.click(within(list).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('listbox', { name: '사업주 검색 결과' })).not.toBeInTheDocument();
    fireEvent.change(document.getElementById('sn-cname')!, { target: { value: '없는회사' } });
    expect(await screen.findByText('검색 결과가 없습니다.', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('학습참여독려: 사전 label, chunked batch with 진행률, 제외 for unchecked rows, company + member popups', async () => {
    mount(<StudyNudgePage />, '/admin/nudge?s=1');
    expect(await screen.findByText('진행중 2/5')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('radio', { name: /학습시작/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: '전체 선택' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '선택 u1' })); // leave one unchecked → 제외
    fireEvent.click(screen.getByRole('button', { name: '알림톡 발송' }));
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST' && c.url.endsWith('/admin/nudge/send'))).toHaveLength(2));
    const posts = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/admin/nudge/send'));
    expect(posts[0]!.body.seqs).toHaveLength(10); expect(posts[1]!.body.seqs).toHaveLength(1);
    expect(await screen.findByText('제외')).toBeInTheDocument();
    expect((await screen.findAllByText('로그만 기록')).length).toBe(11);
    expect(await screen.findByText(/발송처리가 완료되었습니다\. 로그 11건/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '테스트기업' })[0]!);
    expect(await screen.findByText('영업본부 > 영업1팀')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('300,000')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/admin/nudge/company-info/1234567890'))).toBe(true);
  });

  it('학습참여독려: member popup reveals a masked mobile after 구분 + 사유 (InformationProtectionLog)', async () => {
    mount(<StudyNudgePage />, '/admin/nudge?s=1');
    await screen.findByText('진행중 2/5');
    fireEvent.click(screen.getByRole('button', { name: /^학습자1\s*u1$/ }));
    expect(await screen.findByText('수강생 상세 정보')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '010-****-3333' }));
    fireEvent.click(screen.getByRole('button', { name: '열람' }));
    expect(await screen.findByText('사유를 입력하세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('휴대폰 열람 사유'), { target: { value: '독려 대상 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '열람' }));
    expect(await screen.findByText('010-2222-3333')).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith('/admin/nudge/member-info/u1/reveal'))?.body).toEqual({ field: 'Mobile', gubun: '학습자 관리', reason: '독려 대상 확인' });
  });

  it('학습참여독려: reservation defaults to 00시 and asks 발송하시겠습니까? before POST', async () => {
    mount(<StudyNudgePage />, '/admin/nudge?s=1');
    await screen.findByText('진행중 2/5');
    fireEvent.click(screen.getByRole('checkbox', { name: '선택 u1' }));
    fireEvent.click(screen.getByRole('button', { name: '체크항목 문자 예약 발송' }));
    expect(await screen.findByText('00시')).toBeInTheDocument();
    fireEvent.change(document.getElementById('sn-resdate')!, { target: { value: '2099-12-01' } });
    fireEvent.change(document.getElementById('sn-resmsg')!, { target: { value: '#{이름}님 예약' } });
    fireEvent.click(screen.getByRole('button', { name: '발송 하기' }));
    expect(await screen.findByText('발송하시겠습니까?')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/admin/nudge/reservations'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/admin/nudge/reservations'))?.body).toMatchObject({ seqs: [1], resHour: 0, message: '#{이름}님 예약' }));
  });

  it('알림발송내역: full message text in the cell, 독려구분 shows the effective KAKAO type, export hidden for 영업(B)', async () => {
    const first = mount(<AlarmLogPage />, '/admin/nudge/alarm-log?category=20H+%EB%8F%85%EB%A0%A4&sendType=SMS');
    expect(await screen.findByText(/칠십 자를 넘겨도 전부 나와야 합니다\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /검색항목 엑셀/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: '발송유형' })).toHaveTextContent('알림톡/카톡'));
    first.unmount();
    mount(<AlarmLogPage />, '/', sessionOf(sales, false));
    await screen.findByText(/칠십 자를/);
    expect(screen.queryByRole('button', { name: /검색항목 엑셀/ })).not.toBeInTheDocument();
  });

  it('메일발송내역: sanitized HTML body, company popup link (not for 일반회원), export hidden for 영업(B)', async () => {
    const first = mount(<ManagerMailLogPage />);
    expect((await screen.findAllByText('굵은'))[0]!.tagName).toBe('B');
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByRole('button', { name: '일반회원' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '테스트기업' }));
    expect(await screen.findByText('사업주 상세 정보')).toBeInTheDocument();
    first.unmount();
    const second = mount(<LearnerMailLogPage />);
    await screen.findAllByText('굵은');
    expect(screen.getByRole('button', { name: /검색항목 엑셀/ })).toBeInTheDocument();
    second.unmount();
    mount(<LearnerMailLogPage />, '/', sessionOf(sales, false));
    await screen.findAllByText('굵은');
    expect(screen.queryByRole('button', { name: /검색항목 엑셀/ })).not.toBeInTheDocument();
  });

  it('메일발송내역(교육담당자): a log row whose Company row is missing (companyCode null, logCompanyCode kept) is plain 일반회원 text', async () => {
    const orphan = { ...mail.items[0]!, idx: 9, companyCode: null, logCompanyCode: '9999999999', companyIdx: null, companyName: '일반회원' };
    const half = { ...mail.items[0]!, idx: 10, companyCode: '8888888888', companyIdx: null, companyName: '고아기업' }; // older API shape: code present, no Company row
    const base = apiMock();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => (String(input).includes('/admin/nudge/manager-mail-log') ? json({ items: [orphan, half], page: 1, size: 30, total: 2 }) : base(input, init))));
    mount(<ManagerMailLogPage />);
    expect(await screen.findByText('일반회원')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '일반회원' })).not.toBeInTheDocument();
    expect(screen.getByText('고아기업')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '고아기업' })).not.toBeInTheDocument();
  });

  it('학습참여독려: pressing 검색 again with the same filters clears the checks and reloads the list (PHP reloaded study_sms_search_result.php)', async () => {
    mount(<StudyNudgePage />, '/admin/nudge?s=1');
    await screen.findByText('진행중 2/5');
    const box = screen.getByRole('checkbox', { name: '선택 u1' }) as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    const before = calls.filter((c) => c.url.includes('/admin/nudge/targets')).length;
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect((screen.getByRole('checkbox', { name: '선택 u1' }) as HTMLInputElement).checked).toBe(false));
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/admin/nudge/targets')).length).toBeGreaterThan(before));
  });

  it('member popup matches member_info_pop.php: no 생년월일 row; 소속 정보 without 독려문자 수신 / 영업팀 카테고리 (company popup keeps them)', async () => {
    mount(<StudyNudgePage />, '/admin/nudge?s=1');
    await screen.findByText('진행중 2/5');
    fireEvent.click(screen.getByRole('button', { name: /^학습자1\s*u1$/ }));
    expect(await screen.findByText('수강생 상세 정보')).toBeInTheDocument();
    await screen.findByText('소속 정보');
    expect(screen.getByText('교육담당자명')).toBeInTheDocument();
    expect(screen.getByText('영업담당자명')).toBeInTheDocument();
    expect(screen.queryByText('생년월일')).not.toBeInTheDocument();
    expect(screen.queryByText('독려문자 수신')).not.toBeInTheDocument();
    expect(screen.queryByText('영업팀 카테고리')).not.toBeInTheDocument();
    expect(screen.queryByText('영업본부 > 영업1팀')).not.toBeInTheDocument();
  });

  it('예약문자발송: 30 per page; 영업(B) sees neither the excel export nor 체크항목 삭제', async () => {
    const first = mount(<SmsReservationsPage />);
    await screen.findByText('2026-10-20 14:00:00');
    expect(calls.find((c) => c.url.includes('/admin/nudge/reservations'))!.url).toContain('size=30');
    first.unmount();
    mount(<SmsReservationsPage />, '/', sessionOf(sales, false));
    await screen.findByText('2026-10-20 14:00:00');
    expect(screen.queryByRole('button', { name: /검색항목 엑셀/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '체크항목 삭제' })).not.toBeInTheDocument();
  });
});
