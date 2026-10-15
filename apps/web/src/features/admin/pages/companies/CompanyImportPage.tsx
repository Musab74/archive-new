import { Fragment, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { AButton, ACheckbox, AdminPage, ATextarea, Callout, Card, ConfirmDialog, Kpi, StatusBadge, adminStyles } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';
import {
  IMPORT_KEYS, PREVIEW_ROW1, PREVIEW_ROW2, dropLines, isHrdTraineeFile, loadDraft, mapImportRows, parseDelimited, rowFromHrdTraineeCells, rowsFromTemplateGrid, saveDraft,
  type ImportKey, type ImportRow, type MappedImport,
} from './companyImport';
import { sheetRows } from './xlsxRead';
import { decodeText, readSpreadsheet, sniffSpreadsheet } from './xlsRead';
import { companiesApi, type ImportFormat, type ImportPlanRowV2, type ImportResultV2 } from './companiesApi';
import templateUrl from './company-template.xlsx?url';
import sampleUrl from './company-sample.xlsx?url';

const MAX_ROWS = 500;
const tone = (a: string) => (a === 'create' ? 'ok' : a === 'update' ? 'info' : 'danger') as 'ok' | 'info' | 'danger';
const SCALE_LABEL: Record<string, string> = { C: '우선지원대상', A: '대규모 1000인 이상', B: '대규모 1000인 미만' };

/** Which preview cell a validation message is about (company_write_excel.php paints that cell red). */
const MESSAGE_KEY: [RegExp, ImportKey][] = [[/^회사명/, 'CompanyName'], [/사업자번호/, 'CompanyCode'], [/사업주 ID/, 'CompanyID'], [/기업관리코드/, 'HomePage'], [/^우편번호/, 'Zipcode'], [/^회사 규모/, 'CompanyScale'], [/^영업자ID/, 'SalesManager']];
export function flaggedKeys(p: ImportPlanRowV2 | undefined): Set<ImportKey> {
  const out = new Set<ImportKey>();
  for (const m of [...(p?.errors ?? []), ...(p?.warnings ?? [])]) for (const [re, k] of MESSAGE_KEY) if (re.test(m)) out.add(k);
  return out;
}
/** Value shown in the preview: the normalised codes from the plan (defaults applied, as in CompanyExcelTemp), the raw cell otherwise. */
function cellValue(k: ImportKey, row: ImportRow, p: ImportPlanRowV2 | undefined): string {
  if (p && k === 'CompanyCode') return p.companyCode;
  if (p && k === 'CompanyID') return p.companyId;
  if (p && k === 'HomePage') return p.homePage;
  if (k === 'Zipcode') return row.Zipcode ?? '00000';
  if (k === 'CompanyScale') return row.CompanyScale ? SCALE_LABEL[row.CompanyScale] ?? row.CompanyScale : SCALE_LABEL.C!;
  if (k === 'CSEnabled' || k === 'CyberEnabled') return row[k] === 'Y' ? 'Y' : 'N';
  return row[k] ?? '';
}

async function fileBytes(f: File): Promise<ArrayBuffer> {
  if (typeof f.arrayBuffer === 'function') return f.arrayBuffer();
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as ArrayBuffer); r.onerror = () => reject(r.error); r.readAsArrayBuffer(f); });
}
function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

/**
 * 사업주 엑셀 등록 (company_write_excel.php → company_excel_upload.php → company_excel_upload_complete.php).
 * The uploaded rows stay in this browser (localStorage draft) instead of CompanyExcelTemp; every validation runs on the API (dryRun),
 * and "업로드 하기" commits the batch in one transaction.
 */
