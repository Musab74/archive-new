import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AdminSessionContext, type AdminSessionState } from '../shared/auth/useAdminSession';
import { ToastProvider } from '../app/providers/ToastProvider';
import EnrollmentImportPage from '../features/admin/pages/ruby-ops/EnrollmentImportPage';
import { ENROLL_KEYS, registerRowByRow, type EnrollRow } from '../features/admin/pages/ruby-ops/enrollmentImport';
import { EnrollImportResultSchema, EnrollSheetSchema, type EnrollImportPlanRow, type EnrollImportResult } from '../shared/api/endpoints/admin-ruby-ops';

/**
 * 엑셀 일괄 수강등록 — 수강 등록하기 row by row (lecture_reg_complete.php per idx): each row's 상태 goes 대기 → 처리중 → 등록/오류
 * while the batch runs; non-blocking warnings; .xls accepted by the parse endpoint.
 */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: 'admin01', name: '관리자', dept: 'A', deptIdx: 1, deptName: 'LMS개발부', topGrants: ['A'], subGrants: ['A3'], canWrite: true } as AdminSessionState['admin'];
const session: AdminSessionState = { phase: 'authed', isAuthed: true, canWrite: true, secondsLeft: 900, admin, login: async () => { throw new Error('x'); }, logout: async () => {}, extend: async () => true };
const planRow = (o: Partial<EnrollImportPlanRow> & { line: number }): EnrollImportPlanRow => EnrollImportResultSchema.shape.rows.element.parse({
  action: 'enroll', status: 'pending', userId: `t003${o.line}`, typedUserId: '', idConflict: false, rowLabel: `학습자${o.line}`, name: `학습자${o.line}`, memberAction: 'create', generatedId: true, lectureCode: 'ARC2026', courseName: '2026 아카이브', tutor: 'tutor01', mobile: '', email: '', companyCode: '1234567890', companyName: '테스트기업', depart: '', lectureStart: '2026-03-01', lectureEnd: '2026-05-31', lectureReStudy: '2026-06-07', serviceType: 'A', openChapter: 1, salesId: 'sales01', pwdDefault: true, nwIno: '', trneeSe: '007', irglbrSe: '000', eduManager: 'N', termAction: 'create', termeIdx: null, overlapStudy: null, errors: [], errorCells: [], resultCodes: [], ...o,
});
const dry = (rows: EnrollImportPlanRow[]): EnrollImportResult => ({ mode: 'dryRun', summary: { total: rows.length, enroll: rows.filter((r) => r.action === 'enroll').length, newMembers: 0, updateMembers: 0, newTerms: 0, error: rows.filter((r) => r.action === 'error').length, skip: 0, errorCount: 0 }, rows, applied: null });
const committed = (row: EnrollImportPlanRow, ok = true): EnrollImportResult => ({ mode: 'commit', summary: dry([row]).summary, rows: [{ ...row, line: 1, rowLabel: '엑셀 1번', status: ok ? 'registered' : 'error', action: ok ? 'enroll' : 'error', resultCodes: ok ? [] : ['[중복]'] }], applied: { enrolled: ok ? 1 : 0, membersCreated: ok ? 1 : 0, membersUpdated: 0, termsCreated: 0, skipped: 0, failed: ok ? 0 : 1, studySeqs: ok ? [2000 + row.line] : [] } });
const blank = Object.fromEntries(ENROLL_KEYS.map((k) => [k, null])) as EnrollRow;

