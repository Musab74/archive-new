import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpCourseTempRow } from '../../../../shared/api/endpoints/admin-courses-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ATextarea, Card, DataTable, DetailDrawer, FieldRow, type Column } from '../../../../shared/ui/admin';
import { useAdminMutation } from '../../useAdminMutation';
import { useWriteGate } from '../../GrantGate';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { CheckAllBox, Cell, ExcelListFooter, ExcelUploadCard, ListHelp, SampleRow, UploadRow, runDone, useChecks, useRegisterRun, useSelectDelete } from './courses-parity.excel';
import { listHref, menuName, useFormErrors } from './courses-parity.shared';
import formXlsx from './sample-course-form.xlsx?url';
import exampleXlsx from './sample-course-example.xlsx?url';
import { AnyGrantGate, ctypeGrants } from './courses-parity.grants';

/** course_excel_list.php columns after 체크/번호, in order: [header, CourseExcelTemp column]. */
export const COURSE_TEMP_COLUMNS: [string, string][] = [
  ['등급', 'ClassGrade'], ['과정코드', 'LectureCode'], ['패키지콘텐츠 과정코드', 'PackageLectureCode'], ['사이트노출', 'UseYN'], ['컨텐츠 경로', 'ContentsURLSelect'], ['원격훈련일련번호', 'HrdSeq'],
  ['과정분류1', 'Category1'], ['과정분류2', 'Category2'], ['과정명', 'ContentsName'], ['난이도(직급)', 'Keyword1'], ['직무분야', 'Keyword2'], ['관심분야', 'Keyword3'], ['역량', 'Keyword4'], ['차시수', 'Chapter'],
  ['교육시간', 'ContentsTime'], ['콘텐츠 시작일', 'ContentsStart'], ['콘텐츠 종료일', 'ContentsEnd'], ['콘텐츠 업로드일', 'UploadDate'], ['교강사', 'Professor'], ['수료기준', 'PassTime'], ['모바일지원', 'Mobile'],
  ['교재비', 'BookPrice'], ['과정이미지', 'PreviewImage'], ['과정소개', 'Intro'], ['교육대상', 'EduTarget'], ['교육목표', 'EduGoal'], ['교육비용 일반', 'Price'], ['교육비용 우선지원', 'Price01View'],
  ['교육비용 대규모 1000인 미만', 'Price02View'], ['교육비용 대규모 1000인 이상', 'Price03View'],
];
const DATE_KEYS = ['ContentsStart', 'ContentsEnd', 'UploadDate'] as const;

