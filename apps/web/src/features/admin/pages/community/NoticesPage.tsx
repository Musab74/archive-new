import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { AdminNoticeRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, ACheckbox, AdminPage, AInput, ASelect, ATextarea, ConfirmDialog, DataTable, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, YnBadge, type Column } from '../../../../shared/ui/admin';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';

const DEFAULTS = { q: '', useYN: '', page: 1 };
const SIZE = 20;
const YN = [{ value: '', label: adm.common.all }, { value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }];
interface Form { Title: string; Content: string; UseYN: boolean; Notice: boolean }
const EMPTY: Form = { Title: '', Content: '', UseYN: true, Notice: false };

export default function NoticesPage() {
  const n = adm.community.notices;
  const { canWrite, readOnlyTitle } = useWriteGate();
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q, useYN: p.useYN });
  const query = useMemo(() => ({ q: p.q || undefined, useYN: p.useYN || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'notices', query], queryFn: ({ signal }) => adminApi.notices(query, signal), placeholderData: keepPreviousData });
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Form>(EMPTY);
  const [del, setDel] = useState<AdminNoticeRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'notice', editing], queryFn: ({ signal }) => adminApi.notice(editing as number, signal), enabled: typeof editing === 'number' });
  useEffect(() => { if (editing === 'new') setDraft(EMPTY); else if (detail.data) setDraft({ Title: detail.data.title, Content: detail.data.content ?? '', UseYN: detail.data.useYN === 'Y', Notice: detail.data.pinned }); }, [editing, detail.data]);
  const inv = [['admin', 'notices'], ['support']];
  const create = useAdminMutation({ fn: (b: Form) => adminApi.createNotice({ Title: b.Title.trim(), Content: b.Content || null, UseYN: b.UseYN ? 'Y' : 'N', Notice: b.Notice ? 'Y' : 'N' }), invalidate: inv, success: adm.common.created, onSuccess: () => setEditing(null) });
  const update = useAdminMutation({ fn: ({ idx, b }: { idx: number; b: Form }) => adminApi.updateNotice(idx, { Title: b.Title.trim(), Content: b.Content || null, UseYN: b.UseYN ? 'Y' : 'N', Notice: b.Notice ? 'Y' : 'N' }), invalidate: [...inv, ['admin', 'notice']], success: adm.common.saved, onSuccess: () => setEditing(null) });
  const remove = useAdminMutation({ fn: (idx: number) => adminApi.deleteNotice(idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => setDel(null) });
  const columns: Column<AdminNoticeRow>[] = [
    { key: 'idx', header: n.cols.idx, align: 'right', sortable: true },
    { key: 'title', header: n.cols.title, sortable: true, render: (r) => <b>{r.title}</b> },
    { key: 'pinned', header: n.cols.pinned, align: 'center', render: (r) => (r.pinned ? <StatusBadge tone="info">{tr('고정', 'Pinned')}</StatusBadge> : '') },
    { key: 'useYN', header: n.cols.useYN, align: 'center', render: (r) => <YnBadge value={r.useYN} yes={tr('노출', 'Visible')} no={tr('숨김', 'Hidden')} /> },
    { key: 'views', header: n.cols.views, align: 'right', sortable: true },
    { key: 'hasFile', header: n.cols.file, align: 'center', render: (r) => (r.hasFile ? '📎' : '') },
    { key: 'regDate', header: n.cols.regDate, nowrap: true, sortable: true, render: (r) => r.regDate ?? '' },
    { key: '_act', header: '', width: 120, render: (r) => <span style={{ display: 'inline-flex', gap: 4 }}><AButton size="xs" onClick={(e) => { e.stopPropagation(); setEditing(r.idx); }}>{adm.common.edit}</AButton><AButton size="xs" variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={(e) => { e.stopPropagation(); setDel(r); }}>{adm.common.delete}</AButton></span> },
  ];
  const valid = draft.Title.trim().length > 0;
  return (
    <AdminPage title={n.title} lead={n.lead} actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEditing('new')}>{n.new}</AButton>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ q: '', useYN: '' }); reset(); }}>
        <FilterField label={n.q} htmlFor="n-q" width={240}><AInput id="n-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={n.useYN} htmlFor="n-use" width={100}><ASelect id="n-use" value={form.useYN} onChange={(e) => setForm({ ...form, useYN: e.target.value })} options={YN} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={list.data?.total} onPageChange={(x) => setP({ page: x })} onRowClick={(r) => setEditing(r.idx)} dense />
      <DetailDrawer open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? n.new : `${adm.common.edit} · #${editing}`} wide
        footer={<><AButton onClick={() => setEditing(null)}>{adm.common.cancel}</AButton><AButton variant="primary" disabled={!canWrite || !valid} title={readOnlyTitle} loading={create.isPending || update.isPending} onClick={() => (editing === 'new' ? create.mutate(draft) : typeof editing === 'number' ? update.mutate({ idx: editing, b: draft }) : undefined)}>{editing === 'new' ? adm.common.create : adm.common.save}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={n.form.title} htmlFor="nf-title" required><AInput id="nf-title" value={draft.Title} onChange={(e) => setDraft({ ...draft, Title: e.target.value })} maxLength={200} disabled={!canWrite} /></FieldRow>
          <FieldRow label={n.form.content} htmlFor="nf-content"><ATextarea id="nf-content" value={draft.Content} onChange={(e) => setDraft({ ...draft, Content: e.target.value })} rows={14} maxLength={100000} disabled={!canWrite} /></FieldRow>
          <FieldRow label={tr('옵션', 'Options')}><div style={{ display: 'flex', gap: 14 }}><ACheckbox label={n.form.useYN} checked={draft.UseYN} onChange={(e) => setDraft({ ...draft, UseYN: e.target.checked })} disabled={!canWrite} /><ACheckbox label={n.form.pinned} checked={draft.Notice} onChange={(e) => setDraft({ ...draft, Notice: e.target.checked })} disabled={!canWrite} /></div></FieldRow>
          {detail.data?.files.length ? <FieldRow label={tr('첨부', 'Attachments')}><ul style={{ fontSize: 13 }}>{detail.data.files.map((f) => <li key={f.file}>{f.name ?? f.file}</li>)}</ul></FieldRow> : null}
        </div>
      </DetailDrawer>
      <ConfirmDialog open={!!del} title={`${adm.common.delete} · ${del?.title ?? ''}`} body={n.deleteBody} tone="danger" confirmLabel={adm.common.delete} loading={remove.isPending} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.idx)} />
    </AdminPage>
  );
}
