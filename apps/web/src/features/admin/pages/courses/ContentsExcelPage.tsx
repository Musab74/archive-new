import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpContentsTempRow } from '../../../../shared/api/endpoints/admin-courses-parity';
import { AButton, AdminPage, AInput, ATextarea, Card, DataTable, DetailDrawer, FieldRow, type Column } from '../../../../shared/ui/admin';
import { useAdminMutation } from '../../useAdminMutation';
import { useWriteGate } from '../../GrantGate';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { CheckAllBox, Cell, ExcelListFooter, ExcelUploadCard, ListHelp, SampleRow, UploadRow, runConfirm, runDone, useChecks, useRegisterRun, useSelectDelete } from './courses-parity.excel';
import { listHref, useFormErrors } from './courses-parity.shared';
import formXlsx from './sample-contents-form.xlsx?url';
import exampleXlsx from './sample-contents-example.xlsx?url';
import { AnyGrantGate, G } from './courses-parity.grants';

const KEY = ['admin', 'contents-excel-temp'] as const;
const nl = (s: string) => <span style={{ whiteSpace: 'pre-wrap' }}>{s}</span>;

/** /admin/contents/excel — contents_excel.php (기초차시 엑셀 등록) with the contents_excel_list.php review list. */
function ContentsExcelPageBody() {
  const { canWrite } = useWriteGate();
  const { toast } = useToast();
  const q = useQuery({ queryKey: KEY, queryFn: ({ signal }) => cp.contentsTemp(signal) });
  const rows = q.data?.items ?? [];
  const ids = rows.map((r) => r.idx);
  const checks = useChecks(ids);
  const upload = useAdminMutation({ fn: (f: File) => cp.uploadContentsTemp(f), invalidate: [[...KEY]], success: tr('업로드 되었습니다.', 'Uploaded.') });
  const del = useSelectDelete((list) => cp.deleteContentsTemp(list), () => void q.refetch());
  const reg = useRegisterRun((idx) => cp.registerContentsTemp(idx), KEY);
  const [edit, setEdit] = useState<CpContentsTempRow | null>(null);
  const m = (r: CpContentsTempRow, k: string) => r.missing.includes(k);
  const columns: Column<CpContentsTempRow>[] = [
    { key: 'check', header: <CheckAllBox all={checks.all} empty={!rows.length} onChange={checks.toggleAll} />, align: 'center', width: 60, render: (r) => (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <input type="checkbox" aria-label={tr(`${r.no}번 선택`, `Select row ${r.no}`)} checked={checks.checked.has(r.idx)} onChange={(e) => checks.toggle(r.idx, e.target.checked)} />
        <AButton size="xs" disabled={!canWrite || reg.running} onClick={() => setEdit(r)}>{tr('수정', 'Edit')}</AButton>
      </span>
    ) },
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 50 },
    { key: 'gubun', header: tr('차시 구분', '차시 구분'), render: (r) => <Cell value={r.gubun} missing={m(r, 'Gubun')} /> },
    { key: 'title', header: tr('차시명', 'Title'), render: (r) => <Cell value={r.title} missing={m(r, 'ContentsTitle')} /> },
    { key: 'lectureTime', header: tr('수강시간', 'Minutes'), align: 'center', render: (r) => <Cell value={r.lectureTime} missing={m(r, 'LectureTime')} /> },
    { key: 'goal', header: tr('차시 목표', 'Goals'), render: (r) => <Cell value={nl(r.goal)} missing={m(r, 'Expl01')} /> },
    { key: 'trainingContents', header: tr('훈련 내용', 'Training content'), render: (r) => <Cell value={nl(r.trainingContents)} missing={m(r, 'Expl02')} /> },
    { key: 'activities', header: tr('학습 활동', 'Activities'), render: (r) => <Cell value={nl(r.activities)} missing={m(r, 'Expl03')} /> },
    { key: 'contentsType', header: tr('콘텐츠 유형', 'Type'), align: 'center' },
    { key: 'pages', header: tr('차시페이지수', 'Pages'), align: 'center' },
    { key: 'mobilePages', header: tr('모바일페이지수', 'Mobile pages'), align: 'center' },
    { key: 'url', header: tr('콘텐츠 경로', 'Content path'), render: (r) => <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{r.url}</span> },
    { key: 'mobileUrl', header: tr('모바일 경로', 'Mobile path'), render: (r) => <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{r.mobileUrl}</span> },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', width: 60, render: (r) => reg.cell(r.idx) },
  ];
  return (
    <AdminPage title={tr('기초차시 엑셀 등록', 'Base contents from Excel')} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: tr('기초차시 관리', 'Base contents'), to: listHref('contents', '/admin/contents') }, { label: tr('엑셀 등록', 'Excel') }]}
      actions={<AButton to={listHref('contents', '/admin/contents')}>{tr('목록', 'List')}</AButton>}>
      <ExcelUploadCard>
        <SampleRow form={{ href: formXlsx, name: '기초차시.xlsx' }} example={{ href: exampleXlsx, name: '기초차시(샘플).xlsx' }} />
        <UploadRow pending={upload.isPending} onUpload={(f) => upload.mutate(f)} />
      </ExcelUploadCard>
      <Card title={`${tr('업로드한 엑셀파일', 'Uploaded rows')} (${rows.length})`}>
        <ListHelp />
        <DataTable columns={columns} rows={q.isPending ? undefined : rows} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle={tr('업로드한 엑셀파일이 없습니다.', 'No uploaded rows.')} emptyBody=" " />
        {q.data ? (
          <ExcelListFooter errorCount={q.data?.errorCount ?? 0} disabled={!canWrite} deleting={del.busy} registering={reg.running} registerLabel={tr('차시 등록하기', 'Register base contents')}
            onDelete={() => void del.run(rows.length, [...checks.checked], checks.clear)}
            onRegister={() => { if ((q.data?.errorCount ?? 0) > 0) { toast(tr('오류 항목을 먼저 수정하세요.', 'Fix the errors first.'), { tone: 'danger' }); return; } void reg.run(ids, runConfirm('기초차시'), runDone('기초차시')); }} />
        ) : null}
      </Card>
      {edit ? <ContentsTempDrawer row={edit} onClose={() => setEdit(null)} /> : null}
    </AdminPage>
  );
}