describe('registerRowByRow (LectureRegistSubmitOk loop)', () => {
  it('sends only the enroll rows, one at a time with their sheet line, reports 처리중 → result per row, sums applied, continues after a failure', async () => {
    const plan = dry([planRow({ line: 1 }), planRow({ line: 2, action: 'error', status: 'error', errors: ['x'] }), planRow({ line: 3 }), planRow({ line: 4, userId: '', name: '' })]);
    const rows = [1, 2, 3, 4].map((n) => ({ ...blank, Name: `n${n}` }));
    const events: string[] = [];
    let inFlight = 0;
    const send = vi.fn(async (row: EnrollRow, line: number) => {
      inFlight++; expect(inFlight).toBe(1); // strictly sequential
      await Promise.resolve();
      inFlight--;
      if (line === 3) throw new Error('network');
      return committed(plan.rows[line - 1]!, line !== 4);
    });
    const out = await registerRowByRow({ plan, rows, send, onRow: (line, st) => events.push(`${line}:${st === 'processing' ? 'processing' : st.status}`), errorText: (e) => (e as Error).message });
    expect(send.mock.calls.map(([r, l]) => [r.Name, l])).toEqual([['n1', 1], ['n3', 3], ['n4', 4]]);
    expect(events).toEqual(['1:processing', '1:registered', '3:processing', '3:error', '4:processing', '4:error']);
    expect(out.mode).toBe('commit');
    expect(out.rows.map((r) => [r.line, r.status])).toEqual([[1, 'registered'], [2, 'error'], [3, 'error'], [4, 'error']]);
    expect(out.rows[0]!.rowLabel).toBe('학습자1'); // the server's "엑셀 1번" of a one-row request is relabelled
    expect(out.rows[3]!.rowLabel).toBe('엑셀 4번');
    expect(out.rows[3]!.resultCodes).toEqual(['[중복]']);
    expect(out.rows[2]!.errors).toEqual(['network']);
    expect(out.applied).toEqual({ enrolled: 1, membersCreated: 1, membersUpdated: 0, termsCreated: 0, skipped: 1, failed: 2, studySeqs: [2001] });
  });
  it('schemas: warnings default to [] for older API builds; the parse endpoint may answer format "xls"', () => {
    const { warnings: _omit, ...legacy } = planRow({ line: 1 });
    expect(EnrollImportResultSchema.shape.rows.element.parse(legacy).warnings).toEqual([]);
    expect(EnrollSheetSchema.parse({ format: 'xls', fileName: 'a.xls', rows: 1, table: [['a']] }).format).toBe('xls');
  });
});

describe('EnrollmentImportPage — live 상태 per row', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('row 1 shows 처리중 while row 2 waits (대기); each row turns 등록 as its own request returns; warnings show under 대기', async () => {
    const plan = dry([planRow({ line: 1 }), planRow({ line: 2, warnings: ['수강 종료일이 시작일보다 빠릅니다. (기존 화면과 같이 등록은 진행됩니다)'] })]);
    const posted: any[] = [];
    const pending: ((r: Response) => void)[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/admin/enrollments/import/batch')) return json(plan);
      if (/\/admin\/enrollments\/import(\?|$)/.test(url)) {
        const body = JSON.parse(String(init?.body)); posted.push(body);
        return new Promise<Response>((resolve) => pending.push(() => resolve(json(committed(plan.rows[body.firstLine - 1]!)))));
      }
      return json({ error: { code: 'NOT_FOUND', message: url } }, 404);
    }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><ToastProvider><AdminSessionContext.Provider value={session}><MemoryRouter>{<EnrollmentImportPage />}</MemoryRouter></AdminSessionContext.Provider></ToastProvider></MotionConfig></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText('붙여넣기'), { target: { value: '과정코드\t이름\t주민등록번호\nARC2026\t가\t900101-1234567\nARC2026\t나\t900202-1234567' } });
    fireEvent.click(screen.getByRole('button', { name: '검증하기' }));
    expect(await screen.findByText(/- 수강 종료일이 시작일보다 빠릅니다/)).toBeInTheDocument();
    expect(screen.getAllByText('대기')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '수강 등록하기' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '확인' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ mode: 'commit', firstLine: 1 });
    expect(await screen.findByText('처리중')).toBeInTheDocument();
    expect(screen.getAllByText('대기')).toHaveLength(1); // row 2 still waiting
    expect(screen.getByRole('button', { name: '선택항목 삭제' })).toBeDisabled();

    pending.shift()!(undefined as never);
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1]).toMatchObject({ firstLine: 2 });
    expect(await screen.findByText('등록')).toBeInTheDocument(); // row 1 done while row 2 is 처리중
    expect(screen.getByText('처리중')).toBeInTheDocument();

    pending.shift()!(undefined as never);
    await waitFor(() => expect(screen.getAllByText('등록')).toHaveLength(2));
    expect(screen.queryByText('처리중')).toBeNull();
    expect(await screen.findByText(/수강등록 처리가 완료되었습니다\. 수강 2건 등록/)).toBeInTheDocument();
  });
});
