import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpCourseDetail, type CpCourseRow, type CpPackageImport } from '../../../../shared/api/endpoints/admin-courses-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, Callout, Card, ConfirmDialog, DataTable, DescList, FieldRow, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { ReadButtons, parsePasted, useFormErrors, useYnOptions } from './courses-parity.shared';

const DEFAULTS = { packageYN: 'Y', col: 'ContentsName', q: '', page: 1 };
const SIZE = 20;

// ====================================================================== course_package.php

export function PackageList() {
  const [p, setP] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const navigate = useNavigate();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ packageYN: 'Y', col: p.q ? p.col : undefined, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'courses', query], queryFn: ({ signal }) => cp.courses(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const columns: Column<CpCourseRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'center', width: 50, render: (_r, i) => total - (p.page - 1) * SIZE - i },
    { key: 'lectureCode', header: tr('과정 코드', 'Course code'), align: 'center', width: 120, render: (r) => <b className="mono">{r.lectureCode}</b> },
    { key: 'name', header: tr('과정명', 'Course name'), render: (r) => <b>{r.name}</b> },
    { key: 'packageRefPad', header: tr('패키지 번호', 'Package no.'), align: 'center', width: 110, render: (r) => r.packageRefPad },
    { key: 'packageCount', header: tr('등록된 단과 강의수', 'Courses in package'), align: 'center', width: 130, render: (r) => r.packageCount },
    { key: 'useYN', header: tr('사용 여부', 'In use'), align: 'center', width: 90, render: (r) => r.useLabel },
  ];
  const newBtn = <AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => navigate('/admin/courses/new?packageYN=Y')}>{tr('신규 등록', 'New')}</AButton>;
  return (
    <AdminPage title={tr('패키지 컨텐츠 관리', 'Package contents')} lead={tr('패키지(Course.PackageYN=Y)와 포함된 단과 강의 수입니다. 행을 누르면 상세에서 단과 컨텐츠를 구성합니다.', 'Packages (Course.PackageYN=Y) and their course counts. Click a row to compose the package.')} actions={newBtn}>
      <FilterBar onSubmit={() => setP({ col: form.col, q: form.q }, true)} onReset={() => { setForm({ col: 'ContentsName', q: '' }); setP({ col: 'ContentsName', q: '' }, true); }}>
        <FilterField label={tr('검색 항목', 'Field')} htmlFor="pk-col" width={140}><ASelect id="pk-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ContentsName', label: tr('과정명', 'Course name') }, { value: 'LectureCode', label: tr('강의 코드', 'Course code') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Search')} htmlFor="pk-q" width={300}><AInput id="pk-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <p style={{ color: 'var(--danger, #c00)', fontWeight: 700, fontSize: 13, margin: '0 0 8px' }}>{tr('** 패키지 컨텐츠는 1개만 사용 가능합니다.', '** Only one package can be in use.')}</p>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => navigate(`/admin/courses/${r.idx}`)} emptyTitle={tr('등록된 패키지 컨텐츠가 없습니다.', 'No packages.')} dense />
    </AdminPage>
  );
}

// ====================================================================== course_package_read.php

type PkgCourse = CpCourseDetail['packageCourses'][number];
const PKG_PAGE = 10;

