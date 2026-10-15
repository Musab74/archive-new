import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminCoursesParityApi as cp, type CpCourseRow } from '../../../../shared/api/endpoints/admin-courses-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, DataTable, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { menuName } from './courses-parity.shared';
import { PackageList } from './courses-parity.package';

const DEFAULTS = { ctype: '', packageYN: '', col: 'ContentsName', q: '', page: 1 };
const SIZE = 20;

/** course.php (이러닝/마이크로닝/숏폼 컨텐츠 관리) and, with ?packageYN=Y, course_package.php (패키지컨텐츠관리). */
export default function CoursesPage() {
  const [p] = useSearchState(DEFAULTS);
  return p.packageYN === 'Y' ? <PackageList /> : <CourseList />;
}

function CourseList() {
  const [p, setP] = useSearchState(DEFAULTS);
  const ctype = p.ctype || 'X';
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [exporting, setExporting] = useState(false);
  const query = useMemo(() => ({ ctype, packageYN: 'N', col: p.q ? p.col : undefined, q: p.q || undefined, page: p.page, size: SIZE }), [p, ctype]);
  const list = useQuery({ queryKey: ['admin', 'courses', query], queryFn: ({ signal }) => cp.courses(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const columns: Column<CpCourseRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 50, render: (_r, i) => total - (p.page - 1) * SIZE - i },
    { key: 'lectureCode', header: <>{tr('등급', 'Grade')}<br />{tr('과정 코드', 'Course code')}</>, nowrap: true, render: (r) => <>{r.classGradeLabel}<br /><b className="mono">{r.lectureCode}</b></> },
    { key: 'name', header: <>{tr('과정분류', 'Category')}<br />{tr('과정명', 'Course name')}</>, render: (r) => <><span className="muted">{r.categoryName1 ?? ''}&gt;{r.categoryName2 ?? ''}</span><br /><b>{r.name}</b></> },
    { key: 'chapter', header: tr('차시', 'Chapters'), align: 'center', render: (r) => r.chapterLabel },
    { key: 'contentsTime', header: tr('교육시간', 'Duration'), align: 'center', render: (r) => tr(`${r.contentsTime ?? ''} 분`, `${r.contentsTime ?? ''} min`) },
    { key: 'packageLectureCode', header: tr('패키지콘텐츠 과정코드', 'Package course codes'), render: (r) => <span className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{r.packageLectureCode ?? ''}</span> },
    { key: 'hrdSeq', header: tr('원격훈련 일련번호', 'Remote-training serial'), align: 'center', render: (r) => r.hrdSeq ?? '' },
    { key: 'contentsStart', header: <>{tr('제작연도', 'Produced')}<br />{tr('업로드', 'Uploaded')}</>, nowrap: true, align: 'center', render: (r) => <>{r.contentsStart}<br />{r.uploadDate}</> },
    { key: 'mobile', header: tr('모바일', 'Mobile'), align: 'center', render: (r) => r.mobileLabel },
    { key: 'useYN', header: <>{tr('사이트', 'Site')}<br />{tr('노출', 'visible')}</>, align: 'center', render: (r) => r.useLabel },
  ];
  const download = async () => {
    if (!window.confirm(tr('현재 검색조건으로 검색된 결과를 엑셀로 출력하시겠습니까?', 'Export the current search result?'))) return;
    setExporting(true);
    try { await cp.downloadCoursesCsv({ ctype, col: p.q ? p.col : undefined, q: p.q || undefined }); } catch { toast(adm.companies.actions.exportFailed, { tone: 'danger' }); } finally { setExporting(false); }
  };
  return (
    <AdminPage title={tr(`${menuName(ctype)} 컨텐츠 관리`, `${menuName(ctype)} contents`)} lead={tr('과정명(포함) 또는 강의 코드(일치)로 검색합니다. 행을 누르면 상세(차시 구성 포함)로 이동합니다.', 'Search by course name (contains) or code (exact). Click a row for details and chapters.')}
      actions={<>
        <AButton onClick={() => void download()} loading={exporting}>{tr('검색 항목 엑셀 출력', 'Export search result')}</AButton>
        <AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => navigate(`/admin/courses/new?ctype=${ctype}`)}>{tr('신규 등록', 'New')}</AButton>
      </>}>
      <FilterBar onSubmit={() => setP({ col: form.col, q: form.q }, true)} onReset={() => { setForm({ col: 'ContentsName', q: '' }); setP({ col: 'ContentsName', q: '' }, true); }}>
        <FilterField label={tr('검색 항목', 'Field')} htmlFor="c-col" width={140}><ASelect id="c-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ContentsName', label: tr('과정명', 'Course name') }, { value: 'LectureCode', label: tr('강의 코드', 'Course code') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Search')} htmlFor="c-q" width={300}><AInput id="c-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => navigate(`/admin/courses/${r.idx}`)} emptyTitle={tr('등록된 컨텐츠가 없습니다.', 'No contents registered.')} dense />
      <Callout className="u-mt-8">{tr('"엑셀로 등록"(엑셀 파일 업로드 → 임시표 검수 → 일괄 등록)은 아직 기존 사이트에서 진행합니다.', '"Register from Excel" (upload → temp-table review → bulk insert) still runs on the previous site.')}</Callout>
    </AdminPage>
  );
}
