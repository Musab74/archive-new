import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, LIVE_EXCEL_KEYS, type LiveExcelKey, type LiveExcelListItem } from '../../../../shared/api/endpoints/admin-content-archive';
import { AButton, AdminPage, AInput, ATextarea, Callout, Card, ConfirmDialog, DataTable, DetailDrawer, FieldRow, adminStyles, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { downloadText } from '../companies/companyImport';
import { useFormErrors } from '../courses/courses-parity.shared';
import { AnyGrantGate, LIVE_GRANTS, LIVE_LIST } from './shared';
import { LIVE_EXCEL_LABELS, LIVE_EXCEL_REQUIRED, liveExcelRows, liveExcelTableFromXlsx, parseLiveExcel, liveExcelTemplate } from './liveExcel';
import formXlsx from './live-contents-form.xlsx?url';
import exampleXlsx from './live-contents-example.xlsx?url';

const LIST = LIVE_LIST;
/** Plain download anchor styled like an AButton. */
const btnCls = `${adminStyles.btn ?? ''} ${adminStyles.btnSm ?? ''}`;
type RegState = '처리중' | '등록' | '오류';

/**
 * /admin/live-courses?view=excel — 엑셀로 등록 for 실시간 강의실 (course_write_excel.php?ctype=R): upload to CourseExcelTemp
 * (course_excel_upload.php), the checked staging list (course_excel_list.php), per-row edit (course_reg_edit.php), 선택항목 삭제
 * (course_select_delete.php) and 컨텐츠 등록하기 row by row (course_reg_complete.php) with the 상태 column.
 */
export default function LiveCourseExcelPage() {
  return <AnyGrantGate grants={LIVE_GRANTS}><LiveExcel /></AnyGrantGate>;
}

function LiveExcel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string[][] | null>(null); // the first sheet of an uploaded .xlsx (header row first)
  const parsed = useMemo(() => (sheet ? liveExcelRows(sheet) : text.trim() ? parseLiveExcel(text) : []), [sheet, text]);
  const [problems, setProblems] = useState<string[]>([]);
  const list = useQuery({ queryKey: ['admin', 'live-courses', 'excel'], queryFn: ({ signal }) => apiX.liveExcelList(signal) });
  const items = list.data?.items ?? [];
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [regState, setRegState] = useState<Record<number, RegState>>({});
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'register' | null>(null);
  const [edit, setEdit] = useState<number | null>(null);
  useEffect(() => { setChecked((c) => new Set([...c].filter((i) => items.some((x) => x.idx === i)))); }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const inv = [['admin', 'live-courses', 'excel']];
  const upload = useAdminMutation({
    fn: () => apiX.uploadLiveExcel(parsed), invalidate: inv, success: tr('업로드했습니다. 아래 목록에서 확인 후 등록하세요.', 'Uploaded. Check the list below, then register.'),
    onSuccess: () => { setText(''); setSheet(null); setFileName(null); setProblems([]); setRegState({}); },
    onError: (err) => { const d = isAppError(err) && Array.isArray(err.details) ? (err.details as { message?: string }[]).map((x) => x.message ?? '') : []; setProblems(d); toast(isAppError(err) ? err.message : tr('데이터 확인 위해 엑셀파일을 저장중 오류 발생', 'Could not store the sheet.'), { tone: 'danger' }); },
  });
  const remove = useAdminMutation({ fn: (ids: number[]) => apiX.deleteLiveExcel(ids), invalidate: inv, success: tr('삭제되었습니다.', 'Deleted.'), onSuccess: () => { setConfirm(null); setChecked(new Set()); } });

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (lower.endsWith('.xls')) { toast(tr('예전 엑셀 형식(.xls)은 읽을 수 없습니다. 엑셀에서 "다른 이름으로 저장 → .xlsx"로 저장한 뒤 올려 주세요.', 'Legacy .xls files cannot be read. Save the file as .xlsx in Excel and upload it again.'), { tone: 'danger' }); e.target.value = ''; return; }
    const buf = typeof f.arrayBuffer === 'function' ? await f.arrayBuffer() : await new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f); });
    setProblems([]);
    if (lower.endsWith('.xlsx')) {
      // course_excel_upload.php: PHPExcel on the uploaded 컨텐츠.xlsx — first sheet, row 2.., columns A..AD
      try { setSheet(await liveExcelTableFromXlsx(buf)); setText(''); setFileName(f.name); } catch { setSheet(null); setFileName(null); toast(tr('엑셀 파일을 읽을 수 없습니다. 컨텐츠.xlsx 양식으로 저장한 .xlsx 파일인지 확인하세요.', 'Could not read this .xlsx file.'), { tone: 'danger' }); }
      return;
    }
    let s = new TextDecoder('utf-8').decode(buf);
    if (s.includes('�')) { try { s = new TextDecoder('euc-kr').decode(buf); } catch { /* keep utf-8 */ } }
    setSheet(null); setText(s); setFileName(f.name);
  };
  const doUpload = () => {
    if (!parsed.length) { toast(tr('엑셀 파일을 선택하세요.', 'Choose an Excel file (or paste the rows).'), { tone: 'danger' }); return; }
    if (!window.confirm(tr('업로드 하시겠습니까?', 'Upload?'))) return;
    upload.mutate();
  };
  /** CourseRegistProcess(): one course_reg_complete.php call per staging row, 0.5 s apart in the PHP; the 상태 column follows. */
  const registerAll = async () => {
    setConfirm(null); setRunning(true);
    for (const it of items) {
      setRegState((m) => ({ ...m, [it.idx]: '처리중' }));
      try { await apiX.registerLiveExcel(it.idx); setRegState((m) => ({ ...m, [it.idx]: '등록' })); } catch { setRegState((m) => ({ ...m, [it.idx]: '오류' })); }
    }
    setRunning(false);
    toast(tr('컨텐츠 등록 처리가 완료되었습니다. 등록 중 오류가 발생한 부분은 갱신된 목록에서 확인이 가능합니다.', 'Registration finished. Rows that failed stay in the refreshed list.'));
    await qc.invalidateQueries({ queryKey: ['admin', 'live-courses'] });
  };

  const cell = (r: LiveExcelListItem, k: LiveExcelKey) => {
    const miss = r.missing[k];
    if (miss) return <span style={{ color: miss === 'error' ? 'var(--danger, #c00)' : 'var(--info, #2563eb)' }}>{tr('미입력', 'missing')}</span>;
    const v = r[k];
    if (k === 'LectureCode' && r.duplicate) return <>{String(v ?? '')} <span style={{ color: 'var(--danger, #c00)' }}>{r.duplicate === 'course' ? tr('중복(이미 등록된 과정코드)', 'duplicate (already registered)') : tr('중복(등록하려는 데이터 중 동일 과정코드 존재)', 'duplicate (twice in this upload)')}</span></>;
    if (k === 'ContentsStart' || k === 'ContentsEnd' || k === 'UploadDate') return String(v ?? '').replace(/-/g, '').slice(0, 8);
    const sv = String(v ?? '');
    return sv.length > 40 ? <span title={sv}>{sv.slice(0, 40)}…</span> : sv;
  };
  const allChecked = items.length > 0 && items.every((r) => checked.has(r.idx));
  const columns: Column<LiveExcelListItem>[] = [
    { key: 'check', header: <input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={allChecked} onChange={(e) => setChecked(e.target.checked ? new Set(items.map((r) => r.idx)) : new Set())} />, width: 64, align: 'center',
      render: (r) => <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}><input type="checkbox" aria-label={tr(`${r.no}번 선택`, `Select row ${r.no}`)} checked={checked.has(r.idx)} onChange={(e) => setChecked((c) => { const n = new Set(c); if (e.target.checked) n.add(r.idx); else n.delete(r.idx); return n; })} /><AButton size="xs" disabled={!canWrite} onClick={() => setEdit(r.idx)}>{tr('수정', 'Edit')}</AButton></span> },
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 50 },
    ...LIVE_EXCEL_KEYS.map((k): Column<LiveExcelListItem> => ({ key: k, header: LIVE_EXCEL_LABELS[k], nowrap: k !== 'Intro' && k !== 'EduTarget' && k !== 'EduGoal' && k !== 'ContentsName', render: (r) => cell(r, k) })),
    { key: 'status', header: tr('상태', 'Status'), align: 'center', nowrap: true, render: (r) => { const st = regState[r.idx]; return st ? <span style={{ color: st === '등록' ? 'var(--info, #2563eb)' : st === '오류' ? 'var(--danger, #c00)' : undefined }}>{st}</span> : r.errorCount ? <span style={{ color: 'var(--danger, #c00)' }} title={r.errors.join('\n')}>{tr('대기 (오류)', 'waiting (errors)')}</span> : tr('대기', 'waiting'); } },
  ];
  const errorCount = list.data?.errorCount ?? 0;
  return (
    <AdminPage title={tr('실시간 강의실 엑셀 등록', 'Live contents — Excel registration')} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: tr('라이브 컨텐츠 관리', 'Live contents'), to: LIST }, { label: tr('엑셀로 등록', 'Excel') }]} actions={<AButton to={LIST}>{adm.common.back}</AButton>}>
      <Callout tone="warn">{tr('***이 페이지에서 등록하는 데이터는 모두 "실시간 강의실" 으로 등록이 됩니다. 다른 컨텐츠 유형으로 등록하시고 싶으시면 해당 컨텐츠 관리로 이동하셔서 업로드해주세요.', '***Every row registered here becomes a "live classroom" (ctype R) content. Use the other content screens for other types.')}</Callout>
      <Card title={tr('등록 샘플', 'Template')}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {/* course_write_excel.php: ./sample/컨텐츠.xlsx and ./sample/컨텐츠(샘플).xlsx (the same files, bundled) */}
          <a className={btnCls} href={formXlsx} download="컨텐츠.xlsx">{tr('양식 다운로드', 'Download template')}</a>
          <a className={btnCls} href={exampleXlsx} download="컨텐츠(샘플).xlsx">{tr('샘플 다운로드', 'Download sample')}</a>
          <AButton size="sm" icon="download" onClick={() => downloadText('컨텐츠_실시간강의실_양식.csv', liveExcelTemplate(false))}>{tr('CSV 양식', 'CSV template')}</AButton>
          <span style={{ fontSize: 13 }}><b style={{ background: '#FFFF00', color: '#000', padding: '1px 8px', border: '1px solid #E6C200' }}>{tr('필수', 'Required')}</b> {tr('(필수) 헤더 컬럼은 반드시 입력', '(필수) columns must be filled')} &nbsp; <b style={{ background: '#9BC2E6', color: '#000', padding: '1px 8px', border: '1px solid #5B9BD5' }}>{tr('선택', 'Optional')}</b> {tr('(선택) 헤더 컬럼은 선택 입력', '(선택) columns are optional')}</span>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{tr(`첫 줄은 머리글이며, 칸은 순서대로 읽습니다 (A~AD: ${LIVE_EXCEL_KEYS.map((k) => LIVE_EXCEL_LABELS[k]).join(' · ')}). 과정분류·난이도·직무분야는 번호(idx), 관심분야·역량은 쉼표로 구분한 번호입니다.`, 'The first line is the header; cells are read by position (A..AD). Categories / keywords are idx numbers; 관심분야 and 역량 are comma-separated idx lists.')}</p>
      </Card>
      <Card title={tr('파일 등록', 'Upload')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ATextarea aria-label={tr('엑셀 붙여넣기', 'Paste from Excel')} rows={6} value={text} onChange={(e) => { setText(e.target.value); setSheet(null); setFileName(null); setProblems([]); }} placeholder={tr('컨텐츠.xlsx 파일을 선택하거나, 엑셀에서 머리글 포함으로 복사해 붙여 넣으세요 (CSV/TSV 파일도 됩니다).', 'Choose the 컨텐츠.xlsx file, or copy the rows from Excel (with the header line) and paste them (CSV/TSV files work too).')} spellCheck={false} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} disabled={!canWrite} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13 }}>{tr('파일', 'File')}: <input type="file" accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,text/plain" aria-label={tr('엑셀 파일', 'Excel file')} onChange={(e) => void onFile(e)} disabled={!canWrite} /></label>
            {fileName ? <span className="mono" style={{ fontSize: 12 }}>{fileName}</span> : null}
            <span className="muted" style={{ fontSize: 13 }}>{tr(`읽은 행 ${parsed.length}건`, `${parsed.length} rows read`)}</span>
            <AButton variant="primary" disabled={!canWrite || !parsed.length} title={readOnlyTitle} loading={upload.isPending} onClick={doUpload}>{tr('업로드 하기', 'Upload')}</AButton>
          </div>
          {problems.length ? <Callout tone="warn"><ul style={{ margin: 0, paddingLeft: 18 }}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul></Callout> : null}
        </div>
      </Card>
      <Card title={tr('업로드 목록', 'Uploaded rows')}>
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>{tr('* 붉은색으로 표시된 항목은 오류가 예상되는 항목입니다. * 상태 설명 : 대기(엑셀을 업로드 후 등록 대기 상태), 처리중(DB 입력 처리중), 등록(정상적으로 등록 완료), 오류(DB입력 오류)', '* Red cells are expected errors. * Status: waiting (uploaded), working (inserting), registered, error.')}</p>
        <div style={{ overflowX: 'auto' }}>
          <DataTable columns={columns} rows={items} rowKey={(r) => r.idx} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('업로드한 엑셀파일이 없습니다.', 'Nothing uploaded yet.')} dense />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 }}>
          <AButton disabled={!canWrite || running} onClick={() => { if (!items.length) { toast(tr('등록된 엑셀파일이 없습니다.', 'Nothing uploaded.'), { tone: 'danger' }); return; } if (!checked.size) { toast(tr('삭제하려는 항목을 선택하세요.', 'Select the rows to delete.'), { tone: 'danger' }); return; } setConfirm('delete'); }}>{tr('선택항목 삭제', 'Delete selected')}</AButton>
          {errorCount > 0 ? <b style={{ color: 'var(--danger, #c00)' }}>{tr(`오류 건수가 [ ${errorCount.toLocaleString('ko-KR')} ]건이 있습니다.`, `${errorCount} errors must be fixed first.`)}</b>
            : <AButton variant="primary" disabled={!canWrite || running || !items.length} title={readOnlyTitle} loading={running} onClick={() => setConfirm('register')}>{tr('컨텐츠 등록하기', 'Register contents')}</AButton>}
          <span />
        </div>
      </Card>
      <ConfirmDialog open={confirm === 'delete'} tone="danger" title={tr('선택항목 삭제', 'Delete selected')} body={<p>{tr(`선택한 항목(${checked.size}건)을 삭제하시겠습니까?`, `Delete the ${checked.size} selected rows?`)}</p>} loading={remove.isPending} onCancel={() => setConfirm(null)} onConfirm={() => remove.mutate([...checked])} />
      <ConfirmDialog open={confirm === 'register'} title={tr('컨텐츠 등록하기', 'Register contents')} body={<p style={{ whiteSpace: 'pre-wrap' }}>{tr('등록한 엑셀파일로 실시간 강의실 컨텐츠 등록을 시작하시겠습니까?\n\n목록 우측 [상태]항목에서 컨텐츠 등록 진행상황을 확인하실 수 있습니다.\n\n작업이 완료될 때까지 다른 페이지로 이동 또는 창을 닫지 마세요.', 'Start registering the uploaded rows as live contents?\nThe 상태 column shows the progress. Do not leave the page until it finishes.')}</p>} onCancel={() => setConfirm(null)} onConfirm={() => void registerAll()} />
      {edit !== null ? <ExcelRowDrawer idx={edit} onClose={() => setEdit(null)} /> : null}
    </AdminPage>
  );
}