export default function CompanyImportPage() {
  const s = adm.companies.import;
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [format, setFormat] = useState<ImportFormat>('template');
  const [mapped, setMapped] = useState<MappedImport | null>(null);
  const [plan, setPlan] = useState<ImportResultV2 | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<'commit' | 'delete' | null>(null);
  const [reading, setReading] = useState(false);

  const run = useAdminMutation({
    fn: (body: { rows: ImportRow[]; mode: 'dryRun' | 'commit'; skipInvalid: boolean; format: ImportFormat }) => companiesApi.importCompanies(body), invalidate: [['admin', 'companies']],
    onSuccess: (r) => {
      setConfirm(null); setPlan(r);
      if (r.mode === 'commit' && r.applied) { toast(s.done(r.applied.created, r.applied.updated, r.applied.skipped), { tone: 'ok' }); saveDraft(null); }
    },
    onError: (err) => {
      setConfirm(null);
      const det = isAppError(err) ? (err.details as { rows?: ImportPlanRowV2[] } | undefined) : undefined;
      if (det?.rows && plan) setPlan({ ...plan, rows: plan.rows.map((r) => det.rows!.find((x) => x.line === r.line) ?? r) });
      toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' });
    },
  });

  const validate = (m: MappedImport, f: ImportFormat, name: string | null) => {
    setPlan(null); setChecked(new Set());
    if (!m.rows.length) { setMapped(null); saveDraft(null); toast(s.empty, { tone: 'danger' }); return; }
    if (m.rows.length > MAX_ROWS) { setMapped(null); toast(s.tooMany, { tone: 'danger' }); return; }
    setMapped(m); setFormat(f);
    saveDraft({ rows: m.rows, format: f, fileName: name, savedAt: new Date().toISOString() });
    run.mutate({ rows: m.rows, mode: 'dryRun', skipInvalid: false, format: f });
  };

  // a reload keeps the uploaded batch (the PHP kept it in CompanyExcelTemp for the admin)
  useEffect(() => {
    const d = loadDraft();
    if (d && canWrite) { setFileName(d.fileName); validate({ rows: d.rows, headerDetected: true, columns: [...IMPORT_KEYS], unknownHeaders: [] }, d.format, d.fileName); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parse = () => validate(mapImportRows(parseDelimited(text)), 'template', fileName);
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setFileName(f.name);
    const lower = f.name.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      setReading(true);
      try {
        // PHPExcel_IOFactory::createReaderForFile(): the reader follows the content (.xlsx ZIP, .xls BIFF, HTML table), not the extension
        const bytes = new Uint8Array(await fileBytes(f));
        if (sniffSpreadsheet(bytes) === 'text') { setText(decodeText(bytes)); setMapped(null); setPlan(null); return; }
        const book = await readSpreadsheet(bytes);
        if (isHrdTraineeFile(f.name)) {
          const sheet = await book.sheet(1);
          if (!sheet) { toast(tr('"HRD 훈련생 등록" 파일의 두 번째 시트를 찾을 수 없습니다.', 'The second sheet of the "HRD 훈련생 등록" file is missing.'), { tone: 'danger' }); return; }
          setText('');
          validate(rowFromHrdTraineeCells((ref) => sheet.cells.get(ref)), 'hrdTrainee', f.name);
        } else {
          const sheet = await book.sheet(0);
          if (!sheet) { toast(s.empty, { tone: 'danger' }); return; }
          setText('');
          validate(rowsFromTemplateGrid(sheetRows(sheet, 2, IMPORT_KEYS.length)), 'template', f.name);
        }
      } catch (err) {
        toast(err instanceof Error && err.message === 'XLS_ENCRYPTED' ? tr('암호가 걸린 엑셀파일은 읽을 수 없습니다. 암호를 해제한 뒤 올려 주세요.', 'Password-protected Excel files cannot be read.') : tr('엑셀파일을 읽는도중 오류가 발생하였습니다.', 'The Excel file could not be read.'), { tone: 'danger' });
      } finally { setReading(false); }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result ?? '')); setMapped(null); setPlan(null); };
    reader.readAsText(f, 'utf-8');
  };
  const clearAll = () => { setText(''); setMapped(null); setPlan(null); setFileName(null); setChecked(new Set()); saveDraft(null); };
  const deleteChecked = () => {
    if (!mapped) return;
    const rows = dropLines(mapped.rows, checked);
    setConfirm(null);
    if (!rows.length) { clearAll(); return; }
    validate({ ...mapped, rows }, format, fileName);
  };

  const planByLine = useMemo(() => new Map((plan?.rows ?? []).map((p) => [p.line, p])), [plan]);
  const committed = plan?.mode === 'commit';
  const canCommit = !!mapped && !!plan && plan.mode === 'dryRun' && (plan.summary.error === 0 || skipInvalid) && plan.summary.create + plan.summary.update > 0;
  const warnCount = plan?.rows.filter((r) => r.warnings.length).length ?? 0;
  const allChecked = !!mapped && mapped.rows.length > 0 && checked.size === mapped.rows.length;
  const toggle = (line: number) => setChecked((c) => { const n = new Set(c); if (n.has(line)) n.delete(line); else n.add(line); return n; });
  const st = adminStyles as Record<string, string>;
  const red = { color: 'var(--c-danger)', fontWeight: 700 } as const;

  return (
    <AdminPage title={tr('사업주 엑셀 등록', s.title)} lead={s.lead} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: adm.companies.title, to: '/admin/companies' }, { label: s.title }]}
      actions={<><AButton onClick={() => download(templateUrl, '사업주정보.xlsx')}>{tr('양식 다운로드', 'Template')}</AButton><AButton onClick={() => download(sampleUrl, '사업주정보(샘플).xlsx')}>{tr('샘플 다운로드', 'Sample')}</AButton><AButton to="/admin/companies">{tr('목록', 'List')}</AButton></>}>
      {!canWrite ? <Callout tone="warn" className="u-mb-8">{adm.readOnly}</Callout> : null}
      <Card title={tr('파일 등록', 'Upload a file')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13 }}>{s.file}: <input type="file" aria-label={tr('엑셀 파일', 'Excel file')} accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values,text/plain" onChange={(e) => void onFile(e)} disabled={!canWrite || reading} /></label>
            {fileName ? <span className="muted" style={{ fontSize: 12 }}>{fileName}{format === 'hrdTrainee' ? tr(' · HRD 훈련생 등록 형식 (사업주 ID 자동 발급)', ' · HRD trainee format (company ID generated)') : ''}</span> : null}
            {reading ? <span role="status" style={{ fontSize: 12 }}>{tr('처리중입니다. 잠시만 기다려 주세요...', 'Working…')}</span> : null}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('엑셀(.xlsx / .xls)은 첫 번째 시트의 2행부터 A~W 열을 읽습니다. 파일명에 "HRD 훈련생 등록"이 들어 있으면 두 번째 시트의 정해진 셀을 읽습니다. CSV 파일이나 엑셀에서 복사한 내용을 아래에 붙여 넣어도 됩니다.', '.xlsx / .xls: first sheet, columns A–W from row 2. A file named "HRD 훈련생 등록" is read from its second sheet. You can also paste rows copied from Excel below.')}</p>
          <ATextarea aria-label={s.paste} rows={5} value={text} onChange={(e) => { setText(e.target.value); setMapped(null); setPlan(null); setFileName(null); }} placeholder={tr('회사명\t사업주아이디\t회사규모\t사업자등록번호\t…  (엑셀에서 머리글 포함 복사 → 붙여넣기)', 'Company\tCompany ID\tSize\tBusiness no.\t…  (copy from Excel including the header row, then paste)')} spellCheck={false} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} disabled={!canWrite} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <AButton onClick={clearAll} disabled={!text && !mapped}>{s.clear}</AButton>
            <AButton variant="primary" onClick={parse} loading={run.isPending && !plan} disabled={!canWrite || !text.trim()} title={readOnlyTitle}>{s.parse}</AButton>
          </div>
        </div>
      </Card>

      {mapped && plan ? (
        <Card className="u-mt-16" title={`${committed ? tr('등록 결과', 'Import result') : tr('업로드한 엑셀파일 데이터 확인', 'Uploaded data')} · ${s.rows(plan.summary.total)}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
            <Kpi label={s.summary.total} value={plan.summary.total} />
            <Kpi label={s.summary.create} value={plan.summary.create} tone="ok" />
            <Kpi label={s.summary.update} value={plan.summary.update} tone="navy" />
            <Kpi label={s.summary.error} value={plan.summary.error} tone={plan.summary.error ? 'warn' : undefined} />
            <Kpi label={tr('경고', 'Warnings')} value={warnCount} />
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 8 }} className="muted">
            * {tr('붉은색으로 표시된 항목은 오류가 예상되는 항목입니다.', 'Cells in red are likely errors.')}<br />
            * {tr('사업자번호가 기존 사업주와 같으면 "수정"(기존 사업주 정보를 덮어씀), 엑셀 안에서 중복되면 오류입니다.', 'A business number that already exists updates that company; a duplicate inside the file is an error.')}<br />
            * {tr('우편번호·회사 규모·영업자ID 경고는 등록을 막지 않습니다. 회사명/사업자번호가 없는 행은 오류로 표시되며 "오류 행 제외"로 건너뜁니다.', 'Zipcode, size and sales-ID warnings do not block. Rows without a name or business number are errors and are skipped with "skip rows with errors".')}
          </div>
          {committed && plan.applied ? <Callout tone="ok" className="u-mb-8">{s.done(plan.applied.created, plan.applied.updated, plan.applied.skipped)}</Callout> : plan.summary.error ? <Callout tone="warn" className="u-mb-8">{s.needFix}</Callout> : null}
          <div className={st.tableWrap}>
            <table className={`${st.table} ${st.dense}`} aria-label={tr('업로드한 엑셀파일 데이터', 'Uploaded rows')}>
              <thead>
                <tr>
                  <th rowSpan={2}><input type="checkbox" aria-label={tr('전체선택', 'Select all')} checked={allChecked} onChange={() => setChecked(allChecked ? new Set() : new Set(mapped.rows.map((_, i) => i + 1)))} disabled={committed} /></th>
                  <th rowSpan={2}>{tr('번호', 'No.')}</th>
                  {PREVIEW_ROW1.map(([k, h]) => <th key={k}>{h}</th>)}
                  <th rowSpan={2}>{tr('처리 / 검증 결과', 'Action / validation')}</th>
                </tr>
                <tr>{PREVIEW_ROW2.map(([k, h]) => <th key={k}>{h}</th>)}<th /></tr>
              </thead>
              <tbody>
                {mapped.rows.map((row, i) => {
                  const line = i + 1; const p = planByLine.get(line); const flags = flaggedKeys(p);
                  const cell = (k: ImportKey) => <td key={k} style={flags.has(k) ? red : undefined}>{cellValue(k, row, p)}</td>;
                  const bg = i % 2 ? { background: 'var(--c-soft)' } : undefined;
                  return (
                    <Fragment key={line}>
                      <tr style={bg}>
                        <td rowSpan={2}><input type="checkbox" aria-label={tr(`${line}번 선택`, `Select row ${line}`)} checked={checked.has(line)} onChange={() => toggle(line)} disabled={committed} /></td>
                        <td rowSpan={2}>{line}</td>
                        {PREVIEW_ROW1.map(([k]) => cell(k))}
                        <td rowSpan={2} style={{ minWidth: 220 }}>
                          {p ? <StatusBadge tone={tone(p.action)}>{s.actions[p.action] ?? p.action}</StatusBadge> : null}
                          {p?.errors.length ? <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: 'var(--c-danger)', fontSize: 12 }}>{p.errors.map((e, j) => <li key={j}>{e}</li>)}</ul> : null}
                          {p?.warnings.length ? <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: 'var(--c-warn, #b35c00)', fontSize: 12 }}>{p.warnings.map((e, j) => <li key={j}>{e}</li>)}</ul> : null}
                        </td>
                      </tr>
                      <tr style={bg}>{PREVIEW_ROW2.map(([k]) => cell(k))}<td /></tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!committed ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap' }}>
              <AButton onClick={() => (checked.size ? setConfirm('delete') : toast(tr('삭제하려는 항목을 선택하세요.', 'Select the rows to remove.'), { tone: 'danger' }))} disabled={!canWrite}>{tr('선택항목 삭제', 'Remove selected')}</AButton>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <ACheckbox label={s.skipInvalid} checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} disabled={!plan.summary.error} />
                <AButton variant="primary" onClick={() => setConfirm('commit')} loading={run.isPending} disabled={!canWrite || !canCommit} title={readOnlyTitle}>{tr('업로드 하기', s.commit)}</AButton>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog open={confirm === 'commit'} tone="info" title={tr('현재 내역을 사업주로 등록하시겠습니까?', 'Register these rows as companies?')} body={plan ? <p>{s.rows(plan.summary.create + plan.summary.update)}</p> : null}
        loading={run.isPending} onCancel={() => setConfirm(null)} onConfirm={() => { if (mapped) run.mutate({ rows: mapped.rows, mode: 'commit', skipInvalid, format }); }} />
      <ConfirmDialog open={confirm === 'delete'} tone="warn" title={tr('선택한 항목을 삭제하시겠습니까?', 'Remove the selected rows?')} body={<p>{tr(`${checked.size}개 행을 이번 업로드에서 뺍니다. 데이터베이스에는 아무것도 쓰지 않습니다.`, `${checked.size} row(s) are dropped from this batch; nothing is written to the database.`)}</p>}
        onCancel={() => setConfirm(null)} onConfirm={deleteChecked} />
    </AdminPage>
  );
}
