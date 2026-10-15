import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ToastProvider } from '../app/providers/ToastProvider';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { adminTokenStore } from '../shared/auth/adminTokenStore';
import StudyNudgePage from '../features/admin/pages/nudge/StudyNudgePage';
import SmsReservationsPage from '../features/admin/pages/nudge/SmsReservationsPage';
import AlarmLogPage from '../features/admin/pages/nudge/AlarmLogPage';
import { LearnerMailLogPage, ManagerMailLogPage } from '../features/admin/pages/nudge/MailLogPages';
import TemplatesPage from '../features/admin/pages/nudge/TemplatesPage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['C'], subGrants: ['C1', 'C2', 'C3', 'C4', 'C5'], canWrite: true } as AdminSessionState['admin'];
const session: AdminSessionState = { phase: 'authed', admin, isAuthed: true, canWrite: true, secondsLeft: 900, login: async () => admin!, logout: async () => undefined, extend: async () => true };

const meta = { salesManagers: [{ id: 'sales01', name: '영업', team: '영업부' }], salesTeams: ['영업부'], courses: [{ lectureCode: 'ARC2026', contentsName: 'HRD 아카이브 2026' }], modes: [{ mode: 'start', label: '학습시작', templateIdx: 3, templateCode: 'UA_0001', hasTemplate: true }, { mode: 'final', label: '최종독려', templateIdx: null, templateCode: '', hasTemplate: false }, { mode: 'edu', label: '교육담당자', templateIdx: null, templateCode: '', hasTemplate: false }], years: [2018, 2026], bulkMax: 200, sendConfigured: false };
const target = { seq: 2, serviceType: 'A', serviceTypeLabel: '패키지', id: 'user01', name: '학습자일', depart: null, eduManager: false, lectureCode: 'ARC2026', courseName: 'HRD 아카이브 2026', lectureStart: '2026-10-04', lectureEnd: '2027-01-02', tutorLimit: '2027-01-06', progress: 0, passOk: 'N', passLabel: '미수료', studyEnd: 'N', certCount: 0, certDate: null, companyCode: '1234567890', companyName: '테스트기업', salesName: '영업', salesTeam: '영업부', tutorName: null, openChapter: 1, pre: 'N', post: 'N' };
const preview = { seq: 2, id: 'user01', name: '학습자일', companyName: '테스트기업', courseName: 'HRD 아카이브 2026', lectureStart: '2026-10-04', lectureEnd: '2027-01-02', mobile: '010-****-3333', email: '*******@example.com', hasMobile: true, hasEmail: true, companySendSMS: 'Y', mode: 'start', modeLabel: '학습시작', templateFound: true, templateCode: 'UA_0001', message: '[에이치알디이] 학습자일님 학습을 시작하세요.', templateMessage: '[에이치알디이] 학습자일님 학습을 시작하세요.', emailSubject: '[에이치알디이] HRD 아카이브 2026 교육안내 메일입니다.', sendConfigured: false };
const alarm = { items: [{ key: 'SMS-9', idx: 9, sendType: 'SMS', typeLabel: '문자', category: '문자', templateCode: '-', id: 'user01', name: '학습자일', mobile: '01022223333', message: '독려 본문', regDate: '2026-10-12 10:00:00', status: '결과미기록', code: '', apiCode: '', apiMessage: '', mid: '', batchKey: '', companyName: '테스트기업' }], page: 1, size: 20, total: 1, from: '2026-10-05', to: '2026-10-12', sendType: 'ALL', category: '', result: '', counts: { total: 1, ok: 0, fail: 0, unknown: 1, reasons: { U: 0 } }, resultFilters: [{ value: '', label: '전체', group: '', count: 1 }, { value: 'success', label: '전송성공', group: '', count: 0 }, { value: 'fail_U', label: '템플릿 문구 불일치', group: '실패', count: 0 }], kakaoTableAvailable: false };
const templates = { items: [{ idx: 3, messageMode: 'start', modeLabel: '학습시작', templateCode: 'UA_0001', message: '본문 #{이름}', templateMessage: '본문 #{이름}', emTitle: null, regDate: '2026-01-01 00:00:00', aligoStatus: null }], page: 1, size: 20, total: 1, variables: [{ key: '{이름}', label: '학습자이름', example: '예) 홍길동' }], modes: [{ mode: 'start', label: '학습시작' }] };
const reservations = { items: [{ idx: 11, resDate: '2026-10-20 14:00:00', companyName: '테스트기업', name: '학습자일', id: 'user01', mobile: '010-2222-3333', studySeq: 2, message: '예약 본문', inputId: 'admin01', regDate: '2026-10-12 09:00:00' }], page: 1, size: 20, total: 1 };
const mail = { items: [{ idx: 5, id: 'user01', name: '학습자일', eduManager: '담당자', email: 'u1@example.com', companyCode: '1234567890', companyName: '테스트기업', title: '제목', message: '<p>메일 본문</p>', messageText: '메일 본문', regDate: '2026-10-12 11:00:00', reciveDate: null, code: 'N', status: '발송', studySeq: 2, inputId: 'admin01' }], page: 1, size: 20, total: 1 };
const managerMail = { items: [{ idx: 6, companyCode: '1234567890', companyName: '테스트기업', eduManager: '담당자', email: 'mgr@example.com', title: '제목', message: '<p>담당자 메일</p>', messageText: '담당자 메일', regDate: '2026-10-12 12:00:00', reciveDate: '2026-10-12 12:30:00', code: 'Y', status: '수신', inputId: 'admin01' }], page: 1, size: 20, total: 1 };

