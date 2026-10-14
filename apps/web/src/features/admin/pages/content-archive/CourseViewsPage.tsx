import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, type CourseViewRow } from '../../../../shared/api/endpoints/admin-content-archive';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, AInput, ASelect, DataTable, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { GrantGate } from '../../GrantGate';
import { adm } from '../../strings';
import { ExportButton, SIZE, noOf } from './shared';

const DEFAULTS = { category1: '', category2: '', keyword2: '', col: 'ContentsName', q: '', sort: 'asc', page: 1 };

/** contents_count.php (+ _excel) — 과정조회 관리 (Course.cnt), grant E6. */
export default function CourseViewsPage() {
  return <GrantGate grant="E6"><Views /></GrantGate>;
}

function Views() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ category1: p.category1, category2: p.category2, keyword2: p.keyword2, col: p.col, q: p.q });
  const query = useMemo(() => ({ category1: p.category1 || undefined, category2: p.category1 && p.category2 ? p.category2 : undefined, keyword2: p.keyword2 || undefined, col: p.col, q: p.q || undefined, sort: p.sort, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'course-views', query], queryFn: ({ signal }) => apiX.views(query, signal), placeholderData: keepPreviousData });
  const opts = useQuery({ queryKey: ['admin', 'course-views', 'options'], queryFn: ({ signal }) => apiX.viewOptions(signal), staleTime: 10 * 60_000 });
  const total = list.data?.total ?? 0;
  const cat1 = useMemo(() => [{ value: '', label: tr('-- 대분류 선택 --', '-- main category --') }, ...(opts.data?.category1 ?? []).map((c) => ({ value: String(c.idx), label: c.name }))], [opts.data]);
  const cat2 = useMemo(() => [{ value: '', label: tr('-- 소분류 선택 --', '-- sub category --') }, ...(opts.data?.category2 ?? []).filter((c) => String(c.parent) === form.category1).map((c) => ({ value: String(c.idx), label: c.name }))], [opts.data, form.category1]);
  const kw2 = useMemo(() => [{ value: '', label: adm.common.all }, ...(opts.data?.keyword2 ?? []).map((k) => ({ value: String(k.idx), label: k.name }))], [opts.data]);
  const columns: Column<CourseViewRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => noOf(total, p.page, SIZE, i) },
    { key: 'category', header: tr('과정분류', 'Category'), render: (r) => r.category },
    { key: 'keyword2Name', header: tr('직무분야', 'Job field'), nowrap: true, render: (r) => r.keyword2Name ?? '' },
    { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Link to={`/admin/courses/${r.idx}`} title={r.lectureCode ?? ''}>{r.courseName ?? r.lectureCode}</Link>{r.del === 'Y' ? <StatusBadge tone="danger">{tr('삭제', 'deleted')}</StatusBadge> : r.useYN === 'N' ? <StatusBadge tone="warn">{tr('비노출', 'hidden')}</StatusBadge> : null}</span> },
    { key: 'count', header: tr('조회수', 'Views'), align: 'right', nowrap: true, render: (r) => r.count.toLocaleString() },
  ];
  return (
    <AdminPage title={tr('과정조회 관리', 'Course views')} lead={tr('과정별 조회수(Course.cnt)입니다. 기존 화면과 같이 삭제·비노출 과정도 포함되며 조회수 오름차순이 기본입니다.', 'Per-course view counts (Course.cnt). Like the legacy page it includes deleted/hidden courses; ascending by views by default.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ category1: '', category2: '', keyword2: '', col: 'ContentsName', q: '' }); reset(); }}
        extra={<><ASelect aria-label={tr('정렬', 'Sort')} value={p.sort} onChange={(e) => setP({ sort: e.target.value }, true)} options={[{ value: 'asc', label: tr('조회수 적은순', 'Fewest views first') }, { value: 'desc', label: tr('조회수 많은순', 'Most views first') }]} /><ExportButton disabled={!list.data || total === 0} run={() => apiX.downloadViewsCsv({ category1: query.category1, category2: query.category2, keyword2: query.keyword2, col: query.col, q: query.q, sort: query.sort })} /></>}>
        <FilterField label={tr('과정 대분류', 'Main category')} htmlFor="cv-c1" width={200}><ASelect id="cv-c1" value={form.category1} onChange={(e) => setForm({ ...form, category1: e.target.value, category2: '' })} options={cat1} loading={opts.isPending} /></FilterField>
        <FilterField label={tr('과정 소분류', 'Sub category')} htmlFor="cv-c2" width={200}><ASelect id="cv-c2" value={form.category2} onChange={(e) => setForm({ ...form, category2: e.target.value })} options={cat2} disabled={!form.category1} /></FilterField>
        <FilterField label={tr('직무분야', 'Job field')} htmlFor="cv-kw" width={180}><ASelect id="cv-kw" value={form.keyword2} onChange={(e) => setForm({ ...form, keyword2: e.target.value })} options={kw2} loading={opts.isPending} /></FilterField>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="cv-col" width={130}><ASelect id="cv-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ContentsName', label: tr('과정명', 'Course') }, { value: 'Cnt', label: tr('조회수', 'Views') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="cv-q" width={220}><AInput id="cv-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} inputMode={form.col === 'Cnt' ? 'numeric' : undefined} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('등록된 목록이 없습니다.', 'No courses.')} dense />
    </AdminPage>
  );
}