/** /admin/courses/excel?ctype=X — course_write_excel.php ({MenuName} 엑셀 등록) with the course_excel_list.php review list. */
function CourseExcelBody() {
  const [p] = useSearchState({ ctype: 'X' });
  const ctype = ['X', 'Y', 'Z', 'W'].includes(p.ctype) ? p.ctype : 'X';
  const name = menuName(ctype);
  const key = ['admin', 'course-excel-temp', ctype] as const;
  const { canWrite } = useWriteGate();
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => cp.courseTemp(ctype, signal) });
  const rows = q.data?.items ?? [];
  const ids = rows.map((r) => r.idx);
  const checks = useChecks(ids);
  const upload = useAdminMutation({ fn: (f: File) => cp.uploadCourseTemp(ctype, f), invalidate: [[...key]], success: tr('업로드 되었습니다.', 'Uploaded.') });
  const del = useSelectDelete((list) => cp.deleteCourseTemp(list), () => void q.refetch());
  const reg = useRegisterRun((idx) => cp.registerCourseTemp(idx, ctype), key);
  const [edit, setEdit] = useState<CpCourseTempRow | null>(null);
  const listTo = listHref(`courses:${ctype}`, '/admin/courses', `?ctype=${ctype}`);

  const columns: Column<CpCourseTempRow>[] = [
    { key: 'check', header: <CheckAllBox all={checks.all} empty={!rows.length} onChange={checks.toggleAll} />, align: 'center', width: 60, render: (r) => (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <input type="checkbox" aria-label={tr(`${r.no}번 선택`, `Select row ${r.no}`)} checked={checks.checked.has(r.idx)} onChange={(e) => checks.toggle(r.idx, e.target.checked)} />
        <AButton size="xs" disabled={!canWrite || reg.running} onClick={() => setEdit(r)}>{tr('수정', 'Edit')}</AButton>
      </span>
    ) },
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 50 },
    ...COURSE_TEMP_COLUMNS.map(([h, k]): Column<CpCourseTempRow> => ({
      key: k, header: h, nowrap: !['ContentsName', 'Intro', 'EduTarget', 'EduGoal'].includes(k),
      render: (r) => {
        const v = (DATE_KEYS as readonly string[]).includes(k) ? r.dates[k as (typeof DATE_KEYS)[number]] : r.values[k];
        const text: ReactNode = typeof v === 'string' && v.length > 60 ? <span title={v}>{v.slice(0, 60)}…</span> : v;
        return <Cell value={text} missing={r.missing.includes(k)} optional={r.blank.includes(k)} extra={k === 'LectureCode' ? r.duplicate : null} />;
      },
    })),
    { key: 'status', header: tr('상태', 'Status'), align: 'center', width: 60, render: (r) => reg.cell(r.idx) },
  ];
  return (
    <AdminPage title={tr(`${name} 엑셀 등록`, `${name} from Excel`)} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: tr(`${name} 컨텐츠 관리`, `${name} contents`), to: listTo }, { label: tr('엑셀 등록', 'Excel') }]}
      actions={<AButton to={listTo}>{tr('목록', 'List')}</AButton>}>
      <p style={{ color: 'var(--danger, #c00)', fontWeight: 700, margin: '0 0 8px' }}>{tr(`***이 페이지에서 등록하는 데이터는 모두 "${name}" 으로 등록이 됩니다. 다른 컨텐츠 유형으로 등록하시고 싶으시면 해당 컨텐츠 관리로 이동하셔서 업로드해주세요.`, `***Every row uploaded here is registered as "${name}". Use the matching contents menu for other types.`)}</p>
      <ExcelUploadCard>
        <SampleRow form={{ href: formXlsx, name: '컨텐츠.xlsx' }} example={{ href: exampleXlsx, name: '컨텐츠(샘플).xlsx' }} />
        <UploadRow pending={upload.isPending} onUpload={(f) => upload.mutate(f)} />
      </ExcelUploadCard>
      <Card title={`${tr('업로드한 엑셀파일', 'Uploaded rows')} (${rows.length})`}>
        <ListHelp />
        <div style={{ overflowX: 'auto' }}>
          <DataTable columns={columns} rows={q.isPending ? undefined : rows} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle={tr('업로드한 엑셀파일이 없습니다.', 'No uploaded rows.')} emptyBody=" " />
        </div>
        {q.data ? (
          <ExcelListFooter errorCount={q.data?.errorCount ?? 0} disabled={!canWrite} deleting={del.busy} registering={reg.running} registerLabel={tr('컨텐츠 등록하기', 'Register contents')}
            onDelete={() => void del.run(rows.length, [...checks.checked], checks.clear)}
            onRegister={() => void reg.run(ids, tr(`등록한 엑셀파일로 ${name} 컨텐츠 등록을 시작하시겠습니까?\n\n\n\n목록 우측 [상태]항목에서 컨텐츠 등록 진행상황을\n\n확인하실 수 있습니다.\n\n\n\n작업이 완료될 때까지 다른 페이지로 이동 또는 창을 닫지 마세요.`, `Start registering ${name} contents from the uploaded file?`), runDone('컨텐츠'))} />
        ) : null}
      </Card>
      {edit ? <CourseTempDrawer row={edit} queryKey={key} onClose={() => setEdit(null)} /> : null}
    </AdminPage>
  );
}