const calls: { method: string; url: string; body: unknown }[] = [];
function apiMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('/admin/nudge/meta')) return json(meta);
    if (url.includes('/admin/nudge/terms')) return json({ items: [{ period: '2026-10-04~2027-01-02', start: '2026-10-04', end: '2027-01-02' }] });
    if (url.includes('/admin/nudge/term-companies')) return json({ items: [{ companyCode: '1234567890', companyName: '테스트기업' }] });
    if (url.includes('/admin/nudge/targets/2/preview')) return json(preview);
    if (url.includes('/admin/nudge/targets/2/send')) return json({ seq: 2, id: 'user01', name: '학습자일', channel: 'alimtalk', status: 'N', label: '미발송 (발송 설정 없음)', logIdx: 501, ok: false, code: 'SEND_NOT_CONFIGURED', notConfigured: true });
    if (url.includes('/admin/nudge/targets')) return json({ items: [target], page: 1, size: 30, total: 1 });
    if (url.includes('/admin/nudge/send')) return json({ ok: false, code: 'SEND_NOT_CONFIGURED', mode: 'start', sendMode: 'sms', requested: 1, logged: 1, sent: 0, items: [{ seq: 2, id: 'user01', name: '학습자일', channel: 'alimtalk', status: 'N', label: '미발송 (발송 설정 없음)', logIdx: 502, ok: false, code: 'SEND_NOT_CONFIGURED' }] });
    if (url.includes('/admin/nudge/reservations')) return method === 'DELETE' ? json({ ok: true, deleted: 1, requested: 1 }) : json(reservations);
    if (url.includes('/admin/nudge/alarm-log')) return json(alarm);
    if (url.includes('/admin/nudge/manager-mail-log')) return json(managerMail);
    if (url.includes('/admin/nudge/mail-log')) return json(mail);
    if (url.includes('/admin/nudge/templates/3') && method === 'DELETE') return json({ ok: true, deleted: 1 });
    if (url.includes('/admin/nudge/templates') && method === 'POST') return json({ ok: true, idx: 4 }, 201);
    if (url.includes('/admin/nudge/templates')) return json(templates);
    return json({ error: { code: 'NOT_FOUND', message: `${method} ${url}` } }, 404);
  });
}
const mount = (el: ReactElement, path = '/') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{el}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></QueryClientProvider>);
};

