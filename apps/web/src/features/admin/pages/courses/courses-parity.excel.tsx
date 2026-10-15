import { useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAppError } from '../../../../shared/api/client';
import type { CpRegResult } from '../../../../shared/api/endpoints/admin-courses-parity';
import { AButton, Card, FieldRow, adminStyles } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';

/**
 * Shared parts of the three "엑셀로 등록" screens (contents_excel.php, course_write_excel.php, chapter_write_excel.php):
 * 등록 샘플 downloads + legend, 파일 등록 + 업로드 하기, 미입력 marks, 선택 / 전체선택, and the row-by-row 등록 run with 상태.
 */

/** Plain download anchor styled like an AButton (sm). */
export const btnCls = `${adminStyles.btn ?? ''} ${adminStyles.btnSm ?? ''}`;

/** "등록 샘플" row: 양식 다운로드 / 샘플 다운로드 + 필수(노랑) / 선택(파랑) legend. */
export function SampleRow({ form, example }: { form: { href: string; name: string }; example: { href: string; name: string } }) {
  const chip = (bg: string, border: string, text: string) => <span style={{ display: 'inline-block', padding: '2px 10px', background: bg, color: '#000', fontWeight: 700, border: `1px solid ${border}`, marginRight: 6 }}>{text}</span>;
  return (
    <FieldRow label={tr('등록 샘플', 'Templates')}>
      <div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a className={btnCls} href={form.href} download={form.name}>{tr('양식 다운로드', 'Download form')}</a>
          <a className={btnCls} href={example.href} download={example.name}>{tr('샘플 다운로드', 'Download sample')}</a>
        </div>
        <div style={{ marginTop: 10, lineHeight: 1.8, fontSize: 13 }}>
          {chip('#FFFF00', '#E6C200', tr('필수', 'Required'))}<span className="muted">{tr('노란 헤더 컬럼은 반드시 입력', 'Yellow header columns are required')}</span>
          &nbsp;&nbsp;
          {chip('#9BC2E6', '#5B9BD5', tr('선택', 'Optional'))}<span className="muted">{tr('파란 헤더 컬럼은 선택 입력', 'Blue header columns are optional')}</span>
        </div>
      </div>
    </FieldRow>
  );
}

/** "파일 등록" + "업로드 하기" (UploadSubmitOk: file required, confirm). */
export function UploadRow({ onUpload, pending, accept = '.xlsx,.xls,.csv' }: { onUpload: (file: File) => void; pending: boolean; accept?: string }) {
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const ref = useRef<HTMLInputElement>(null);
  const submit = () => {
    const file = ref.current?.files?.[0];
    if (!file) { toast(tr('엑셀 파일을 선택하세요.', 'Choose an Excel file.'), { tone: 'danger' }); ref.current?.focus(); return; }
    if (!window.confirm(tr('업로드 하시겠습니까?', 'Upload?'))) return;
    onUpload(file);
    if (ref.current) ref.current.value = '';
  };
  return (
    <FieldRow label={tr('파일 등록', 'File')} htmlFor="xl-file" help={tr('.xlsx / .xls(Excel 97-2003) 파일 첫 시트의 2행부터 읽습니다.', 'Reads the first sheet of an .xlsx / .xls (Excel 97-2003) file from row 2.')}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input id="xl-file" ref={ref} type="file" accept={accept} aria-label={tr('엑셀 파일', 'Excel file')} disabled={!canWrite} />
        {pending ? <strong>{tr('처리중입니다. 잠시만 기다려 주세요...', 'Processing, please wait...')}</strong> : <AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={submit}>{tr('업로드 하기', 'Upload')}</AButton>}
      </div>
    </FieldRow>
  );
}

export function ExcelUploadCard({ children }: { children: ReactNode }) {
  return <Card><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div></Card>;
}

/** Cell value or the PHP "미입력" mark (red = required, blue = optional). */
export function Cell({ value, missing, optional, extra }: { value: ReactNode; missing?: boolean; optional?: boolean; extra?: ReactNode }) {
  if (missing || optional) return <span style={{ color: missing ? 'var(--danger, #c00)' : 'var(--info, #1d4ed8)' }}>{tr('미입력', 'missing')}</span>;
  return <>{value}{extra ? <> <span style={{ color: 'var(--danger, #c00)' }}>{extra}</span></> : null}</>;
}

export function ListHelp() {
  return (
    <p className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>
      {tr('* 붉은색으로 표시된 항목은 오류가 예상되는 항목입니다.', '* Items in red are expected to fail.')}<br />
      {tr('* 상태 설명 : 대기(엑셀을 업로드 후 등록 대기 상태), 처리중(DB 입력 처리중), 등록(정상적으로 등록 완료), 오류(DB입력 오류)', '* Status: 대기 (uploaded, waiting), 처리중 (inserting), 등록 (done), 오류 (failed)')}
    </p>
  );
}

/** Checked rows + the header "전체 선택" box (CheckAll / CheckedDelete). */
export function useChecks(ids: number[]) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const live = new Set([...checked].filter((i) => ids.includes(i)));
  const all = ids.length > 0 && live.size === ids.length;
  const toggle = (id: number, on: boolean) => setChecked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const toggleAll = (on: boolean) => setChecked(on ? new Set(ids) : new Set());
  return { checked: live, all, toggle, toggleAll, clear: () => setChecked(new Set()) };
}

