import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import { buildEnrollTemplateCsv, editRowError, ENROLL_KEYS, idValidityError, mapEnrollFileTable, mapEnrollRows, maskResNo, parseDelimited, type EnrollRow } from '../features/admin/pages/ruby-ops/enrollmentImport';
import IpMonitoringPage, { groupBreaks, IP_PLAN_URL, studyIpUrl } from '../features/admin/pages/ruby-ops/IpMonitoringPage';
import RubyTicketsPage from '../features/admin/pages/ruby-ops/RubyTicketsPage';
import RubyEmbeddingsPage from '../features/admin/pages/ruby-ops/RubyEmbeddingsPage';
import EnrollmentImportPage, { closingUrl, REGISTER_CONFIRM } from '../features/admin/pages/ruby-ops/EnrollmentImportPage';
import { deptAAllowed, rubyAllowed } from '../features/admin/pages/ruby-ops/rubyAccess';
import type { IpQueueRow } from '../shared/api/endpoints/admin-ruby-ops';

describe('enrollmentImport helpers', () => {
  it('maps the Korean header row (legacy A..U labels, loose spelling) and keeps empty cells null', () => {
    const m = mapEnrollRows([['강의코드', '과정명', '성명', '주민번호', '사업자 번호', '수강 시작일', '수강 종료일', '서비스 구분', '엉뚱한열'], ['ARC2026', '2026 아카이브', '홍길동', '900101-1234567', '123-45-67890', '2026-03-01', '2026-05-31', 'A', 'x']]);
    expect(m.headerDetected).toBe(true);
    expect(m.unknownHeaders).toEqual(['엉뚱한열']);
    expect(m.rows[0]).toMatchObject({ LectureCode: 'ARC2026', ContentsName: '2026 아카이브', Name: '홍길동', ResNo: '900101-1234567', CompanyCode: '123-45-67890', LectureStart: '2026-03-01', LectureEnd: '2026-05-31', ServiceType: 'A', Tutor: null, UserID: null });
  });
  it('falls back to the A..U order without a header', () => {
    const cells = Array.from({ length: ENROLL_KEYS.length }, (_, i) => `v${i}`);
    const m = mapEnrollRows([cells]);
    expect(m.headerDetected).toBe(false);
    expect(m.rows[0]).toMatchObject({ LectureCode: 'v0', ContentsName: 'v1', Tutor: 'v2', Name: 'v3', ResNo: 'v4', EduManager: 'v20' });
  });
  it('mapEnrollFileTable: row 1 is always skipped (lecture_reg_excel_upload.php $startLine=2); legacy xlsx headers map by name; empty rows dropped', () => {
    const legacy = ['과정코드', '과정명', '첨삭강사', '이름', '주민등록번호', '휴대폰', '이메일', '사업자번호', '회사명', '부서명', '수강시작일', '수강종료일', '서비스구분', '아이디', '비밀번호', '비용수급사업장', '훈련생구분', '비정규직구분', '실시회차', '영업담당자', '교육담당자 여부'];
    const m = mapEnrollFileTable([legacy, ['LZMJ42', '', '', '학습자', '160101-1234567', '', '', '0000000000', '', '', '43354', '43383', 'A', '', '', '', '', '', '', 'sales01', 'N'], []]);
    expect(m.headerDetected).toBe(true);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0]).toMatchObject({ LectureCode: 'LZMJ42', Name: '학습자', ResNo: '160101-1234567', LectureStart: '43354', SalesID: 'sales01', EduManager: 'N' });
    const positional = mapEnrollFileTable([['a', 'b'], ['ARC2026', '', 't', '홍']]);
    expect(positional.rows).toEqual([expect.objectContaining({ LectureCode: 'ARC2026', Tutor: 't', Name: '홍' })]);
  });
  it('editRowError mirrors LectureEditSubmitOk() alerts; idValidityError = ID_Validity()', () => {
    const base = Object.fromEntries(ENROLL_KEYS.map((k) => [k, null])) as EnrollRow;
    const ok: EnrollRow = { ...base, Tutor: 't', Name: 'n', ResNo: '900101-1234567', Mobile: '010', CompanyCode: '1', LectureStart: '2026-01-01', LectureEnd: '2026-02-01', SalesID: 's' };
    expect(editRowError(ok)).toBeNull();
    expect(editRowError({ ...ok, Tutor: null })).toBe('첨삭강사 아이디를 입력하세요.');
    expect(editRowError({ ...ok, Mobile: null })).toBe('휴대폰을 입력하세요.');
    expect(editRowError({ ...ok, LectureEnd: null })).toBe('수강 기간을 입력하세요.');
    expect(editRowError({ ...ok, SalesID: null })).toBe('영업담당자 아이디를 입력하세요.');
    expect(editRowError({ ...ok, OpenChapter: '1회' })).toBe('실시회차는 숫자만 입력하세요.');
    expect(editRowError({ ...ok, UserID: 'ab' })).toBe('아이디는 4자이상 20자 이내로 입력하세요.');
    expect(idValidityError('홍길동abc')).toBe('아이디는 영문/숫자만 입력 가능합니다.');
    expect(idValidityError('abcd1')).toBeNull();
  });
  it('parses Excel clipboard TSV, builds the template, masks resident numbers', () => {
    expect(parseDelimited('강의코드\t성명\r\nARC2026\t홍길동\r\n')).toEqual([['강의코드', '성명'], ['ARC2026', '홍길동']]);
    const t = buildEnrollTemplateCsv(true);
    expect(t.replace('﻿', '').split('\r\n')[0]!.split(',')).toHaveLength(ENROLL_KEYS.length);
    expect(maskResNo('900101-1234567')).toBe('900101-1******');
    expect(maskResNo('')).toBe('');
  });
  it('IP helpers: IP조회 opens the ported IP모니터링 in 상세 보기; group breaks for same_ip / company; plan link on the legacy host', () => {
    expect(studyIpUrl('user01', '10.1.1.1')).toBe('/admin/learning/ip-monitor?id=user01&ip=10.1.1.1&viewMode=detail');
    expect(studyIpUrl('user01', '')).toBe('/admin/learning/ip-monitor?id=user01&viewMode=detail');
    const r = (ip: string, code: string) => ({ ip, company: { code, name: '', label: code } }) as IpQueueRow;
    const rows = [r('1.1.1.1', 'A'), r('1.1.1.1', 'B'), r('2.2.2.2', 'B')];
    expect([...groupBreaks(rows, 'same_ip')]).toEqual([2]);
    expect([...groupBreaks(rows, 'company')]).toEqual([1]);
    expect(groupBreaks(rows, 'severity').size).toBe(0);
    expect(decodeURI(IP_PLAN_URL)).toMatch(/\/docs\/archive_monitoring\/IP모니터링\/IP모니터링_기획안\.html$/);
    expect(IP_PLAN_URL).not.toContain('/hrd_manager/');
  });
  it('access: Ruby = dept A or the exact F2 sub-grant (no top-letter fallback); IP 모니터링 = dept A', () => {
    expect(rubyAllowed({ dept: 'C', subGrants: ['F1'] })).toBe(false); // top grant F alone is not enough
    expect(rubyAllowed({ dept: 'C', subGrants: ['F2'] })).toBe(true);
    expect(deptAAllowed({ dept: 'C', subGrants: ['B1'] })).toBe(false);
    expect(closingUrl({ seq: 1, lectureStart: '2026-03-01', lectureEnd: '2026-05-31', companyCode: '123', companyName: '테스트' })).toBe('/admin/learning/closings?lectureStart=2026-03-01&lectureEnd=2026-05-31&companyCode=123&companyName=%ED%85%8C%EC%8A%A4%ED%8A%B8&go=1');
  });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const adminOf = (over: Partial<NonNullable<AdminSessionState['admin']>>) => ({ id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A', 'B', 'F'], subGrants: ['A3', 'B1', 'F2'], canWrite: true, ...over }) as AdminSessionState['admin'];
const sessionOf = (admin: AdminSessionState['admin']): AdminSessionState => ({ phase: 'authed', isAuthed: true, canWrite: true, secondsLeft: 900, admin, login: async () => { throw new Error('x'); }, logout: async () => {}, extend: async () => true });
const session = sessionOf(adminOf({}));
const summary = { from: '2026-10-08', to: '2026-10-14', days: 7, counts: { CRIT: 0, HIGH: 2, MED: 1, LOW: 3 }, severityLabels: { CRIT: '긴급', HIGH: '주의', MED: '의심', LOW: '참고' }, companies: [{ code: '1234567890', name: '테스트기업', count: 2 }], issueTypes: [{ code: 'IP_CROSS_COMPANY', label: '② 동일 IP에서 다수 사업장 훈련생이 학습한 경우', severity: 'HIGH', severityLabel: '주의', explain: '사업장이 다른 훈련생에게 같은 공인 IP가 반복될 때.' }] };
const qRow = { idx: 1, detectDate: '2026-10-13', detectedAt: '2026-10-13 01:00:00', severity: 'HIGH', severityLabel: '주의', issueCode: 'IP_CROSS_COMPANY', issueLabel: '② 동일 IP에서 다수 사업장 훈련생이 학습한 경우', ip: '10.1.1.1', company: { code: '1234567890', name: '테스트기업', label: '테스트기업' }, id: 'user01', studySeq: 7, lectureCode: 'ARC2026', sample: '같은 IP 10.1.1.1 에서 3명', clarificationKey: 'FRAUD_POST', status: 'new', statusNote: null, statusBy: null, statusAt: null, source: 'dashboard_scan', metric: { StudyIP: '10.1.1.1' } };
const queue = { from: '2026-10-08', to: '2026-10-14', days: 7, sort: 'severity', limit: 100, items: [qRow, { ...qRow, idx: 2, ip: '10.1.1.9', id: 'user02', sample: '두번째' }] };
const tickets = { items: [{ id: 5, sessionId: 's1', userId: null, userName: null, contactName: '홍길동', contactPhone: '010-0000-0000', userMessage: '환급 문의', similarityScore: 0.1234, modelConfidence: 0.5, status: 'new', assignedTo: null, resolvedNote: null, createdAt: '2026-10-13 10:00:00', updatedAt: '2026-10-13 10:00:00' }], page: 1, size: 20, total: 1, byStatus: [{ status: 'new', count: 1 }] };
const planRow = (o: Record<string, unknown>) => ({ line: 1, action: 'enroll', status: 'pending', userId: 't003900101', typedUserId: '', idConflict: false, rowLabel: '홍길동', name: '홍길동', memberAction: 'create', generatedId: true, lectureCode: 'ARC2026', courseName: '2026 아카이브', tutor: 'tutor01', mobile: '010-1', email: 'a@b.kr', companyCode: '1234567890', companyName: '테스트기업', depart: '개발', lectureStart: '2026-03-01', lectureEnd: '2026-05-31', lectureReStudy: '2026-06-07', serviceType: 'A', openChapter: 1, salesId: 'sales01', pwdDefault: true, nwIno: '', trneeSe: '007', irglbrSe: '000', eduManager: 'N', termAction: 'create', termeIdx: null, overlapStudy: null, errors: [], errorCells: [], resultCodes: [], ...o });
const dryRun = { mode: 'dryRun', summary: { total: 2, enroll: 1, newMembers: 1, updateMembers: 0, newTerms: 1, error: 1, skip: 0, errorCount: 2 }, rows: [
  planRow({}),
  planRow({ line: 2, action: 'error', status: 'error', userId: 'sleep01', typedUserId: 'sleep01', generatedId: false, rowLabel: 'sleep01', name: '휴면', memberAction: 'blocked', tutor: '', errors: ['첨삭강사 아이디가 비어 있습니다.', '휴면 회원입니다. 휴면 해제 후 수강등록할 수 있습니다.'], errorCells: ['Tutor', 'UserID'], overlapStudy: { seq: 700, lectureStart: '2026-03-01', lectureEnd: '2026-05-31', companyCode: '1234567890', companyName: '테스트기업' } }),
], applied: null };

const readBlob = (b: Blob) => new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = () => reject(fr.error); fr.readAsText(b); });
const payloadOf = async (init?: RequestInit) => JSON.parse(await readBlob((init?.body as FormData).get('payload') as Blob));
function apiMock(posted: any[], extra: (url: string, init?: RequestInit) => Response | Promise<Response | null> | null = () => null) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const hit = await extra(url, init);
    if (hit) return hit;
    if (url.includes('/admin/monitoring/ip/summary')) return json(summary);
    if (url.includes('/admin/monitoring/ip/queue')) return json(queue);
    if (url.includes('/admin/ruby/tickets')) return json(tickets);
    if (/\/admin\/enrollments\/import(\?|$)/.test(url)) { // row-by-row registration: one JSON request per row
      const body = JSON.parse(String(init?.body)); posted.push(body);
      const src = dryRun.rows.find((r) => r.line === body.firstLine) ?? dryRun.rows[0]!;
      return json({ mode: 'commit', summary: { ...dryRun.summary, total: 1, enroll: 1, error: 0 }, rows: [{ ...src, line: body.firstLine ?? 1, status: 'registered' }], applied: { enrolled: 1, membersCreated: 1, membersUpdated: 0, termsCreated: 1, skipped: 0, failed: 0, studySeqs: [1001] } });
    }
    if (url.includes('/admin/enrollments/import/batch')) {
      const body = await payloadOf(init); posted.push(body);
      if (body.mode === 'commit') return json({ ...dryRun, mode: 'commit', rows: dryRun.rows.map((r) => (r.action === 'enroll' ? { ...r, status: 'registered' } : r)), applied: { enrolled: 1, membersCreated: 1, membersUpdated: 0, termsCreated: 1, skipped: 1, failed: 0, studySeqs: [1001] } });
      return json({ ...dryRun, summary: { ...dryRun.summary, total: body.rows.length }, rows: dryRun.rows.slice(0, body.rows.length) });
    }
    return json({ error: { code: 'NOT_FOUND', message: url } }, 404);
  });
}
const mount = (ui: React.ReactNode, path = '/', s: AdminSessionState = session) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><AdminSessionContext.Provider value={s}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>);
};

