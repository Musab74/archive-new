import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpChapterTempRow } from '../../../../shared/api/endpoints/admin-courses-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, Card, DataTable, DetailDrawer, FieldRow, type Column } from '../../../../shared/ui/admin';
import { useAdminMutation } from '../../useAdminMutation';
import { useWriteGate } from '../../GrantGate';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { CheckAllBox, Cell, ExcelListFooter, ExcelUploadCard, ListHelp, SampleRow, UploadRow, runDone, useChecks, useRegisterRun, useSelectDelete } from './courses-parity.excel';
import { listHref, menuName, useFormErrors } from './courses-parity.shared';
import formXlsx from './sample-chapter-form.xlsx?url';
import exampleXlsx from './sample-chapter-example.xlsx?url';
import { AnyGrantGate, G } from './courses-parity.grants';

const KEY = ['admin', 'chapter-excel-temp'] as const;

/** chapter_reg_edit.php ChapterEditSubmitOk(): first failing message. */
export function chapterTempFormError(f: { LectureCode: string; ChapterType: string; Sub_idx: string; OrderByNum: string }): { field: string; message: string } | null {
  if (!f.LectureCode.trim()) return { field: 'LectureCode', message: '과정코드를 입력하세요.' };
  if (!f.ChapterType.trim()) return { field: 'ChapterType', message: '유형을 입력하세요.' };
  if (!f.Sub_idx.trim()) return { field: 'Sub_idx', message: '기초차시 idx값을 입력하세요.' };
  if (!f.OrderByNum.trim()) return { field: 'OrderByNum', message: '정렬순서를 입력하세요.' };
  if (!/^\d+$/.test(f.Sub_idx.trim())) return { field: 'Sub_idx', message: '기초차시 idx값은 숫자만 입력하세요.' };
  if (!/^\d+$/.test(f.OrderByNum.trim())) return { field: 'OrderByNum', message: '정렬순서는 숫자만 입력하세요.' };
  return null;
}

/** /admin/chapters/excel?ctype=X&lectureCode= — chapter_write_excel.php ({MenuName} 차시 엑셀 등록) with chapter_excel_list.php. */
function ChapterExcelPageBody() {
  const [p] = useSearchState({ ctype: 'X', from: '' });
  const ctype = ['X', 'Y', 'Z', 'W'].includes(p.ctype) ? p.ctype : 'X';
  const name = menuName(ctype);
  const { canWrite } = useWriteGate();
  const q = useQuery({ queryKey: KEY, queryFn: ({ signal }) => cp.chapterTemp(signal) });
  const rows = q.data?.items ?? [];
  const ids = rows.map((r) => r.idx);
  const checks = useChecks(ids);
  const upload = useAdminMutation({ fn: (f: File) => cp.uploadChapterTemp(f), invalidate: [[...KEY]], success: tr('업로드 되었습니다.', 'Uploaded.') });
  const del = useSelectDelete((list) => cp.deleteChapterTemp(list), () => void q.refetch());
  const reg = useRegisterRun((idx) => cp.registerChapterTemp(idx), KEY);
  const [edit, setEdit] = useState<CpChapterTempRow | null>(null);
  const backTo = /^\/admin\/courses\/\d+$/.test(p.from) ? p.from : listHref(`courses:${ctype}`, '/admin/courses', `?ctype=${ctype}`);
  const columns: Column<CpChapterTempRow>[] = [
    { key: 'check', header: <CheckAllBox all={checks.all} empty={!rows.length} onChange={checks.toggleAll} />, align: 'center', width: 60, render: (r) => (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <input type="checkbox" aria-label={tr(`${r.no}번 선택`, `Select row ${r.no}`)} checked={checks.checked.has(r.idx)} onChange={(e) => checks.toggle(r.idx, e.target.checked)} />
        <AButton size="xs" disabled={!canWrite || reg.running} onClick={() => setEdit(r)}>{tr('수정', 'Edit')}</AButton>
      </span>
    ) },
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 50 },
    { key: 'lectureCode', header: tr('과정코드', 'Course code'), render: (r) => <Cell value={<span className="mono">{r.lectureCode}</span>} missing={r.missing.includes('LectureCode')} /> },
    { key: 'chapterType', header: tr('유형', 'Type'), render: (r) => <Cell value={r.chapterType} missing={r.missing.includes('ChapterType')} /> },
    { key: 'subIdx', header: tr('기초차시 idx값', 'Base content idx'), render: (r) => <Cell value={r.subIdx} missing={r.missing.includes('Sub_idx')} extra={r.dupSub} /> },
    { key: 'orderByNum', header: tr('정렬 순서', 'Order'), render: (r) => <Cell value={r.orderByNum} missing={r.missing.includes('OrderByNum')} extra={r.dupOrder} /> },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', width: 60, render: (r) => reg.cell(r.idx) },
  ];
  return (
    <AdminPage title={tr(`${name} 차시 엑셀 등록`, `${name} chapters from Excel`)} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: tr(`${name} 컨텐츠 관리`, `${name} contents`), to: backTo }, { label: tr('차시 엑셀 등록', 'Chapters from Excel') }]}
      actions={<AButton to={backTo}>{tr('목록', 'List')}</AButton>}>
      <ExcelUploadCard>
        <SampleRow form={{ href: formXlsx, name: '컨텐츠_하위_차시.xlsx' }} example={{ href: exampleXlsx, name: '컨텐츠_하위_차시(샘플).xlsx' }} />
        <UploadRow pending={upload.isPending} onUpload={(f) => upload.mutate(f)} />
      </ExcelUploadCard>
      <Card title={`${tr('업로드한 엑셀파일', 'Uploaded rows')} (${rows.length})`}>
        <ListHelp />
        <DataTable columns={columns} rows={q.isPending ? undefined : rows} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle={tr('업로드한 엑셀파일이 없습니다.', 'No uploaded rows.')} emptyBody=" " />
        {q.data ? (
          <ExcelListFooter errorCount={q.data?.errorCount ?? 0} disabled={!canWrite} deleting={del.busy} registering={reg.running} registerLabel={tr('차시 등록하기', 'Register chapters')}
            onDelete={() => void del.run(rows.length, [...checks.checked], checks.clear)}
            onRegister={() => void reg.run(ids, tr('등록한 엑셀파일로 차시구성 등록을 시작하시겠습니까?\n\n\n\n목록 우측 [상태]항목에서 컨텐츠 등록 진행상황을\n\n확인하실 수 있습니다.\n\n\n\n작업이 완료될 때까지 다른 페이지로 이동 또는 창을 닫지 마세요.', 'Start registering chapters from the uploaded file?'), runDone('컨텐츠'))} />
        ) : null}
      </Card>
      {edit ? <ChapterTempDrawer row={edit} onClose={() => setEdit(null)} /> : null}
    </AdminPage>
  );
}