/** course_reg_edit.php fields (that exist on CourseExcelTemp) + the sheet-only columns, in the popup order. */
const EDIT_FIELDS: { k: string; label: string; area?: boolean; required?: boolean; readOnly?: boolean }[] = [
  { k: 'ClassGrade', label: '등급', required: true }, { k: 'LectureCode', label: '과정코드', required: true }, { k: 'UseYN', label: '사이트노출', required: true }, { k: 'ContentsURLSelect', label: '컨텐츠경로', required: true, readOnly: true },
  { k: 'HrdCode', label: 'HRD-NET 과정코드' }, { k: 'Category1', label: '과정분류1', required: true }, { k: 'Category2', label: '과정분류2', required: true }, { k: 'ContentsName', label: '과정명', required: true },
  { k: 'Keyword1', label: '난이도(직급)', required: true }, { k: 'Keyword2', label: '직무분야', required: true }, { k: 'Keyword3', label: '관심분야', required: true }, { k: 'Keyword4', label: '역량', required: true },
  { k: 'Chapter', label: '차시수', required: true }, { k: 'ContentsTime', label: '교육시간(분)', required: true }, { k: 'ContentsStart', label: '컨텐츠 유효기간 시작', required: true }, { k: 'ContentsEnd', label: '컨텐츠 유효기간 종료', required: true },
  { k: 'UploadDate', label: '컨텐츠 업로드 일자', required: true }, { k: 'Mobile', label: '모바일 지원', required: true }, { k: 'BookPrice', label: '교재비(원)' }, { k: 'PreviewImage', label: '과정 이미지' },
  { k: 'PackageLectureCode', label: '패키지콘텐츠 과정코드' }, { k: 'HrdSeq', label: '원격훈련일련번호' }, { k: 'Professor', label: '교강사' }, { k: 'PassTime', label: '수료기준' },
  { k: 'Price', label: '교육비용 일반' }, { k: 'Price01View', label: '교육비용 우선지원' }, { k: 'Price02View', label: '교육비용 대규모 1000인 미만' }, { k: 'Price03View', label: '교육비용 대규모 1000인 이상' },
  { k: 'Intro', label: '과정소개', area: true, required: true }, { k: 'EduTarget', label: '교육대상', area: true, required: true }, { k: 'EduGoal', label: '교육목표', area: true, required: true },
];

/** CourseEditSubmitOk() of course_reg_edit.php: required fields, then the numeric ones — first message. */
export function courseTempFormError(f: Record<string, string>): { field: string; message: string } | null {
  const req: [string, string][] = [
    ['ClassGrade', '등급을 입력하세요.'], ['LectureCode', '과정코드를 입력하세요.'], ['UseYN', '사이트노출을 입력하세요.'], ['ContentsURLSelect', '컨텐츠경로를 입력하세요.'], ['Category1', '과정분류1 입력하세요.'], ['Category2', '과정분류2 입력하세요.'],
    ['ContentsName', '과정명 입력하세요.'], ['Keyword1', '난이도(직급) 입력하세요.'], ['Keyword2', '직무분야 입력하세요.'], ['Keyword3', '관심분야 입력하세요.'], ['Keyword4', '역량 입력하세요.'], ['Chapter', '차시수 입력하세요.'],
    ['ContentsTime', '교육시간 입력하세요.'], ['ContentsStart', '컨텐츠 유효기간 입력하세요.'], ['ContentsEnd', '컨텐츠 유효기간 입력하세요.'], ['UploadDate', '컨텐츠 업로드일 입력하세요.'], ['Mobile', '모바일 지원 입력하세요.'],
    ['Intro', '과정소개 입력하세요.'], ['EduTarget', '교육대상 입력하세요.'], ['EduGoal', '교육목표 입력하세요.'],
  ];
  for (const [k, m] of req) if (!String(f[k] ?? '').trim()) return { field: k, message: m };
  const num: [string, string][] = [['Category1', '과정분류1은 숫자만 입력하세요.'], ['Category2', '과정분류2은 숫자만 입력하세요.'], ['Keyword1', '난이도(직급)은 숫자만 입력하세요.'], ['Keyword2', '직무분야는 숫자만 입력하세요.'], ['Chapter', '차시수는 숫자만 입력하세요.'], ['ContentsTime', '교육시간은 숫자만 입력하세요.'], ['BookPrice', '교재비는 숫자만 입력하세요.']];
  for (const [k, m] of num) { const v = String(f[k] ?? '').trim(); if (v && !/^\d+$/.test(v)) return { field: k, message: m }; }
  return null;
}