export function PackageDetail({ d, onEdit }: { d: CpCourseDetail; onEdit: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [items, setItems] = useState<PkgCourse[]>(d.packageCourses);
  useEffect(() => { setItems(d.packageCourses); }, [d.packageCourses]);
  const [pg, setPg] = useState(1);
  const dirty = JSON.stringify(items.map((i) => i.lectureCode)) !== JSON.stringify(d.packageCourses.map((i) => i.lectureCode));
  const inv = [['admin', 'course', d.idx], ['admin', 'courses']];
  const save = useAdminMutation({ fn: (codes: string[]) => cp.putPackageCodes(d.idx, codes), invalidate: inv, success: tr('처리되었습니다.', 'Saved.') });
  const [del, setDel] = useState(false);
  const remove = useAdminMutation({ fn: () => cp.deleteCourse(d.idx), invalidate: inv, success: tr('처리되었습니다.', 'Done.'), onSuccess: () => navigate('/admin/courses?packageYN=Y') });
  // 강의 검색 (package_search.php)
  const [name, setName] = useState(''); const [searched, setSearched] = useState<string | null>(null); const [pick, setPick] = useState('');
  const search = useQuery({ queryKey: ['admin', 'course-packages', 'search', searched], queryFn: ({ signal }) => cp.searchPackageCourses(searched ?? '', signal), enabled: searched !== null });
  const addPicked = () => {
    const hit = search.data?.items.find((i) => i.lectureCode === pick);
    if (!hit) { toast(tr('추가할 과정을 선택하세요.', 'Choose a course.'), { tone: 'danger' }); return; }
    if (items.some((i) => i.lectureCode === hit.lectureCode)) { toast(tr('이미 선택된 과정입니다.', 'Already in the list.'), { tone: 'danger' }); return; }
    setItems([...items, { idx: hit.idx, lectureCode: hit.lectureCode, name: hit.name, serviceType: hit.serviceType, serviceTypeLabel: hit.serviceTypeLabel, chapter: hit.chapter }]);
  };
  // 엑셀로 일괄 등록 (course_package_excel_upload.php) — pasted from the sheet
  const [paste, setPaste] = useState(''); const [result, setResult] = useState<CpPackageImport | null>(null);
  const imp = useAdminMutation({ fn: (rows: { lectureCode: string; serviceType: string; chapter: string; delete: string }[]) => cp.importPackage(d.idx, rows), invalidate: inv, onSuccess: (r) => { setResult(r); setPaste(''); } });
  const runImport = () => {
    const rows = parsePasted(paste);
    if (!rows.length || !('강의코드' in rows[0]!) || !('수강유형' in rows[0]!) || !('차시수' in rows[0]!)) { toast(tr('엑셀 양식이 올바르지 않습니다. (필수 컬럼: 강의코드 / 수강유형 / 차시수)', 'Wrong layout (required columns: 강의코드 / 수강유형 / 차시수).'), { tone: 'danger' }); return; }
    imp.mutate(rows.map((r) => ({ lectureCode: r['강의코드'] ?? '', serviceType: r['수강유형'] ?? '', chapter: r['차시수'] ?? '', delete: r['삭제'] ?? '' })));
  };
  const [exporting, setExporting] = useState(false);
  const pageRows = items.slice((pg - 1) * PKG_PAGE, pg * PKG_PAGE);
  const cols: Column<PkgCourse>[] = [
    { key: 'lectureCode', header: tr('강의 코드', 'Course code'), align: 'center', width: 110, render: (r) => <span className="mono">{r.lectureCode}</span> },
    { key: 'name', header: tr('과정명', 'Course name'), render: (r) => r.name ?? '' },
    { key: 'serviceTypeLabel', header: tr('수강 유형', 'Type'), align: 'center', width: 100, render: (r) => r.serviceTypeLabel },
    { key: 'chapter', header: tr('차시수', 'Chapters'), align: 'center', width: 100, render: (r) => tr(`${r.chapter ?? ''}차시`, `${r.chapter ?? ''}`) },
    { key: 'del', header: tr('삭제', 'Remove'), align: 'center', width: 60, render: (r) => <AButton size="xs" disabled={!canWrite} onClick={() => setItems(items.filter((x) => x.lectureCode !== r.lectureCode))}>{tr('삭제', 'Remove')}</AButton> },
  ];
  const fixed = (k: string) => k;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title={tr('패키지 컨텐츠 정보', 'Package')}>
        <DescList cols={2} items={[
          [tr('과정코드', 'Code'), <b className="mono">{d.lectureCode}</b>], [tr('HRD-NET 과정코드', 'HRD-NET code'), d.hrdCode ?? ''],
          [tr('과정명', 'Course name'), d.name], [tr('사용 여부', 'In use'), d.useLabel],
          [tr('서비스 구분', 'Service type'), fixed(tr('환급', 'Refundable'))], [tr('수강 제한', 'Daily limit'), fixed(tr('8시간 수강제한', '8 h per day'))],
          [tr('진도시간 기준', 'Progress rule'), fixed(tr('진도시간 기준 15시간(900분)이상', '≥ 15 h (900 min) of progress'))], [tr('진도체크방식', 'Progress check'), fixed(tr('시간', 'Time'))],
          [tr('모바일 지원', 'Mobile'), fixed(tr('사용', 'Yes'))], [tr('수료기준', 'Pass rule'), fixed(tr('진도율 : 15시간 이상', 'Progress ≥ 15 h'))],
          [tr('패키지 번호', 'Package no.'), d.packageRefPad], ['', ''],
        ]} />
      </Card>
      <ReadButtons left={canWrite ? <AButton variant="danger" onClick={() => setDel(true)}>{tr('컨텐츠 삭제', 'Delete')}</AButton> : null} center={canWrite ? <AButton variant="primary" onClick={onEdit}>{tr('컨텐츠 수정', 'Edit')}</AButton> : null} right={<AButton to="/admin/courses?packageYN=Y">{tr('목록', 'List')}</AButton>} />
      {canWrite ? (
        <Card title={tr('패키지 강의 검색', 'Find courses')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FieldRow label={tr('강의 검색', 'Search')} htmlFor="pk-name"><form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); setSearched(name.trim()); setPick(''); }}><AInput id="pk-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /><AButton type="submit">{tr('검색', 'Search')}</AButton></form></FieldRow>
            {searched !== null ? (
              <FieldRow label={tr('검색 결과', 'Result')}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}><ASelect aria-label={tr('검색 결과', 'Result')} value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: '', label: search.isPending ? adm.common.loading : tr('-- 과정 선택 -- (강의코드 | 과정명 | 수강유형 | 차시수)', '-- choose -- (code | name | type | chapters)') }, ...(search.data?.items ?? []).map((i) => ({ value: i.lectureCode, label: `${i.lectureCode} | ${i.name ?? ''} | ${i.serviceTypeLabel} | ${i.chapter ?? ''}차시` }))]} /></div>
                  <AButton onClick={addPicked} disabled={!pick}>{tr('추가 하기', 'Add')}</AButton>
                </div>
              </FieldRow>
            ) : null}
          </div>
        </Card>
      ) : null}
      <Card title={`${tr('패키지로 선택한 단과 컨텐츠', 'Courses in this package')} (${items.length})`} aside={<span style={{ display: 'inline-flex', gap: 6 }}>
        <AButton size="sm" loading={exporting} onClick={async () => { setExporting(true); try { await cp.downloadPackageCsv(d.idx); } catch { toast(adm.companies.actions.exportFailed, { tone: 'danger' }); } finally { setExporting(false); } }}>{tr('엑셀 출력', 'Export')}</AButton>
      </span>}>
        {dirty ? <Callout tone="warn">{tr('변경 사항이 있습니다. "저장 하기"를 눌러야 반영됩니다.', 'Unsaved changes — press "Save".')}</Callout> : null}
        <DataTable columns={cols} rows={pageRows} rowKey={(r) => r.lectureCode} page={pg} size={PKG_PAGE} total={items.length} onPageChange={setPg} dense emptyTitle={tr('선택한 단과 컨텐츠가 없습니다.', 'No courses selected.')} emptyBody=" " />
        {canWrite ? <div className="u-mt-8"><AButton variant="primary" loading={save.isPending} title={readOnlyTitle} onClick={() => { if (!items.length && !window.confirm(tr('패키지로 선택한 단과 컨텐츠가 없습니다.\n\n저장 하시겠습니까?', 'No courses selected. Save anyway?'))) return; if (items.length && !window.confirm(tr('저장 하시겠습니까?', 'Save?'))) return; save.mutate(items.map((i) => i.lectureCode)); }}>{tr('저장 하기', 'Save')}</AButton></div> : null}
      </Card>
      {canWrite ? (
        <Card title={tr('엑셀로 일괄 등록', 'Bulk update from Excel')}>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>{tr('엑셀에서 머리글 행(번호 · 강의 코드 · 과정명 · 수강 유형 · 차시수 · 삭제)을 포함해 복사한 뒤 붙여 넣으세요. "삭제" 열이 Y/1/삭제이면 빠지고, 나머지는 추가됩니다(기존 엑셀 업로드와 같은 규칙). 바로 저장됩니다.', 'Paste the sheet including the header row (번호 · 강의 코드 · 과정명 · 수강 유형 · 차시수 · 삭제). Rows with 삭제 = Y/1/삭제 are removed, others added (same rules as the Excel upload). Saved immediately.')}</p>
          <ATextarea aria-label={tr('붙여넣기', 'Paste')} rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} />
          <div className="u-mt-8"><AButton onClick={runImport} disabled={!paste.trim()} loading={imp.isPending}>{tr('엑셀로 일괄 등록', 'Apply')}</AButton></div>
          {result ? <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 8 }}>{result.summary}</pre> : null}
        </Card>
      ) : null}
      <ConfirmDialog open={del} tone="danger" title={tr('컨텐츠 삭제', 'Delete package')} body={<p>{tr('현재 컨텐츠를 삭제하시겠습니까? (Del=Y)', 'Delete this package? (Del=Y)')}</p>} loading={remove.isPending} onCancel={() => setDel(false)} onConfirm={() => remove.mutate()} />
    </div>
  );
}

