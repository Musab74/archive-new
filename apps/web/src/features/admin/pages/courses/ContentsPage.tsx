import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { ContentsRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, AInput, DataTable, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { adm } from '../../strings';

const DEFAULTS = { q: '', gubun: '', page: 1 };
const SIZE = 20;
const c = adm.courses.contents.cols;
const columns: Column<ContentsRow>[] = [
  { key: 'idx', header: c.idx, align: 'right', sortable: true },
  { key: 'gubun', header: c.gubun, align: 'center', render: (r) => r.gubun ?? '' },
  { key: 'title', header: c.title, sortable: true, render: (r) => <b>{r.title}</b> },
  { key: 'lectureTimeMin', header: c.min, align: 'right', sortable: true, render: (r) => (r.lectureTimeMin != null ? `${r.lectureTimeMin}분` : '') },
  { key: 'usedIn', header: c.usedIn, align: 'right', sortable: true },
  { key: 'size', header: c.size, render: (r) => (r.size?.width || r.size?.height ? `${r.size.width ?? '?'}×${r.size.height ?? '?'}` : '') },
  { key: 'regDate', header: c.regDate, nowrap: true, sortable: true, render: (r) => r.regDate ?? '' },
];

export default function ContentsPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q, gubun: p.gubun });
  const navigate = useNavigate();
  const query = useMemo(() => ({ q: p.q || undefined, gubun: p.gubun || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'contents', query], queryFn: ({ signal }) => adminApi.contents(query, signal), placeholderData: keepPreviousData });
  return (
    <AdminPage title={adm.courses.contents.title} lead={adm.courses.contents.lead}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ q: '', gubun: '' }); reset(); }}>
        <FilterField label={adm.courses.contents.q} htmlFor="ct-q" width={240}><AInput id="ct-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={adm.courses.contents.gubun} htmlFor="ct-g" width={100}><AInput id="ct-g" value={form.gubun} onChange={(e) => setForm({ ...form, gubun: e.target.value })} maxLength={10} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => navigate(`/admin/contents/${r.idx}`)} dense />
    </AdminPage>
  );
}