/** contents_reg_edit.php — 업로드한 엑셀파일 수정. */
function ContentsTempDrawer({ row, onClose }: { row: CpContentsTempRow; onClose: () => void }) {
  const { canWrite } = useWriteGate();
  const { errors, setErrors, onError } = useFormErrors();
  const [f, setF] = useState({ Gubun: row.gubun, ContentsTitle: row.title, LectureTime: row.lectureTime ? String(row.lectureTime) : '', Expl01: row.goal, Expl02: row.trainingContents, Expl03: row.activities });
  const save = useAdminMutation({ fn: () => cp.patchContentsTemp(row.idx, f), invalidate: [[...KEY]], success: tr('수정 되었습니다.', 'Saved.'), onSuccess: onClose, onError });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.Gubun.trim()) e.Gubun = '차시구분을 입력하세요.';
    else if (!f.ContentsTitle.trim()) e.ContentsTitle = '차시명을 입력하세요.';
    else if (!f.LectureTime.trim()) e.LectureTime = '수강시간을 입력하세요.';
    else if (!/^\d+$/.test(f.LectureTime.trim())) e.LectureTime = '수강시간은 숫자만 입력하세요.';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (window.confirm(tr('등록하시겠습니까?', 'Save?'))) save.mutate();
  };
  return (
    <DetailDrawer open onClose={onClose} wide title={tr('업로드한 엑셀파일 수정', 'Edit uploaded row')} subtitle={`${tr('번호', 'No.')} ${row.no}`}
      footer={<><AButton onClick={onClose}>{tr('닫기', 'Close')}</AButton><AButton variant="primary" disabled={!canWrite} loading={save.isPending} onClick={submit}>{tr('수정 하기', 'Save')}</AButton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FieldRow label={tr('차시 구분', '차시 구분')} htmlFor="ct-g" required error={errors.Gubun}><AInput id="ct-g" value={f.Gubun} onChange={(e) => setF({ ...f, Gubun: e.target.value })} maxLength={250} /></FieldRow>
        <FieldRow label={tr('차시명', 'Title')} htmlFor="ct-t" required error={errors.ContentsTitle}><AInput id="ct-t" value={f.ContentsTitle} onChange={(e) => setF({ ...f, ContentsTitle: e.target.value })} maxLength={250} /></FieldRow>
        <FieldRow label={tr('수강시간', 'Minutes')} htmlFor="ct-l" required error={errors.LectureTime}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><AInput id="ct-l" value={f.LectureTime} onChange={(e) => setF({ ...f, LectureTime: e.target.value })} style={{ width: 90 }} />{tr('분', 'min')}</span></FieldRow>
        <FieldRow label={tr('차시 목표', 'Goals')} htmlFor="ct-e1"><ATextarea id="ct-e1" rows={5} value={f.Expl01} onChange={(e) => setF({ ...f, Expl01: e.target.value })} /></FieldRow>
        <FieldRow label={tr('훈련 내용', 'Training content')} htmlFor="ct-e2"><ATextarea id="ct-e2" rows={5} value={f.Expl02} onChange={(e) => setF({ ...f, Expl02: e.target.value })} /></FieldRow>
        <FieldRow label={tr('학습 활동', 'Activities')} htmlFor="ct-e3"><ATextarea id="ct-e3" rows={5} value={f.Expl03} onChange={(e) => setF({ ...f, Expl03: e.target.value })} /></FieldRow>
      </div>
    </DetailDrawer>
  );
}

/** 기초차시 엑셀 등록 (contents_excel.php): menu D2, like the API. */
export default function ContentsExcelPage() {
  return <AnyGrantGate grants={G.contents}><ContentsExcelPageBody /></AnyGrantGate>;
}