function CourseTempDrawer({ row, queryKey, onClose }: { row: CpCourseTempRow; queryKey: readonly unknown[]; onClose: () => void }) {
  const { canWrite } = useWriteGate();
  const { errors, setErrors, onError } = useFormErrors();
  const [f, setF] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const { k } of EDIT_FIELDS) o[k] = (DATE_KEYS as readonly string[]).includes(k) ? row.dates[k as (typeof DATE_KEYS)[number]] : String(row.values[k] ?? '');
    o.ContentsURLSelect = 'A'; // course_reg_edit.php: value="A" readonly
    return o;
  });
  const save = useAdminMutation({ fn: () => cp.patchCourseTemp(row.idx, f), invalidate: [[...queryKey] as string[]], success: tr('수정 되었습니다.', 'Saved.'), onSuccess: onClose, onError });
  const submit = () => {
    const e = courseTempFormError(f);
    setErrors(e ? { [e.field]: e.message } : {});
    if (e) return;
    if (window.confirm(tr('등록하시겠습니까?', 'Save?'))) save.mutate();
  };
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 } as const;
  const input = (x: (typeof EDIT_FIELDS)[number]) => (
    <FieldRow key={x.k} label={tr(x.label, x.label)} htmlFor={`ce-${x.k}`} required={x.required} error={errors[x.k]}
      help={x.k === 'Keyword3' || x.k === 'Keyword4' ? tr('idx를 쉼표로 구분해 입력합니다 (예: 83,86,88).', 'Comma-separated idx values (e.g. 83,86,88).') : (DATE_KEYS as readonly string[]).includes(x.k) ? tr('YYYYMMDD 또는 YYYY-MM-DD', 'YYYYMMDD or YYYY-MM-DD') : undefined}>
      {x.area
        ? <ATextarea id={`ce-${x.k}`} rows={5} value={f[x.k] ?? ''} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} />
        : <AInput id={`ce-${x.k}`} value={f[x.k] ?? ''} readOnly={x.readOnly} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} invalid={!!errors[x.k]} />}
    </FieldRow>
  );
  return (
    <DetailDrawer open onClose={onClose} wide title={tr('업로드한 엑셀파일 수정', 'Edit uploaded row')} subtitle={`${tr('번호', 'No.')} ${row.no}`}
      footer={<><AButton onClick={onClose}>{tr('닫  기', 'Close')}</AButton><AButton variant="primary" disabled={!canWrite} loading={save.isPending} onClick={submit}>{tr('수정 하기', 'Save')}</AButton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={grid}>{EDIT_FIELDS.filter((x) => !x.area).map(input)}</div>
        {EDIT_FIELDS.filter((x) => x.area).map(input)}
      </div>
    </DetailDrawer>
  );
}

/** 컨텐츠 엑셀 등록 (course_write_excel.php, top menu E): the ctype's menu E1 (X) / E2 (Z) / E3 (Y). */
export default function CourseExcelPage() {
  const [p] = useSearchState({ ctype: 'X' });
  return <AnyGrantGate grants={ctypeGrants(p.ctype)}><CourseExcelBody /></AnyGrantGate>;
}