export function CheckAllBox({ all, onChange, empty }: { all: boolean; onChange: (on: boolean) => void; empty: boolean }) {
  const { toast } = useToast();
  return <input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={all} onChange={(e) => { if (empty) { toast(tr('등록된 엑셀파일이 없습니다.', 'No uploaded rows.'), { tone: 'danger' }); return; } onChange(e.target.checked); }} />;
}

/** CheckedDelete(): nothing uploaded / nothing checked alerts, confirm, then the delete call. */
export function useSelectDelete(del: (ids: number[]) => Promise<unknown>, invalidate: () => void) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (total: number, ids: number[], clear: () => void) => {
    if (total === 0) { toast(tr('등록된 엑셀파일이 없습니다.', 'No uploaded rows.'), { tone: 'danger' }); return; }
    if (!ids.length) { toast(tr('삭제하려는 항목을 선택하세요.', 'Select rows to delete.'), { tone: 'danger' }); return; }
    if (!window.confirm(tr('선택한 항목을 삭제하시겠습니까?', 'Delete the selected rows?'))) return;
    setBusy(true);
    try { await del(ids); toast(tr('삭제되었습니다.', 'Deleted.'), { tone: 'ok' }); clear(); invalidate(); }
    catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); }
    finally { setBusy(false); }
  };
  return { run, busy };
}

export type RunState = '대기' | '처리중' | '등록' | '오류';

/**
 * ContentsRegistSubmitOk / CourseRegistSubmitOk / ChapterRegistSubmitOk: confirm, then register every listed row in order,
 * one request at a time, showing 처리중 → 등록 / 오류 in 상태; at the end a notice and the list reloads (rows left are 오류).
 */
export function useRegisterRun(register: (idx: number) => Promise<CpRegResult>, queryKey: readonly unknown[]) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<Record<number, { state: RunState; message?: string }>>({});
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const run = async (ids: number[], confirmText: string, doneText: string) => {
    if (!ids.length) { toast(tr('등록된 엑셀파일이 없습니다.', 'No uploaded rows.'), { tone: 'danger' }); return; }
    if (!window.confirm(confirmText)) return;
    setRunning(true); setFinished(false); setStatus({});
    for (const idx of ids) {
      setStatus((s) => ({ ...s, [idx]: { state: '처리중' } }));
      let r: { state: RunState; message?: string };
      try { const res = await register(idx); r = res.status === 'B' ? { state: '등록' } : { state: '오류', message: res.message }; }
      catch (err) { r = { state: '오류', message: isAppError(err) ? err.message : adm.common.failed }; }
      setStatus((s) => ({ ...s, [idx]: r }));
    }
    setRunning(false); setFinished(true);
    toast(doneText, { tone: 'ok' });
    await qc.invalidateQueries({ queryKey: [...queryKey] });
  };
  /** 상태 cell: 대기 before a run; after it, rows still listed failed (the PHP reloads with str=C → 오류). */
  const cell = (idx: number) => {
    const st = status[idx] ?? { state: (finished ? '오류' : '대기') as RunState };
    const color = st.state === '등록' ? 'var(--info, #1d4ed8)' : st.state === '오류' ? 'var(--danger, #c00)' : undefined;
    return <span title={st.message} style={{ color, fontWeight: st.state === '대기' ? 400 : 700 }}>{st.state}</span>;
  };
  return { run, running, cell };
}

/** Bottom row: 선택항목 삭제 · (오류 건수 / 등록하기). */
export function ExcelListFooter({ errorCount, onDelete, deleting, onRegister, registering, registerLabel, disabled }: { errorCount: number; onDelete: () => void; deleting: boolean; onRegister: () => void; registering: boolean; registerLabel: string; disabled: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
      <AButton onClick={onDelete} loading={deleting} disabled={disabled || registering}>{tr('선택항목 삭제', 'Delete selected')}</AButton>
      {errorCount > 0
        ? <b style={{ color: 'var(--danger, #c00)' }}>{tr(`오류 건수가 [ ${errorCount.toLocaleString('ko-KR')} ]건이 있습니다.`, `There are [ ${errorCount} ] errors.`)}</b>
        : <AButton variant="primary" onClick={onRegister} loading={registering} disabled={disabled}>{registerLabel}</AButton>}
      <span />
    </div>
  );
}

export const runConfirm = (what: string) => tr(
  `등록한 엑셀파일로 ${what} 등록을 시작하시겠습니까?\n\n\n\n목록 우측 [상태]항목에서 ${what === '기초차시' ? '기초차시' : '컨텐츠'} 등록 진행상황을\n\n확인하실 수 있습니다.\n\n\n\n작업이 완료될 때까지 다른 페이지로 이동 또는 창을 닫지 마세요.`,
  `Start registering ${what} from the uploaded file? Progress shows in the [상태] column. Do not leave this page until it finishes.`,
);
export const runDone = (what: string) => tr(
  `${what} 등록 처리가 완료되었습니다. 등록 중 오류가 발생한 부분은 갱신된 목록에서 확인이 가능합니다.`,
  `${what} registration finished. Rows that failed stay in the refreshed list.`,
);