/** course_reg_edit.php — correct one staging row (every template cell). */
function ExcelRowDrawer({ idx, onClose }: { idx: number; onClose: () => void }) {
  const { canWrite } = useWriteGate();
  const q = useQuery({ queryKey: ['admin', 'live-courses', 'excel', idx], queryFn: ({ signal }) => apiX.liveExcelRow(idx, signal) });
  const [f, setF] = useState<Record<LiveExcelKey, string>>(() => Object.fromEntries(LIVE_EXCEL_KEYS.map((k) => [k, ''])) as Record<LiveExcelKey, string>);
  useEffect(() => { if (q.data) setF(Object.fromEntries(LIVE_EXCEL_KEYS.map((k) => [k, q.data[k] === null || q.data[k] === undefined ? '' : String(q.data[k])])) as Record<LiveExcelKey, string>); }, [q.data]);
  const { errors, onError } = useFormErrors();
  const save = useAdminMutation({ fn: () => apiX.patchLiveExcel(idx, f), invalidate: [['admin', 'live-courses', 'excel']], success: tr('수정 되었습니다.', 'Saved.'), onSuccess: onClose, onError });
  const long = new Set<LiveExcelKey>(['Intro', 'EduTarget', 'EduGoal']);
  return (
    <DetailDrawer open onClose={onClose} wide title={tr('엑셀 업로드 행 수정', 'Edit uploaded row')} subtitle={f.LectureCode}
      footer={<><AButton onClick={onClose}>{adm.common.cancel}</AButton><AButton variant="primary" disabled={!canWrite || !q.data} loading={save.isPending} onClick={() => save.mutate()}>{adm.common.save}</AButton></>}>
      {q.isPending ? <p className="muted">{adm.common.loading}</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {LIVE_EXCEL_KEYS.map((k) => (
            <div key={k} style={long.has(k) ? { gridColumn: '1 / -1' } : undefined}>
              <FieldRow label={LIVE_EXCEL_LABELS[k]} htmlFor={`xe-${k}`} required={LIVE_EXCEL_REQUIRED.has(k)} error={errors[k]}>
                {long.has(k) ? <ATextarea id={`xe-${k}`} rows={4} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} disabled={!canWrite} />
                  : <AInput id={`xe-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} disabled={!canWrite} placeholder={k === 'ContentsStart' || k === 'ContentsEnd' || k === 'UploadDate' ? 'YYYY-MM-DD' : undefined} />}
              </FieldRow>
            </div>
          ))}
        </div>
      )}
    </DetailDrawer>
  );
}