describe('독려 관리 pages', () => {
  beforeEach(() => { calls.length = 0; adminTokenStore.set({ accessToken: 'adm', expiresIn: 900 } as never); vi.stubGlobal('fetch', apiMock()); });
  afterEach(() => { vi.unstubAllGlobals(); adminTokenStore.clear(); });

  it('학습참여독려: filters, stage radios with template codes, legacy columns, preview → send writes a log only', async () => {
    mount(<StudyNudgePage />, '/admin/nudge?s=1&year=2026&month=10');
    expect(await screen.findByRole('heading', { level: 1, name: '학습참여독려' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('발송 기능 안내');
    expect(await screen.findByText('HRD 아카이브 2026')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /실시회차/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /영업담당자/ })).toBeInTheDocument();
    expect(screen.getByText(/첨삭완료 : 2027-01-06/)).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /학습시작/ })).toBeInTheDocument();
    expect(screen.getByText('(UA_0001)')).toBeInTheDocument();
    expect(screen.getByText('(템플릿 없음)')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /교육담당자/ })).not.toBeInTheDocument(); // only when 교육담당자 여부 = Y
    // one 내용보기 per stage column, usable without picking a radio (study_sms_search_result.php StudySmsEASend(Seq, mode))
    const view = screen.getByRole('button', { name: '학습시작 내용보기 user01' });
    expect(screen.getByRole('button', { name: '최종독려 내용보기 user01' })).toBeEnabled();
    fireEvent.click(view);
    expect(await screen.findByDisplayValue('[에이치알디이] 학습자일님 학습을 시작하세요.')).toBeInTheDocument();
    expect(screen.getByText('010-****-3333')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '발송 하기' }));
    expect(await screen.findByText('발송하시겠습니까?')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/admin/nudge/targets/2/send'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/admin/nudge/targets/2/send'))).toBe(true));
    const send = calls.find((c) => c.method === 'POST' && c.url.endsWith('/admin/nudge/targets/2/send'))!;
    expect(send.body).toMatchObject({ mode: 'start', sendMode: 'sms', message: '[에이치알디이] 학습자일님 학습을 시작하세요.' });
    expect(await screen.findByText(/미발송 \(발송 설정 없음\)/)).toBeInTheDocument();
  });

  it('학습참여독려: batch send needs a stage and checked rows, then posts /admin/nudge/send and shows the per-row status', async () => {
    mount(<StudyNudgePage />, '/admin/nudge?s=1');
    await screen.findByText('HRD 아카이브 2026');
    fireEvent.click(screen.getByRole('button', { name: '알림톡 발송' }));
    expect(await screen.findByText('발송하려는 독려 내용 단계를 선택하세요.')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('radio', { name: /학습시작/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: '선택 user01' }));
    fireEvent.click(screen.getByRole('button', { name: '알림톡 발송' }));
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/admin/nudge/send'))?.body).toEqual({ seqs: [2], mode: 'start', sendMode: 'sms' }));
    expect(await screen.findByText('로그만 기록')).toBeInTheDocument();
    expect(await screen.findByText(/발송처리가 완료되었습니다/)).toBeInTheDocument();
  });

  it('예약문자발송: legacy columns, drawer with the message, delete checked rows', async () => {
    mount(<SmsReservationsPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '예약문자발송' })).toBeInTheDocument();
    expect(await screen.findByText('2026-10-20 14:00:00')).toBeInTheDocument();
    for (const h of ['예약일자', '사업주', '회원명', '아이디', '연락처']) expect(screen.getByRole('columnheader', { name: new RegExp(h) })).toBeInTheDocument();
    const del = screen.getByRole('button', { name: '체크항목 삭제' });
    expect(del).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '선택 11' }));
    expect(del).toBeEnabled();
    fireEvent.click(del);
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ idxs: [11] }));
  });

  it('알림발송내역: tallies, 11 legacy columns and the status label', async () => {
    mount(<AlarmLogPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '알림발송내역' })).toBeInTheDocument();
    expect(await screen.findByText('독려 본문')).toBeInTheDocument();
    for (const h of ['유형', '독려구분', '템플릿코드', '휴대폰', '발송내용', '발송일', '상태', '사업주']) expect(screen.getByRole('columnheader', { name: new RegExp(h) })).toBeInTheDocument();
    expect(screen.getByText('결과미기록', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^전체 1$/ })).toBeInTheDocument();
    expect(screen.getByText('일괄 카톡 로그 테이블 없음')).toBeInTheDocument();
    const first = calls.find((c) => c.url.includes('/admin/nudge/alarm-log'))!;
    expect(first.url).toContain('sendType=ALL');
  });

  it('메일발송내역 (교육담당자 / 훈련생) render their legacy columns', async () => {
    const first = mount(<ManagerMailLogPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '메일발송내역 (교육담당자)' })).toBeInTheDocument();
    expect(await screen.findByText('mgr@example.com')).toBeInTheDocument();
    expect(screen.getByText('수신')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /교육담당자/ })).toBeInTheDocument();
    first.unmount();
    mount(<LearnerMailLogPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '메일발송내역(훈련생)' })).toBeInTheDocument();
    expect(await screen.findByText('u1@example.com')).toBeInTheDocument();
    expect(screen.getByText('메일 본문')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /교육담당자/ })).toBeInTheDocument();
  });

  it('문자/템플릿 관리: keyword table, list, create drawer validation and POST, delete', async () => {
    mount(<TemplatesPage />);
    expect(await screen.findByRole('heading', { level: 1, name: '문자/템플릿 관리' })).toBeInTheDocument();
    expect(await screen.findByText('UA_0001')).toBeInTheDocument();
    expect(screen.getByText('{이름}')).toBeInTheDocument(); // smsdata.php keyword table: 키워드 | 설명 | 예
    expect(screen.getByRole('columnheader', { name: '설명' })).toBeInTheDocument();
    expect(screen.getByText('본문 #{이름}')).toBeInTheDocument(); // full message in the cell
    expect(screen.getByText('미연동')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(document.getElementById('tp-mode')).not.toBeNull());
    fireEvent.click(screen.getAllByRole('button', { name: '등록' }).at(-1)!);
    expect(await screen.findByText('모드를 입력하세요.')).toBeInTheDocument();
    fireEvent.change(document.getElementById('tp-mode')!, { target: { value: 'final' } });
    fireEvent.change(document.getElementById('tp-code')!, { target: { value: 'UA_9' } });
    fireEvent.change(document.getElementById('tp-msg')!, { target: { value: '최종 독려 #{이름}' } });
    fireEvent.click(screen.getAllByRole('button', { name: '등록' }).at(-1)!);
    expect(await screen.findByText('등록하시겠습니까?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/admin/nudge/templates'))?.body).toEqual({ MessageMode: 'final', TemplateCode: 'UA_9', TemplateMessage: '최종 독려 #{이름}' }));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/admin/nudge/templates/3'))).toBe(true));
  });
});