// ====================================================================== course_package_write.php

export function PackageForm({ detail, onDone, onCancel }: { detail?: CpCourseDetail; onDone: (idx: number) => void; onCancel: () => void }) {
  const isNew = !detail;
  const { canWrite, readOnlyTitle } = useWriteGate();
  const { errors, setErrors, onError } = useFormErrors();
  const [f, setF] = useState({ LectureCode: detail?.lectureCode ?? '', UseYN: detail?.useYN === 'N' ? 'N' : 'Y', HrdCode: detail?.hrdCode ?? '', ContentsName: detail?.name ?? '' });
  const save = useAdminMutation({
    fn: () => (isNew ? cp.createPackage({ LectureCode: f.LectureCode, UseYN: f.UseYN as 'Y' | 'N', HrdCode: f.HrdCode, ContentsName: f.ContentsName.trim() }) : cp.patchPackage(detail!.idx, { UseYN: f.UseYN as 'Y' | 'N', HrdCode: f.HrdCode, ContentsName: f.ContentsName.trim() })),
    invalidate: [['admin', 'courses'], ['admin', 'course']], success: tr('처리되었습니다.', 'Saved.'), onSuccess: (r) => onDone(isNew ? Number((r as { idx?: number }).idx) : detail!.idx), onError,
  });
  const submit = () => {
    const e: Record<string, string> = {};
    if (isNew) {
      if (!f.LectureCode) e.LectureCode = '과정코드를 입력하세요.';
      else if (f.LectureCode.length < 4 || f.LectureCode.length > 10) e.LectureCode = '과정코드는 영문 대문자, 숫자로 4자 이상, 10자 이하로 입력하세요.';
      else if (!/^[A-Z0-9]+$/.test(f.LectureCode)) e.LectureCode = '과정코드는 영문 대문자, 숫자로 입력하세요.';
    }
    if (!f.ContentsName.trim()) e.ContentsName = '과정명을 입력하세요.';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (window.confirm(isNew ? tr('등록 하시겠습니까?', 'Register?') : tr('수정 하시겠습니까?', 'Save?'))) save.mutate();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title={tr(`패키지 컨텐츠 관리 ${isNew ? '등록' : '수정'}`, isNew ? 'New package' : 'Edit package')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('과정코드', 'Code')} htmlFor="pf-code" required error={errors.LectureCode}>{isNew ? <AInput id="pf-code" value={f.LectureCode} onChange={(e) => setF({ ...f, LectureCode: e.target.value.toUpperCase() })} maxLength={10} style={{ width: 160 }} invalid={!!errors.LectureCode} /> : <b className="mono">{f.LectureCode}</b>}</FieldRow>
          <FieldRow label={tr('사용 여부', 'In use')}><div style={{ width: 140 }}><ASelect aria-label={tr('사용 여부', 'In use')} value={f.UseYN} onChange={(e) => setF({ ...f, UseYN: e.target.value })} options={useYnOptions()} /></div></FieldRow>
          <FieldRow label={tr('HRD-NET 과정코드', 'HRD-NET code')} htmlFor="pf-hrd"><AInput id="pf-hrd" value={f.HrdCode} onChange={(e) => setF({ ...f, HrdCode: e.target.value })} maxLength={120} /></FieldRow>
          <FieldRow label={tr('과정명', 'Course name')} htmlFor="pf-name" required error={errors.ContentsName}><AInput id="pf-name" value={f.ContentsName} onChange={(e) => setF({ ...f, ContentsName: e.target.value })} maxLength={120} invalid={!!errors.ContentsName} /></FieldRow>
        </div>
      </Card>
      <Callout>{tr('패키지는 1개만 사용 가능합니다. 이미 사용 중인 패키지가 있으면 "사용"으로 저장할 수 없습니다.', 'Only one package can be in use; saving as "in use" is refused while another one is.')}</Callout>
      <ReadButtons center={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} loading={save.isPending} onClick={submit}>{isNew ? tr('등록', 'Register') : tr('수정', 'Save')}</AButton>} right={<AButton onClick={onCancel}>{tr('목록', 'List')}</AButton>} />
    </div>
  );
}

/** Wrapper used by CourseEditPage for /admin/courses/new?packageYN=Y. */
export function PackageNewPage() {
  const navigate = useNavigate();
  return (
    <AdminPage title={tr('패키지 컨텐츠 관리 등록', 'New package')} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: tr('패키지 컨텐츠 관리', 'Packages'), to: '/admin/courses?packageYN=Y' }, { label: tr('등록', 'New') }]}>
      <PackageForm onDone={(idx) => navigate(`/admin/courses/${idx}`)} onCancel={() => navigate('/admin/courses?packageYN=Y')} />
    </AdminPage>
  );
}
