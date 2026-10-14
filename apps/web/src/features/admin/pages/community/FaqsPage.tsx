import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { AdminFaqRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, ACheckbox, AdminPage, AInput, ATextarea, ConfirmDialog, DataTable, DetailDrawer, FieldRow, FilterBar, FilterField, YnBadge, type Column } from '../../../../shared/ui/admin';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';

const DEFAULTS = { q: '', category: '', page: 1 };
const SIZE = 20;
interface Form { Category: string; Title: string; Content: string; UseYN: boolean; OrderByNum: string }
const EMPTY: Form = { Category: '', Title: '', Content: '', UseYN: true, OrderByNum: '0' };

export default function FaqsPage() {
  const f = adm.community.faqs;
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q, category: p.category });
  const query = useMemo(() => ({ q: p.q || undefined, category: p.category || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'faqs', query], queryFn: ({ signal }) => adminApi.faqs(query, signal), placeholderData: keepPreviousData });
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Form>(EMPTY);
  const [del, setDel] = useState<AdminFaqRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'faq', editing], queryFn: ({ signal }) => adminApi.faq(editing as number, signal), enabled: typeof editing === 'number' });
  useEffect(() => { if (editing === 'new') setDraft(EMPTY); else if (detail.data) setDraft({ Category: detail.data.category ?? '', Title: detail.data.title, Content: detail.data.content ?? '', UseYN: detail.data.useYN === 'Y', OrderByNum: String(detail.data.order) }); }, [editing, detail.data]);
  const toBody = (b: Form) => ({ Category: b.Category.trim(), Title: b.Title.trim(), Content: b.Content || null, UseYN: b.UseYN ? 'Y' : 'N', OrderByNum: Number(b.OrderByNum) || 0 });
  const inv = [['admin', 'faqs'], ['support']];
  const create = useAdminMutation({ fn: (b: Form) => adminApi.createFaq(toBody(b)), invalidate: inv, success: adm.common.created, onSuccess: () => setEditing(null) });
  const update = useAdminMutation({ fn: ({ idx, b }: { idx: number; b: Form }) => adminApi.updateFaq(idx, toBody(b)), invalidate: [...inv, ['admin', 'faq']], success: adm.common.saved, onSuccess: () => setEditing(null) });
  const remove = useAdminMutation({ fn: (idx: number) => adminApi.deleteFaq(idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => setDel(null) });
  const columns: Column<AdminFaqRow>[] = [
    { key: 'order', header: f.cols.order, align: 'right', sortable: true },
    { key: 'idx', header: f.cols.idx, align: 'right', sortable: true },
    { key: 'category', header: f.cols.category, sortable: true, render: (r) => r.category ?? '' },
    { key: 'title', header: f.cols.title, sortable: true, render: (r) => <b>{r.title}</b> },
    { key: 'useYN', header: f.cols.useYN, align: 'center', render: (r) => <YnBadge value={r.useYN} yes={tr('노출', 'Visible')} no={tr('숨김', 'Hidden')} /> },
    { key: 'regDate', header: f.cols.regDate, nowrap: true, sortable: true, render: (r) => r.regDate ?? '' },
    { key: '_act', header: '', width: 120, render: (r) => <span style={{ display: 'inline-flex', gap: 4 }}><AButton size="xs" onClick={(e) => { e.stopPropagation(); setEditing(r.idx); }}>{adm.common.edit}</AButton><AButton size="xs" variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={(e) => { e.stopPropagation(); setDel(r); }}>{adm.common.delete}</AButton></span> },
  ];
  const valid = draft.Title.trim() && draft.Category.trim();
  return (
    <AdminPage title={f.title} lead={f.lead} actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEditing('new')}>{f.new}</AButton>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ q: '', category: '' }); reset(); }}>
        <FilterField label={f.q} htmlFor="f-q" width={240}><AInput id="f-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={f.category} htmlFor="f-cat" width={140}><AInput id="f-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(x) => setP({ page: x })} onRowClick={(r) => setEditing(r.idx)} dense />
      <DetailDrawer open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? f.new : `${adm.common.edit} · #${editing}`} wide
        footer={<><AButton onClick={() => setEditing(null)}>{adm.common.cancel}</AButton><AButton variant="primary" disabled={!canWrite || !valid} title={readOnlyTitle} loading={create.isPending || update.isPending} onClick={() => (editing === 'new' ? create.mutate(draft) : typeof editing === 'number' ? update.mutate({ idx: editing, b: draft }) : undefined)}>{editing === 'new' ? adm.common.create : adm.common.save}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={f.form.category} htmlFor="ff-cat" required><AInput id="ff-cat" value={draft.Category} onChange={(e) => setDraft({ ...draft, Category: e.target.value })} maxLength={50} disabled={!canWrite} /></FieldRow>
          <FieldRow label={f.form.title} htmlFor="ff-title" required><AInput id="ff-title" value={draft.Title} onChange={(e) => setDraft({ ...draft, Title: e.target.value })} maxLength={200} disabled={!canWrite} /></FieldRow>
          <FieldRow label={f.form.content} htmlFor="ff-content"><ATextarea id="ff-content" value={draft.Content} onChange={(e) => setDraft({ ...draft, Content: e.target.value })} rows={12} maxLength={100000} disabled={!canWrite} /></FieldRow>
          <FieldRow label={f.form.order} htmlFor="ff-order"><AInput id="ff-order" type="number" min={0} value={draft.OrderByNum} onChange={(e) => setDraft({ ...draft, OrderByNum: e.target.value })} style={{ width: 120 }} disabled={!canWrite} /></FieldRow>
          <FieldRow label={tr('옵션', 'Options')}><ACheckbox label={f.form.useYN} checked={draft.UseYN} onChange={(e) => setDraft({ ...draft, UseYN: e.target.checked })} disabled={!canWrite} /></FieldRow>
        </div>
      </DetailDrawer>
      <ConfirmDialog open={!!del} title={`${adm.common.delete} · ${del?.title ?? ''}`} body={f.deleteBody} tone="danger" confirmLabel={adm.common.delete} loading={remove.isPending} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.idx)} />
    </AdminPage>
  );
}
