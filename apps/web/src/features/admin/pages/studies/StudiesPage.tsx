import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { StudyRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, AInput, ASelect, Bar, BoolBadge, DataTable, DateField, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm, studyTime } from '../../strings';

const DEFAULTS = { companyCode: '', lectureCode: '', id: '', q: '', passOk: '', studyEnd: '', from: '', to: '', page: 1 };
const SIZE = 20;
const YN = [{ value: '', label: adm.common.all }, { value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }];
const c = adm.studies.cols;

export const studyColumns: Column<StudyRow>[] = [
  { key: 'studySeq', header: c.seq, align: 'right', sortable: true },
  { key: 'id', header: c.id, sortable: true, nowrap: true, render: (r) => <b>{r.id}</b> },
  { key: 'name', header: c.name, sortable: true },
  { key: 'companyName', header: c.company, render: (r) => r.companyName ? <span title={r.companyCode ?? ''}>{r.companyName}</span> : (r.companyCode ?? '') },
  { key: 'courseName', header: c.course, render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
  { key: 'period', header: c.period, nowrap: true, sortable: true, sortValue: (r) => r.period.start, render: (r) => `${r.period.start} ~ ${r.period.end}` },
  { key: 'active', header: c.active, align: 'center', render: (r) => <StatusBadge tone={r.active ? 'ok' : 'neutral'} dot>{r.active ? tr('진행', 'Active') : r.studyEnd ? tr('마감', 'Closed') : tr('기간 외', 'Out of period')}</StatusBadge> },
  { key: 'seconds', header: c.time, align: 'right', sortable: true, nowrap: true, render: (r) => studyTime(r.seconds, r.formatted) },
  { key: 'percent', header: c.percent, sortable: true, width: 110, render: (r) => <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Bar value={r.percent} tone={r.over15h ? 'ok' : undefined} /><span style={{ fontSize: 12, minWidth: 34, textAlign: 'right' }}>{r.percent}%</span></div> },
  { key: 'passOk', header: c.passOk, align: 'center', sortable: true, render: (r) => <BoolBadge value={r.passOk} yes={tr('수료', 'Passed')} no="-" /> },
  { key: 'studyEnd', header: c.studyEnd, align: 'center', render: (r) => <BoolBadge value={r.studyEnd} yes={tr('마감', 'Closed')} no="-" tone="neutral" /> },
  { key: 'preDone', header: c.pre, align: 'center', render: (r) => <BoolBadge value={r.preDone} yes={tr('완료', 'Done')} no="-" /> },
  { key: 'postDone', header: c.post, align: 'center', render: (r) => <BoolBadge value={r.postDone} yes={tr('완료', 'Done')} no="-" /> },
  { key: 'lastLearning', header: c.last, nowrap: true, sortable: true, render: (r) => r.lastLearning ?? '—' },
];

export default function StudiesPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ ...p });
  const navigate = useNavigate();
  const query = useMemo(() => ({ companyCode: p.companyCode || undefined, lectureCode: p.lectureCode || undefined, id: p.id || undefined, q: p.q || undefined, passOk: p.passOk || undefined, studyEnd: p.studyEnd || undefined, from: p.from || undefined, to: p.to || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'studies', query], queryFn: ({ signal }) => adminApi.studies(query, signal), placeholderData: keepPreviousData });
  const f = adm.studies.filters;
  return (
    <AdminPage title={adm.studies.title} lead={adm.studies.lead}>
      <FilterBar onSubmit={() => setP({ ...form, page: 1 })} onReset={() => { setForm({ ...DEFAULTS }); reset(); }}>
        <FilterField label={f.companyCode} htmlFor="s-cc"><AInput id="s-cc" value={form.companyCode} onChange={(e) => setForm({ ...form, companyCode: e.target.value })} /></FilterField>
        <FilterField label={f.lectureCode} htmlFor="s-lc"><AInput id="s-lc" value={form.lectureCode} onChange={(e) => setForm({ ...form, lectureCode: e.target.value })} /></FilterField>
        <FilterField label={f.id} htmlFor="s-id"><AInput id="s-id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></FilterField>
        <FilterField label={f.q} htmlFor="s-q"><AInput id="s-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={f.passOk} htmlFor="s-po"><ASelect id="s-po" value={form.passOk} onChange={(e) => setForm({ ...form, passOk: e.target.value })} options={YN} /></FilterField>
        <FilterField label={f.studyEnd} htmlFor="s-se"><ASelect id="s-se" value={form.studyEnd} onChange={(e) => setForm({ ...form, studyEnd: e.target.value })} options={YN} /></FilterField>
        <FilterField label={f.from} htmlFor="s-from"><DateField id="s-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} /></FilterField>
        <FilterField label={f.to} htmlFor="s-to"><DateField id="s-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} min={form.from || undefined} /></FilterField>
      </FilterBar>
      <DataTable columns={studyColumns} rows={list.data?.items} rowKey={(r) => r.studySeq} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => navigate(`/admin/studies/${r.studySeq}`)} dense />
    </AdminPage>
  );
}