function ChapterTempDrawer({ row, onClose }: { row: CpChapterTempRow; onClose: () => void }) {
  const { canWrite } = useWriteGate();
  const { errors, setErrors, onError } = useFormErrors();
  const [f, setF] = useState({ LectureCode: row.lectureCode, ChapterType: row.chapterType, Sub_idx: row.subIdx, OrderByNum: row.orderByNum ? String(row.orderByNum) : '' });
  const save = useAdminMutation({ fn: () => cp.patchChapterTemp(row.idx, f), invalidate: [[...KEY]], success: tr('수정 되었습니다.', 'Saved.'), onSuccess: onClose, onError });
  const submit = () => {
    const e = chapterTempFormError(f);
    setErrors(e ? { [e.field]: e.message } : {});
    if (e) return;
    if (window.confirm(tr('등록하시겠습니까?', 'Save?'))) save.mutate();
  };
  const field = (k: keyof typeof f, label: string) => <FieldRow label={label} htmlFor={`chx-${k}`} required error={errors[k]}><AInput id={`chx-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} invalid={!!errors[k]} /></FieldRow>;
  return (
    <DetailDrawer open onClose={onClose} title={tr('업로드한 엑셀파일 수정', 'Edit uploaded row')} subtitle={`${tr('번호', 'No.')} ${row.no}`}
      footer={<><AButton onClick={onClose}>{tr('닫  기', 'Close')}</AButton><AButton variant="primary" disabled={!canWrite} loading={save.isPending} onClick={submit}>{tr('수정 하기', 'Save')}</AButton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {field('LectureCode', tr('과정코드', 'Course code'))}
        {field('ChapterType', tr('유형', 'Type'))}
        {field('Sub_idx', tr('기초차시 idx값', 'Base content idx'))}
        {field('OrderByNum', tr('정렬순서', 'Order'))}
      </div>
    </DetailDrawer>
  );
}

/** 차시 엑셀 등록 (chapter_write_excel.php, top menu E): menu E1/E2/E3. */
export default function ChapterExcelPage() {
  return <AnyGrantGate grants={G.courses}><ChapterExcelPageBody /></AnyGrantGate>;
}
