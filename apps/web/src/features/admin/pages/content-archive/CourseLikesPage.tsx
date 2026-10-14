import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, type CourseLikeRow } from '../../../../shared/api/endpoints/admin-content-archive';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, AInput, ASelect, DataTable, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { GrantGate } from '../../GrantGate';
import { ExportButton, SIZE, noOf } from './shared';

const DEFAULTS = { col: 'ID', q: '', page: 1 };

/** contents_like.php (+ _excel) — 관심강의 관리, grant E6. */
export default function CourseLikesPage() {
  return <GrantGate grant="E6"><Likes /></GrantGate>;
}

function Likes() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'course-likes', query], queryFn: ({ signal }) => apiX.likes(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const columns: Column<CourseLikeRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => noOf(total, p.page, SIZE, i) },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <Link to={`/admin/members/${encodeURIComponent(r.id)}`}><b>{r.id}</b></Link> },
    { key: 'name', header: tr('이름', 'Name'), nowrap: true, render: (r) => r.name ?? '' },
    { key: 'category', header: tr('과정분류', 'Category'), render: (r) => r.category },
    { key: 'courseName', header: tr('과정명', 'Course'), render: (r) => <span title={r.lectureCode ?? ''}>{r.courseName ?? <span className="muted">{r.lectureCode}</span>}</span> },
    { key: 'regDate', header: tr('등록일', 'Added'), nowrap: true, render: (r) => (r.regDate ?? '').slice(0, 16) },
  ];
  return (
    <AdminPage title={tr('관심강의 관리', 'Favourite courses')} lead={tr('학습자가 관심강의로 담은 과정(CourseLike) 목록입니다. 아이디/이름/과정명은 기존 화면과 같이 정확히 일치하는 값으로 검색합니다.', 'Courses learners marked as favourites (CourseLike). ID / name / course name are exact-match searches like the legacy page.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'ID', q: '' }); reset(); }}
        extra={<ExportButton disabled={!list.data || total === 0} run={() => apiX.downloadLikesCsv({ col: query.col, q: query.q })} />}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="cl-col" width={130}><ASelect id="cl-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'ID', label: tr('아이디', 'User ID') }, { value: 'Name', label: tr('이름', 'Name') }, { value: 'ContentsName', label: tr('과정명', 'Course') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="cl-q" width={260}><AInput id="cl-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder={tr('정확히 일치하는 값', 'Exact value')} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('등록된 관심강의가 없습니다.', 'No favourites.')} dense />
    </AdminPage>
  );
}