describe('ruby-ops pages', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('IP 모니터링: tiles, help bullets with the live 주의 count, rules table open, legacy columns, IP조회 → ported page, 기획안 link', async () => {
    vi.stubGlobal('fetch', apiMock([]));
    mount(<IpMonitoringPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'IP 모니터링' })).toBeInTheDocument();
    expect(await screen.findByText('같은 IP 10.1.1.1 에서 3명')).toBeInTheDocument();
    for (const h of ['일자', '등급', '유형', '사업장', '수강생', '과정', '내용', 'IP조회']) expect(screen.getAllByRole('columnheader', { name: h }).length).toBeGreaterThan(0);
    expect(screen.getByText('사업장이 다른 훈련생에게 같은 공인 IP가 반복될 때.')).toBeVisible(); // rules table always open
    expect(screen.getByText(/\(2건\)/)).toBeInTheDocument();
    expect(screen.getByText(/엑셀·보고서는 지금 필터와 같은 조건으로 받습니다/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'IP조회' })[0]).toHaveAttribute('href', '/admin/learning/ip-monitor?id=user01&ip=10.1.1.1&viewMode=detail');
    expect(screen.getByRole('link', { name: 'user01' })).toHaveAttribute('href', '/admin/members/user01');
    expect(screen.getByRole('link', { name: '기획안' })).toHaveAttribute('href', IP_PLAN_URL);
    expect(screen.getByRole('button', { name: '보고서 받기' })).toBeInTheDocument();
    expect(screen.queryAllByTestId('ipq-break')).toHaveLength(0); // no separators for 등급순
  });

  it('IP 모니터링: same_ip sort draws a separator before a new IP; 다시 집계 posts the date and shows the PHP flash', async () => {
    const posted: any[] = [];
    vi.stubGlobal('fetch', apiMock([], (url, init) => {
      if (!url.includes('/admin/monitoring/ip/scan')) return null;
      posted.push(JSON.parse(String(init?.body)));
      return json({ ok: true, detectDate: '2026-10-14', insertedTotal: 12, message: '2026-10-14 기준 집계를 마쳤습니다. (약 12건 반영)' });
    }));
    mount(<IpMonitoringPage />, '/?sort=same_ip');
    expect(await screen.findByText('두번째')).toBeInTheDocument();
    expect(screen.getAllByTestId('ipq-break')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '다시 집계' }));
    expect(await screen.findByText('2026-10-14 기준 집계를 마쳤습니다. (약 12건 반영)')).toBeInTheDocument();
    expect(posted[0]).toEqual({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it('IP 모니터링 is dept A only; Ruby pages need the exact F2 sub-grant', async () => {
    vi.stubGlobal('fetch', apiMock([]));
    const { unmount } = mount(<IpMonitoringPage />, '/', sessionOf(adminOf({ dept: 'C', subGrants: ['B1'] })));
    expect(screen.queryByRole('heading', { level: 1, name: 'IP 모니터링' })).toBeNull();
    unmount();
    mount(<RubyTicketsPage />, '/', sessionOf(adminOf({ dept: 'C', topGrants: ['F'], subGrants: ['F1'] })));
    expect(screen.queryByText('환급 문의')).toBeNull();
  });

  it('Ruby 지원티켓 renders the PHP columns and the per-row status control', async () => {
    vi.stubGlobal('fetch', apiMock([]));
    mount(<RubyTicketsPage />, '/', sessionOf(adminOf({ dept: 'C', subGrants: ['F2'] })));
    expect(await screen.findByText('환급 문의')).toBeInTheDocument();
    for (const h of ['ID', '상태', '이름', '연락처', '문의', '유사도', '신뢰도', '생성일', '처리']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('0.1234')).toBeInTheDocument();
  });

  it('Ruby 임베딩 재생성 runs the regeneration and shows "임베딩 재생성 완료: FAQ n건, KB m건" from the UPDATE counts', async () => {
    const status = { faq: { byStatus: { published: 2 }, candidates: 2, embeddingColumns: false, embedded: 0, lastUpdatedAt: null, models: [] }, kb: { byStatus: { published: 3 }, candidates: 3, embedded: 1, lastUpdatedAt: null, models: [] }, vectorTables: { chunks: 0, chunksUpdatedAt: null, embeddings: 0, embeddingsUpdatedAt: null }, recentKb: [], regenerateAvailable: true, openAiConfigured: false };
    vi.stubGlobal('fetch', apiMock([], (url) => (url.endsWith('/admin/ruby/embeddings') ? json(status) : url.includes('/admin/ruby/embeddings/regenerate') ? json({ ok: true, target: 'all', candidates: { faq: 2, kb: 3 }, updated: { faq: 0, kb: 3 }, message: '임베딩 재생성 완료: FAQ 0건, KB 3건' }) : null)));
    mount(<RubyEmbeddingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '재생성 실행' }));
    expect(await screen.findByText(/임베딩 재생성 완료: FAQ 0건, KB 3건/)).toBeInTheDocument();
    expect(screen.queryByText(/ruby_embeddings\.php/)).toBeNull(); // no legacy link any more
    expect(screen.getByText(/RubyFaq 표에 임베딩 컬럼/)).toBeInTheDocument();
  });

  it('엑셀 일괄 수강등록: paste → multipart dryRun; PHP columns, red cells, 상태 (대기 / 오류 + reasons + 수강마감 link), error banner, confirm, commit', async () => {
    const posted: any[] = [];
    vi.stubGlobal('fetch', apiMock(posted));
    mount(<EnrollmentImportPage />);
    expect(screen.getByText(/이몬\(Emon\) 안내/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '양식 다운로드' })).toHaveAttribute('download', '수강등록.xlsx');
    expect(screen.getByRole('link', { name: '샘플 다운로드' })).toHaveAttribute('download', '수강등록(샘플).xlsx');
    fireEvent.change(screen.getByLabelText('붙여넣기'), { target: { value: '과정코드\t이름\t주민등록번호\t사업자번호\t수강시작일\t수강종료일\nARC2026\t홍길동\t900101-1234567\t1234567890\t2026-03-01\t2026-05-31\nARC2026\t휴면\t\t1234567890\t2026-03-01\t2026-05-31' } });
    fireEvent.click(screen.getByRole('button', { name: '검증하기' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].mode).toBe('dryRun');
    expect(posted[0].rows[0]).toMatchObject({ LectureCode: 'ARC2026', Name: '홍길동', ResNo: '900101-1234567', CompanyCode: '1234567890', LectureStart: '2026-03-01', Tutor: null });
    expect(await screen.findByText('자동 설정')).toBeInTheDocument();
    for (const h of ['과정코드', '첨삭강사', '이름', '주민등록번호', '휴대폰', '이메일', '사업자번호', '부서명', '수강시작일', '수강종료일', '복습종료일', '서비스구분', '아이디', '비밀번호', '비용수급사업장', '훈련생구분', '비정규직구분', '실시회차', '영업담당자', '교육담당자 여부', '상태']) expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(screen.getByText('900101-1******')).toBeInTheDocument();
    expect(screen.getByText('대기')).toBeInTheDocument();
    expect(screen.getAllByText('자사근로자 (007)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('미입력').some((el) => el.getAttribute('data-red-cell') === 'Tutor')).toBe(true);
    expect(screen.getByText(/- 휴면 회원입니다\. 휴면 해제 후 수강등록할 수 있습니다\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '기존 수강 수강마감 열기' })).toHaveAttribute('href', expect.stringContaining('/admin/learning/closings?lectureStart=2026-03-01'));
    expect(screen.getByText('오류 건수가 [ 2 ]건이 있습니다. 각 행의 상태 칸에서 상세 사유를 확인하세요.')).toBeInTheDocument();
    const reg = screen.getByRole('button', { name: '수강 등록하기' });
    expect(reg).toBeDisabled();
    fireEvent.click(screen.getByLabelText('오류 행은 제외하고 등록'));
    expect(reg).toBeEnabled();
    fireEvent.click(reg);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/등록한 엑셀파일로 수강등록을 시작하시겠습니까\?/)).toBeInTheDocument();
    expect(REGISTER_CONFIRM).toContain('작업이 완료될 때까지 다른 페이지로 이동 또는 창을 닫지 마세요.');
    fireEvent.click(within(dialog).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(posted).toHaveLength(2));
    // lecture_reg_complete.php per row: only the 'enroll' row is sent, alone, with its sheet line
    expect(posted[1]).toMatchObject({ mode: 'commit', skipInvalid: true, firstLine: 1 });
    expect(posted[1].rows).toHaveLength(1);
    expect(posted[1].rows[0]).toMatchObject({ Name: '홍길동' });
    expect(await screen.findByText('등록')).toBeInTheDocument();
    expect(await screen.findByText(/수강등록 처리가 완료되었습니다\. 수강 1건 등록/)).toBeInTheDocument();
    expect(posted).toHaveLength(2);
  });

  it('엑셀 일괄 수강등록: 업로드 하기 sends the file to the parse endpoint (row 1 skipped); 선택항목 삭제 drops the row and re-validates', async () => {
    const posted: any[] = [];
    const parsed: string[] = [];
    vi.stubGlobal('fetch', apiMock(posted, (url, init) => {
      if (!url.includes('/admin/enrollments/import/parse')) return null;
      parsed.push(((init?.body as FormData).get('file') as File).name);
      return json({ format: 'xlsx', fileName: 'a.xlsx', rows: 3, table: [['과정코드', '과정명', '첨삭강사', '이름'], ['ARC2026', '', 'tutor01', '가'], ['ARC2026', '', 'tutor01', '나']] });
    }));
    mount(<EnrollmentImportPage />);
    fireEvent.change(screen.getByLabelText('파일 등록'), { target: { files: [new File(['x'], 'a.xlsx')] } });
    fireEvent.click(screen.getByRole('button', { name: '업로드 하기' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(parsed).toEqual(['a.xlsx']);
    expect(posted[0].rows.map((r: EnrollRow) => r.Name)).toEqual(['가', '나']); // header row skipped
    await screen.findByText('자동 설정');
    fireEvent.click(screen.getByLabelText('2번 선택'));
    fireEvent.click(screen.getByRole('button', { name: '선택항목 삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/선택한 항목을 삭제하시겠습니까\?/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '확인' }));
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1].rows.map((r: EnrollRow) => r.Name)).toEqual(['가']);
  });
});
