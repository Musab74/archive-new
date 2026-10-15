import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminRubyOpsApi, type EnrollImportPlanRow, type EnrollImportResult } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { AButton, ACheckbox, AdminPage, AInput, ASelect, ATextarea, Callout, Card, ConfirmDialog, DataTable, DateField, DetailDrawer, FieldRow, Kpi, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import { IRGLBR_SE_LABELS, SERVICE_TYPE2_LABELS, TRNEE_SE_LABELS, editRowError, mapEnrollFileTable, mapEnrollRows, maskResNo, parseDelimited, registerRowByRow, type EnrollKey, type EnrollRow, type MappedEnrollImport } from './enrollmentImport';
import templateXlsx from './samples/enroll-template.xlsx?url';
import sampleXlsx from './samples/enroll-sample.xlsx?url';

/** Rows per batch (POST /admin/enrollments/import/batch). The PHP upload had no limit; 3,000 keeps one request within the API timeouts. */
export const MAX_ROWS = 3000;
const RED = 'var(--c-danger, #c0392b)';
const BLUE = 'var(--c-primary, #1f5fbf)';
const AMBER = 'var(--c-warn, #b9770e)';
export const EMON_NOTICE = tr('이몬(Emon) 안내: 미사용·탈퇴·휴면 회원의 수강 정보는 이몬으로 전송되지 않습니다. 이미 전송된 데이터는 그대로 유지됩니다. 계정을 활성으로 되돌리면, 아직 보내지 않은 건은 다음 전송 때 나갈 수 있습니다.', 'EMON: enrolments of inactive, withdrawn or dormant members are not sent. Data already sent stays; when the account is reactivated, unsent rows may go out with the next run.');
/** LectureRegistSubmitOk() confirm text (function.js). */
export const REGISTER_CONFIRM = '등록한 엑셀파일로 수강등록을 시작하시겠습니까?\n\n목록 우측 [상태]항목에서 수강등록 진행상황을 확인하실 수 있습니다.\n\n작업이 완료될 때까지 다른 페이지로 이동 또는 창을 닫지 마세요.';
const LABELS: Record<EnrollKey, string> = { LectureCode: '과정코드', ContentsName: '과정명', Tutor: '첨삭강사', Name: '이름', ResNo: '주민등록번호', Mobile: '휴대폰', Email: '이메일', CompanyCode: '사업자번호', CompanyName: '회사명', Depart: '부서명', LectureStart: '수강시작일', LectureEnd: '수강종료일', ServiceType: '서비스구분', UserID: '아이디', Pwd: '비밀번호', nwIno: '비용수급사업장', trneeSe: '훈련생구분', IrglbrSe: '비정규직구분', OpenChapter: '실시회차', SalesID: '영업담당자', EduManager: '교육담당자 여부' };

/** Cell text, red when lecture_reg_list.php would print it in red ("미입력" for an empty red cell). */
const cell = (r: EnrollImportPlanRow, key: string, value: ReactNode, empty = '미입력') => (r.errorCells.includes(key) ? <span style={{ color: RED }} data-red-cell={key}>{value === '' || value === null || value === undefined ? empty : value}</span> : value);
const codeLabel = (labels: Record<string, string>, code: string) => (code ? `${labels[code] ?? ''} (${code})` : '');
/** /admin/learning/closings prefilled like study_end.php?LectureStart&LectureEnd&CompanyCode&CompanyName. */
export const closingUrl = (o: NonNullable<EnrollImportPlanRow['overlapStudy']>) => `/admin/learning/closings?${new URLSearchParams({ lectureStart: o.lectureStart, lectureEnd: o.lectureEnd, companyCode: o.companyCode, companyName: o.companyName, go: '1' }).toString()}`;
const CLOSE_TIP = '기존 수강을 마감하면 기존 학습/이수 기록은 유지되고, 새 환급 수강을 별도 Study_Seq로 등록할 수 있습니다. 마감 후 이 목록을 새로고침하세요.';

/** lecture_reg_edit.php — edit one row of the batch (re-validated by the API afterwards). */
function RowEditDrawer({ row, line, onClose, onSave }: { row: EnrollRow | null; line: number; onClose: () => void; onSave: (r: EnrollRow) => void }) {
  const courses = useQuery({ queryKey: ['admin', 'enrollments', 'import', 'courses'], queryFn: ({ signal }) => adminRubyOpsApi.importCourses(signal), enabled: !!row, staleTime: 5 * 60_000 });
  const [f, setF] = useState<EnrollRow | null>(row);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setF(row); setErr(null); }, [row]);
  if (!row || !f) return null;
  const v = (k: EnrollKey) => f[k] ?? '';
  const set = (k: EnrollKey, value: string) => setF({ ...f, [k]: value.trim() === '' ? null : value });
  const input = (k: EnrollKey) => <AInput id={`er-${k}`} value={v(k)} onChange={(e) => set(k, e.target.value)} autoComplete="off" />;
  const courseOpts = (courses.data?.items ?? []).map((c) => ({ value: c.lectureCode, label: c.label }));
  if (v('LectureCode') && !courseOpts.some((o) => o.value === v('LectureCode'))) courseOpts.unshift({ value: v('LectureCode'), label: `${v('LectureCode')} (${tr('목록에 없음', 'not in the list')})` });
  const submit = () => { const e = editRowError(f); setErr(e); if (!e) setConfirm(true); };
  return (
    <DetailDrawer open onClose={onClose} wide title={tr('업로드한 엑셀파일 수정', 'Edit uploaded row')} subtitle={tr(`엑셀 ${line}번`, `Row ${line}`)}
      footer={<><AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" onClick={submit}>{tr('수정 하기', 'Save')}</AButton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {err ? <Callout tone="warn">{err}</Callout> : null}
        <FieldRow label={tr('과정 선택', 'Course')} htmlFor="er-LectureCode" help={tr('과정명 | 과정 코드 | 패키지 여부 | 서비스 구분', 'name | code | package | service type')}><ASelect id="er-LectureCode" value={v('LectureCode')} onChange={(e) => set('LectureCode', e.target.value)} options={courseOpts} /></FieldRow>
        {(['Tutor', 'Name', 'ResNo', 'Mobile', 'Email', 'CompanyCode', 'Depart'] as const).map((k) => <FieldRow key={k} label={k === 'Tutor' ? '첨삭 강사' : k === 'Name' ? '수강생 이름' : LABELS[k]} htmlFor={`er-${k}`}>{input(k)}</FieldRow>)}
        <FieldRow label={tr('수강 기간', 'Period')}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><DateField aria-label={LABELS.LectureStart} value={v('LectureStart')} onChange={(x) => set('LectureStart', x)} /> ~ <DateField aria-label={LABELS.LectureEnd} value={v('LectureEnd')} onChange={(x) => set('LectureEnd', x)} /></div></FieldRow>
        <FieldRow label={LABELS.ServiceType} htmlFor="er-ServiceType"><ASelect id="er-ServiceType" value={v('ServiceType')} onChange={(e) => set('ServiceType', e.target.value)} options={Object.entries(SERVICE_TYPE2_LABELS).map(([value, label]) => ({ value, label }))} placeholder="-" /></FieldRow>
        {(['UserID', 'Pwd', 'nwIno', 'trneeSe', 'IrglbrSe', 'OpenChapter', 'SalesID'] as const).map((k) => <FieldRow key={k} label={LABELS[k]} htmlFor={`er-${k}`}>{input(k)}</FieldRow>)}
        <FieldRow label={LABELS.EduManager} htmlFor="er-EduManager"><ASelect id="er-EduManager" value={['Y', '1'].includes(v('EduManager').toUpperCase()) ? 'Y' : 'N'} onChange={(e) => set('EduManager', e.target.value)} options={[{ value: 'Y', label: '사용' }, { value: 'N', label: '미사용' }]} /></FieldRow>
      </div>
      <ConfirmDialog open={confirm} title={tr('수정', 'Save')} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onSave(f); }} body={<p>{tr('수정하시겠습니까?', 'Save the changes?')}</p>} />
    </DetailDrawer>
  );
}

