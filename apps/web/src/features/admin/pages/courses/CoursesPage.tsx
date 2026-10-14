import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { CourseRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, AInput, ASelect, DataTable, FilterBar, FilterField, StatusBadge, YnBadge, type Column } from '../../../../shared/ui/admin';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';

const DEFAULTS = { q: '', ctype: '', useYN: '', packageYN: '', page: 1 };
const SIZE = 20;
const YN = [{ value: '', label: adm.common.all }, { value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }];
const CTYPES = [{ value: '', label: adm.common.all }, ...Object.entries(adm.ctypes).map(([value, label]) => ({ value, label: `${value} · ${label}` }))];
const c = adm.courses.cols;

export default function CoursesPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q, ctype: p.ctype, useYN: p.useYN, packageYN: p.packageYN });
  const navigate = useNavigate();
  const query = useMemo(() => ({ q: p.q || undefined, ctype: p.ctype || undefined, useYN: p.useYN || undefined, packageYN: p.packageYN || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'courses', query], queryFn: ({ signal }) => adminApi.courses(query, signal), placeholderData: keepPreviousData });
  const columns: Column<CourseRow>[] = [
    { key: 'idx', header: c.idx, align: 'right', sortable: true },
    { key: 'lectureCode', header: c.code, sortable: true, nowrap: true, render: (r) => <b className="mono">{r.lectureCode}</b> },
    { key: 'name', header: c.name, sortable: true, render: (r) => <span>{r.name}{r.isPackage ? <StatusBadge tone="info"> {tr('패키지', 'Package')} {r.packageCodes.length}</StatusBadge> : null}</span> },
    { key: 'ctype', header: c.ctype, align: 'center', render: (r) => <span title={adm.ctypes[r.ctype ?? ''] ?? ''}>{r.ctype}</span> },
    { key: 'useYN', header: c.useYN, align: 'center', render: (r) => <YnBadge value={r.useYN} yes={tr('노출', 'Visible')} no={tr('숨김', 'Hidden')} /> },
    { key: 'hrdCode', header: c.hrd, render: (r) => r.hrdCode ?? '' },
    { key: 'category1', header: c.category, render: (r) => [r.category1, r.category2].filter(Boolean).join(' › ') },
    { key: 'contentsTime', header: c.time, align: 'right', render: (r) => r.contentsTime ?? '' },
    { key: 'chapterRows', header: c.chapters, align: 'right', render: (r) => <Link to={`/admin/courses/${encodeURIComponent(r.lectureCode)}/chapters`} onClick={(e) => e.stopPropagation()}>{r.chapterRows}</Link> },
    { key: 'enrollments', header: c.enrollments, align: 'right', sortable: true },
    { key: 'views', header: c.views, align: 'right', sortable: true },
    { key: 'regDate', header: c.regDate, nowrap: true, sortable: true, render: (r) => r.regDate ?? '' },
  ];
  const f = adm.courses.filters;
  return (
    <AdminPage title={adm.courses.title} lead={adm.courses.lead}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ q: '', ctype: '', useYN: '', packageYN: '' }); reset(); }}>
        <FilterField label={f.q} htmlFor="c-q" width={240}><AInput id="c-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={f.ctype} htmlFor="c-type" width={160}><ASelect id="c-type" value={form.ctype} onChange={(e) => setForm({ ...form, ctype: e.target.value })} options={CTYPES} /></FilterField>
        <FilterField label={f.useYN} htmlFor="c-use" width={100}><ASelect id="c-use" value={form.useYN} onChange={(e) => setForm({ ...form, useYN: e.target.value })} options={YN} /></FilterField>
        <FilterField label={f.packageYN} htmlFor="c-pkg" width={100}><ASelect id="c-pkg" value={form.packageYN} onChange={(e) => setForm({ ...form, packageYN: e.target.value })} options={YN} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => navigate(`/admin/courses/${r.idx}`)} dense />
    </AdminPage>
  );
}