/**
 * lecture_reg.php "수강등록 엑셀파일로 등록" block: 파일 등록 → 업로드 하기 (lecture_reg_excel_upload.php) → the checked list
 * (lecture_reg_list.php: red cells, 상태, 선택항목 삭제, 행 수정, 기존 수강 수강마감 열기) → 수강 등록하기 (lecture_reg_complete.php per row:
 * one request per row, each 상태 going 대기 → 처리중 → 등록/오류 live).
 * The batch is kept in the browser; "임시 저장" also writes it to StudyExcelTemp like the PHP upload did.
 */
export default function EnrollmentImportPage() {
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mapped, setMapped] = useState<MappedEnrollImport | null>(null);
  const [plan, setPlan] = useState<EnrollImportResult | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editLine, setEditLine] = useState<number | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  /** Sheet line whose registration request is in flight (its 상태 shows 처리중). */
  const [processingLine, setProcessingLine] = useState<number | null>(null);

  const run = useAdminMutation({
    fn: (body: { rows: EnrollRow[]; mode: 'dryRun' | 'commit'; skipInvalid: boolean }) => adminRubyOpsApi.importEnrollmentsBatch(body), invalidate: [['admin', 'studies'], ['admin', 'members']],
    onSuccess: (r) => { setPlan(r); if (r.mode === 'commit' && r.applied) toast(tr(`수강등록 처리가 완료되었습니다. 등록 ${r.applied.enrolled}건 (신규 회원 ${r.applied.membersCreated}, 새 회차 ${r.applied.termsCreated}, 제외 ${r.applied.skipped}${r.applied.failed ? `, 오류 ${r.applied.failed}` : ''})`, `${r.applied.enrolled} enrolled (${r.applied.membersCreated} new members, ${r.applied.termsCreated} new terms, ${r.applied.skipped} skipped${r.applied.failed ? `, ${r.applied.failed} failed` : ''})`), { tone: r.applied.failed ? 'warn' : 'ok' }); },
    onError: (err) => {
      const det = isAppError(err) ? (err.details as { rows?: EnrollImportPlanRow[] } | undefined) : undefined;
      if (det?.rows && plan) setPlan({ ...plan, rows: plan.rows.map((r) => det.rows!.find((x) => x.line === r.line) ?? r) });
      toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' });
    },
  });
  const validate = (m: MappedEnrollImport) => { setPlan(null); setSelected(new Set()); run.mutate({ rows: m.rows, mode: 'dryRun', skipInvalid: false }); };
  const start = (m: MappedEnrollImport) => {
    if (!m.rows.length) { setMapped(null); setPlan(null); toast(tr('업로드한 엑셀파일이 없습니다.', 'No readable rows.'), { tone: 'danger' }); return; }
    if (m.rows.length > MAX_ROWS) { setMapped(null); toast(tr(`한 번에 ${MAX_ROWS.toLocaleString()}행까지 등록할 수 있습니다. 파일을 나눠 올려 주세요.`, `Up to ${MAX_ROWS} rows per batch.`), { tone: 'danger' }); return; }
    setMapped(m); validate(m);
  };
  const upload = useAdminMutation({ fn: (f: File) => adminRubyOpsApi.parseEnrollmentSheet(f), onSuccess: (sheet) => start(mapEnrollFileTable(sheet.table)), onError: (err) => toast(isAppError(err) ? err.message : tr('엑셀파일을 읽는도중 오류가 발생하였습니다.', 'Could not read the file.'), { tone: 'danger' }) });
  const stage = useAdminMutation({ fn: (rows: EnrollRow[]) => adminRubyOpsApi.stageEnrollments(rows), invalidate: [['admin', 'enrollments', 'staged']], onSuccess: (r) => toast(tr(`StudyExcelTemp 에 ${r.staged}건 임시 저장했습니다 (과정코드 없는 ${r.skipped}건 제외). 수강 등록 화면의 업로드한 엑셀 목록에서 이어서 처리할 수 있습니다.`, `${r.staged} rows saved to StudyExcelTemp (${r.skipped} without a course code skipped).`), { tone: 'ok' }) });

  const register = useAdminMutation({
    fn: (args: { plan: EnrollImportResult; rows: EnrollRow[] }) => registerRowByRow({
      plan: args.plan, rows: args.rows,
      send: (row, line) => adminRubyOpsApi.importEnrollments({ rows: [row], mode: 'commit', skipInvalid: true, firstLine: line }),
      onRow: (line, state) => {
        if (state === 'processing') { setProcessingLine(line); return; }
        setProcessingLine(null);
        setPlan((p) => (p ? { ...p, rows: p.rows.map((r) => (r.line === line ? state : r)) } : p));
      },
      errorText: (err) => (isAppError(err) ? err.message : adm.common.failed),
    }),
    invalidate: [['admin', 'studies'], ['admin', 'members']],
    onSuccess: (r) => {
      setProcessingLine(null); setPlan(r);
      if (r.applied) toast(tr(`수강등록 처리가 완료되었습니다. 등록 ${r.applied.enrolled}건 (신규 회원 ${r.applied.membersCreated}, 새 회차 ${r.applied.termsCreated}, 제외 ${r.applied.skipped}${r.applied.failed ? `, 오류 ${r.applied.failed}` : ''})`, `${r.applied.enrolled} enrolled (${r.applied.membersCreated} new members, ${r.applied.termsCreated} new terms, ${r.applied.skipped} skipped${r.applied.failed ? `, ${r.applied.failed} failed` : ''})`), { tone: r.applied.failed ? 'warn' : 'ok' });
    },
    onError: (err) => { setProcessingLine(null); toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); },
  });

  const parsePaste = () => start(mapEnrollRows(parseDelimited(text)));
  const onFile = (e: ChangeEvent<HTMLInputElement>) => { setFile(e.target.files?.[0] ?? null); };
  const uploadFile = () => { if (!file) { toast(tr('엑셀파일을 선택하세요.', 'Choose a file.'), { tone: 'danger' }); return; } upload.mutate(file); };
  const commit = () => { if (!mapped || !plan) return; setRegOpen(false); register.mutate({ plan, rows: mapped.rows }); };
  const replaceRows = (rows: EnrollRow[]) => { const m = { ...(mapped as MappedEnrollImport), rows }; setMapped(m); if (rows.length) validate(m); else { setPlan(null); setSelected(new Set()); } };
  const deleteSelected = () => { if (!mapped) return; setDelOpen(false); replaceRows(mapped.rows.filter((_, i) => !selected.has(i + 1))); toast(tr('삭제되었습니다.', 'Deleted.'), { tone: 'ok' }); };

  const committed = plan?.mode === 'commit';
  const processing = register.isPending;
  const rows = plan?.rows;
  const allChecked = !!rows?.length && rows.every((r) => selected.has(r.line));
  const cols: Column<EnrollImportPlanRow>[] = useMemo(() => {
    const toggle = (line: number) => setSelected((s) => { const n = new Set(s); if (n.has(line)) n.delete(line); else n.add(line); return n; });
    const statusCell = (r: EnrollImportPlanRow) => {
      const notes = r.warnings?.length ? <div style={{ textAlign: 'left', lineHeight: 1.5, fontSize: 12, color: AMBER, marginTop: 2 }} data-warnings>{r.warnings.map((w, i) => <span key={i}>- {w}<br /></span>)}</div> : null;
      if (processingLine === r.line) return <span data-status="processing">{tr('처리중', 'Processing')}</span>;
      if (r.status === 'registered') return <span style={{ color: BLUE }}>{tr('등록', 'Registered')}</span>;
      if (r.action === 'skip') return <span className="muted">{tr('제외(과정코드 없음)', 'skipped (no course code)')}</span>;
      if (r.action !== 'error') return <span>{tr('대기', 'Pending')}{notes}</span>;
      return (
        <div style={{ textAlign: 'left', lineHeight: 1.5, fontSize: 12 }}>
          <span style={{ color: RED }}>{tr('오류', 'Error')}</span>{r.resultCodes.length ? <span style={{ color: RED }}> {r.resultCodes.join('')}</span> : null}<br />
          <b>{r.rowLabel || tr(`엑셀 ${r.line}번`, `Row ${r.line}`)}</b><br />
          {r.errors.map((e, i) => <span key={i}>- {e}<br /></span>)}
          {r.overlapStudy ? <div style={{ marginTop: 6 }}><Link to={closingUrl(r.overlapStudy)} target="_blank" rel="noreferrer" title={CLOSE_TIP}>{tr('기존 수강 수강마감 열기', 'Open the existing enrolment in 수강마감')}</Link></div> : null}
        </div>
      );
    };
    return [
      { key: 'check', header: <input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set((rows ?? []).map((r) => r.line)))} />, align: 'center', width: 52, render: (r) => <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><input type="checkbox" aria-label={tr(`${r.line}번 선택`, `Select row ${r.line}`)} checked={selected.has(r.line)} onChange={() => toggle(r.line)} /><AButton size="xs" aria-label={tr(`${r.line}번 수정`, `Edit row ${r.line}`)} onClick={() => setEditLine(r.line)} disabled={committed || processing}>{adm.common.edit}</AButton></span> },
      { key: 'line', header: tr('번호', 'No.'), align: 'right', width: 48 },
      { key: 'lectureCode', header: '과정코드', nowrap: true, render: (r) => <span>{cell(r, 'LectureCode', r.lectureCode)}{r.courseName ? <small className="muted" style={{ display: 'block' }}>{r.courseName}</small> : null}</span> },
      { key: 'tutor', header: '첨삭강사', nowrap: true, render: (r) => cell(r, 'Tutor', r.tutor) },
      { key: 'name', header: '이름', nowrap: true, render: (r) => cell(r, 'Name', r.name) },
      { key: 'resNo', header: '주민등록번호', nowrap: true, render: (r) => cell(r, 'ResNo', maskResNo(mapped?.rows[r.line - 1]?.ResNo)) },
      { key: 'mobile', header: '휴대폰', nowrap: true, render: (r) => r.mobile },
      { key: 'email', header: '이메일', render: (r) => r.email },
      { key: 'companyCode', header: '사업자번호', nowrap: true, render: (r) => <span>{cell(r, 'CompanyCode', r.companyCode)}{r.companyName ? <small className="muted" style={{ display: 'block' }}>{r.companyName}</small> : null}</span> },
      { key: 'depart', header: '부서명', render: (r) => r.depart },
      { key: 'lectureStart', header: '수강시작일', nowrap: true, render: (r) => cell(r, 'LectureStart', r.lectureStart, '') },
      { key: 'lectureEnd', header: '수강종료일', nowrap: true, render: (r) => cell(r, 'LectureEnd', r.lectureEnd, '') },
      { key: 'lectureReStudy', header: '복습종료일', nowrap: true, render: (r) => cell(r, 'LectureReStudy', r.lectureReStudy, '') },
      { key: 'serviceType', header: '서비스구분', nowrap: true, render: (r) => cell(r, 'ServiceType', r.serviceType) },
      { key: 'userId', header: '아이디', nowrap: true, render: (r) => (r.idConflict ? <span style={{ color: RED }}>{tr('중복된 아이디', 'ID in use')}</span> : r.generatedId ? <span>{tr('자동 설정', 'auto')}{r.userId ? <small className="muted" style={{ display: 'block' }}>→ {r.userId}</small> : null}</span> : cell(r, 'UserID', r.userId)) },
      { key: 'pwd', header: '비밀번호', nowrap: true, render: (r) => (r.pwdDefault ? <span className="muted">{tr('(기본 1111)', '(default 1111)')}</span> : '••••') },
      { key: 'nwIno', header: '비용수급사업장', nowrap: true, render: (r) => r.nwIno },
      { key: 'trneeSe', header: '훈련생구분', nowrap: true, render: (r) => codeLabel(TRNEE_SE_LABELS, r.trneeSe) },
      { key: 'irglbrSe', header: '비정규직구분', nowrap: true, render: (r) => codeLabel(IRGLBR_SE_LABELS, r.irglbrSe) },
      { key: 'openChapter', header: '실시회차', align: 'center', render: (r) => cell(r, 'OpenChapter', r.errorCells.includes('OpenChapter') ? (mapped?.rows[r.line - 1]?.OpenChapter ?? '') : String(r.openChapter)) },
      { key: 'salesId', header: '영업담당자', nowrap: true, render: (r) => cell(r, 'SalesID', r.salesId) },
      { key: 'eduManager', header: '교육담당자 여부', align: 'center', render: (r) => r.eduManager },
      { key: 'status', header: '상태', render: statusCell },
    ];
  }, [rows, selected, allChecked, mapped, processingLine, committed, processing]);

  const errorCount = plan ? (plan.summary.errorCount ?? plan.summary.error) : 0;
  const canCommit = !!mapped && !!plan && plan.mode === 'dryRun' && (plan.summary.error === 0 || skipInvalid) && plan.summary.enroll > 0;
  const editRow = editLine !== null && mapped ? mapped.rows[editLine - 1] ?? null : null;
  return (
    <AdminPage title={tr('수강등록 엑셀파일로 등록', 'Enrol from an Excel file')} lead={tr('기존 수강등록 엑셀(A~U열, 2행부터)을 올리거나 엑셀에서 복사해 붙여넣으세요. 주민번호로 기존 회원을 찾고 없으면 회원을 새로 만든 뒤 회차·수강을 등록합니다.', 'Upload the legacy enrolment sheet (columns A–U, data from row 2) or paste rows copied from Excel. Members are matched by resident number, new ones are created, then the term and enrolment are written.')}
      crumbs={[{ label: adm.top.home, to: '/admin' }, { label: tr('수강 등록', 'Enrol learners'), to: '/admin/enrollments/new' }, { label: tr('엑셀 일괄 등록', 'Bulk import') }]}
      actions={<AButton to="/admin/enrollments/new">{tr('단건 수강 등록', 'Single enrollment')}</AButton>}>
      {!canWrite ? <Callout tone="warn" className="u-mb-8">{adm.readOnly}</Callout> : null}
      <Callout tone="warn" className="u-mb-8"><strong>{EMON_NOTICE}</strong></Callout>
      <Card title={tr('수강등록 엑셀파일로 등록', 'Upload')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <FieldRow label={tr('파일 등록', 'File')} htmlFor="enroll-file" help={tr('.xlsx / .xls(첫 번째 시트) 또는 .csv', '.xlsx / .xls (first sheet) or .csv')}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input id="enroll-file" type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={onFile} disabled={!canWrite} />
              <AButton variant="primary" onClick={uploadFile} loading={upload.isPending} disabled={!canWrite || !file} title={readOnlyTitle}>{tr('업로드 하기', 'Upload')}</AButton>
            </div>
          </FieldRow>
          <FieldRow label={tr('등록 샘플', 'Samples')}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 6 }}>
              <a href={templateXlsx} download="수강등록.xlsx">{tr('양식 다운로드', 'Download template')}</a>
              <a href={sampleXlsx} download="수강등록(샘플).xlsx">{tr('샘플 다운로드', 'Download sample')}</a>
            </div>
          </FieldRow>
        </div>
        <details className="u-mt-8">
          <summary style={{ cursor: 'pointer', fontSize: 13 }}>{tr('또는 엑셀에서 복사한 내용 붙여넣기', 'Or paste rows copied from Excel')}</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <ATextarea aria-label={tr('붙여넣기', 'Paste')} rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={tr('과정코드\t과정명\t첨삭강사\t이름\t주민등록번호\t…  (머리글 포함 복사 → 붙여넣기)', 'Course code\tCourse\tTutor\tName\tResident no.\t…  (copy including the header row)')} spellCheck={false} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} disabled={!canWrite} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <AButton onClick={() => setText('')} disabled={!text}>{tr('지우기', 'Clear')}</AButton>
              <AButton variant="primary" onClick={parsePaste} loading={run.isPending && !plan} disabled={!canWrite || !text.trim()} title={readOnlyTitle}>{tr('검증하기', 'Validate')}</AButton>
            </div>
          </div>
        </details>
      </Card>

      {mapped && plan ? (
        <Card className="u-mt-16" title={`${committed ? tr('등록 결과', 'Import result') : tr('업로드한 엑셀 목록', 'Uploaded rows')} · ${plan.summary.total.toLocaleString()}${tr('행', ' rows')}`}
          aside={<span className="muted" style={{ fontSize: 12 }}>{mapped.headerDetected ? tr('첫 행을 머리글로 인식했습니다.', 'First row read as header.') : tr('기존 엑셀 양식(A~U열) 순서로 읽었습니다.', 'Legacy A–U order assumed.')}{mapped.unknownHeaders.length ? ` · ${tr('무시된 열', 'ignored columns')}: ${mapped.unknownHeaders.join(', ')}` : ''}</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 12 }}>
            <Kpi label={tr('전체', 'Total')} value={plan.summary.total} />
            <Kpi label={tr('등록 대상', 'To enrol')} value={plan.summary.enroll} tone="ok" />
            <Kpi label={tr('신규 회원', 'New members')} value={plan.summary.newMembers} tone="navy" />
            <Kpi label={tr('기존 회원', 'Existing members')} value={plan.summary.updateMembers} />
            <Kpi label={tr('새 회차', 'New terms')} value={plan.summary.newTerms} />
            <Kpi label={tr('오류', 'Errors')} value={plan.summary.error} tone={plan.summary.error ? 'warn' : undefined} />
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '0 0 8px', lineHeight: 1.6 }}>
            * {tr('붉은색으로 표시된 항목은 오류가 예상되는 항목입니다.', 'Cells in red are expected to fail.')}<br />
            * {tr('상태 설명 : 대기(엑셀을 업로드 후 수강등록 대기 상태), 처리중(DB 입력 처리중), 등록(정상적으로 등록 완료), 오류(회원가입오류, DB입력 오류, 동일한 과정·수강기간·서비스 구분이 이미 등록되어 있는 경우, 미사용/탈퇴/휴면 계정)', 'Status: pending, processing, registered, error (member error, DB error, same course/period/service type already enrolled, inactive/withdrawn/dormant account).')}
          </p>
          {committed && plan.applied ? <Callout tone={plan.applied.failed ? 'warn' : 'ok'} className="u-mb-8">{tr(`수강등록 처리가 완료되었습니다. 수강 ${plan.applied.enrolled}건 등록 (신규 회원 ${plan.applied.membersCreated}, 기존 회원 수정 ${plan.applied.membersUpdated}, 새 회차 ${plan.applied.termsCreated}, 제외 ${plan.applied.skipped}${plan.applied.failed ? `, 오류 ${plan.applied.failed}` : ''}). 오류가 난 행은 아래 목록에서 확인하세요.`, `${plan.applied.enrolled} enrolled (${plan.applied.membersCreated} new members, ${plan.applied.membersUpdated} updated, ${plan.applied.termsCreated} new terms, ${plan.applied.skipped} skipped${plan.applied.failed ? `, ${plan.applied.failed} failed` : ''}).`)} {plan.applied.studySeqs.length ? <span>Study Seq: {plan.applied.studySeqs.slice(0, 20).map((s, i) => <span key={s}>{i ? ', ' : ''}<Link to={`/admin/studies/${s}`}>{s}</Link></span>)}{plan.applied.studySeqs.length > 20 ? ' …' : ''}</span> : null}</Callout> : null}
          <DataTable columns={cols} rows={rows} rowKey={(r) => r.line} size={50} dense emptyTitle={tr('업로드한 엑셀파일이 없습니다.', 'No uploaded rows.')} />
          {!committed ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', gap: 8 }}>
                <AButton onClick={() => (selected.size ? setDelOpen(true) : toast(tr('삭제하려는 항목을 선택하세요.', 'Select rows to delete.'), { tone: 'warn' }))} disabled={!rows?.length || processing}>{tr('선택항목 삭제', 'Delete selected')}</AButton>
                <AButton onClick={() => stage.mutate(mapped.rows)} loading={stage.isPending} disabled={!canWrite || processing} title={readOnlyTitle ?? tr('업로드한 행을 StudyExcelTemp 에 저장해 두고 나중에 수강 등록 화면에서 이어서 처리합니다(기존 업로드와 동일).', 'Keep the rows in StudyExcelTemp to continue later from the enrolment page (like the legacy upload).')}>{tr('임시 저장', 'Save for later')}</AButton>
              </span>
              {plan.summary.error ? <span role="status" style={{ color: RED, fontWeight: 700 }}>{tr(`오류 건수가 [ ${errorCount.toLocaleString()} ]건이 있습니다. 각 행의 상태 칸에서 상세 사유를 확인하세요.`, `${errorCount} errors — see the status column of each row.`)}</span> : null}
              <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                {plan.summary.error ? <ACheckbox label={tr('오류 행은 제외하고 등록', 'Skip error rows')} checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} /> : null}
                <AButton variant="primary" onClick={() => setRegOpen(true)} loading={processing} disabled={!canWrite || !canCommit} title={readOnlyTitle}>{tr('수강 등록하기', 'Register')}</AButton>
              </span>
            </div>
          ) : null}
        </Card>
      ) : null}
      <RowEditDrawer row={editRow} line={editLine ?? 0} onClose={() => setEditLine(null)} onSave={(r) => { if (!mapped || editLine === null) return; const next = [...mapped.rows]; next[editLine - 1] = r; setEditLine(null); replaceRows(next); toast(tr('수정 되었습니다.', 'Saved.'), { tone: 'ok' }); }} />
      <ConfirmDialog open={delOpen} title={tr('선택항목 삭제', 'Delete selected')} tone="danger" onCancel={() => setDelOpen(false)} onConfirm={deleteSelected} body={<p>{tr('선택한 항목을 삭제하시겠습니까?', 'Delete the selected rows?')} ({selected.size})</p>} />
      <ConfirmDialog open={regOpen} title={tr('수강 등록하기', 'Register')} onCancel={() => setRegOpen(false)} onConfirm={commit} body={<p style={{ whiteSpace: 'pre-line' }}>{REGISTER_CONFIRM}</p>} />
    </AdminPage>
  );
}
