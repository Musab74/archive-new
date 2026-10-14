import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminRubyOpsApi, type RubyKbRow } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, Callout, ConfirmDialog, DataTable, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { EMBEDDING_NOTE, RUBY_STATUS_OPTIONS, statusTone } from './RubyFaqPage';

const DEFAULTS = { q: '', type: '', status: '', page: 1 };
const SIZE = 20;
const TYPES = [{ value: 'faq', label: 'faq' }, { value: 'policy', label: 'policy' }, { value: 'company_info', label: 'company_info' }, { value: 'technical_support', label: 'technical_support' }];
type Form = { type: string; title: string; content: string; status: string; priority: string; sourceUrl: string };
const empty = (): Form => ({ type: 'policy', title: '', content: '', status: 'published', priority: '50', sourceUrl: '' });

/** ruby_kb.php + ruby_kb_script.php — RubyKnowledgeBase list, create/edit, delete. */
export default function RubyKbPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q, type: p.type, status: p.status });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ q: p.q || undefined, type: p.type || undefined, status: p.status || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'ruby', 'kb', query], queryFn: ({ signal }) => adminRubyOpsApi.kbs(query, signal), placeholderData: keepPreviousData });
  const [edit, setEdit] = useState<{ mode: 'create' } | { mode: 'edit'; id: number } | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'ruby', 'kb', 'detail', edit?.mode === 'edit' ? edit.id : 0], queryFn: ({ signal }) => adminRubyOpsApi.kb((edit as { id: number }).id, signal), enabled: edit?.mode === 'edit' });
  const [f, setF] = useState<Form>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (edit?.mode === 'create') { setF(empty()); setErrors({}); } }, [edit]);
  useEffect(() => { const d = detail.data; if (edit?.mode === 'edit' && d) { setF({ type: d.type, title: d.title, content: d.content, status: d.status, priority: String(d.priority), sourceUrl: d.sourceUrl ?? '' }); setErrors({}); } }, [detail.data, edit]);
  const onErr = (err: unknown) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };
  const inv = [['admin', 'ruby', 'kb'], ['admin', 'ruby', 'embeddings']];
  const create = useAdminMutation({ fn: (b: Record<string, unknown>) => adminRubyOpsApi.createKb(b), invalidate: inv, success: adm.common.created, onSuccess: () => setEdit(null), onError: onErr });
  const patch = useAdminMutation({ fn: (b: Record<string, unknown>) => adminRubyOpsApi.patchKb((edit as { id: number }).id, b), invalidate: inv, success: adm.common.saved, onSuccess: () => setEdit(null), onError: onErr });
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminRubyOpsApi.deleteKb((edit as { id: number }).id), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDelOpen(false); setEdit(null); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = tr('제목을 입력해 주세요.', 'Required.');
    if (!f.content.trim()) e.content = tr('내용을 입력해 주세요.', 'Required.');
    setErrors(e); if (Object.keys(e).length) return;
    const body = { type: f.type, title: f.title.trim(), content: f.content.trim(), status: f.status, priority: Number(f.priority) || 0, source_url: f.sourceUrl.trim() || null };
    if (edit?.mode === 'create') create.mutate(body); else patch.mutate(body);
  };
  const total = list.data?.total ?? 0;
  const columns: Column<RubyKbRow>[] = [
    { key: 'id', header: 'ID', align: 'right', width: 60 },
    { key: 'type', header: tr('유형', 'Type'), nowrap: true },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <b>{r.title}</b> },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge> },
    { key: 'priority', header: tr('우선순위', 'Priority'), align: 'right', width: 80 },
    { key: 'embeddingModel', header: tr('임베딩', 'Embedding'), nowrap: true, render: (r) => r.embeddingModel ? <span title={r.embeddingUpdatedAt ?? ''}>{r.embeddingModel}</span> : <span className="muted">—</span> },
    { key: 'updatedAt', header: tr('수정일', 'Updated'), nowrap: true, render: (r) => r.updatedAt ?? '' },
    { key: 'manage', header: tr('관리', 'Manage'), align: 'center', width: 70, render: (r) => <AButton size="xs" onClick={(e) => { e.stopPropagation(); setEdit({ mode: 'edit', id: r.id }); }}>{adm.common.edit}</AButton> },
  ];
  return (
    <AdminPage title={tr('Ruby 지식베이스 관리', 'Ruby knowledge base')} lead={tr('챗봇 Ruby가 검색하는 지식 문서(RubyKnowledgeBase)입니다. 유형: faq / policy / company_info / technical_support.', 'Knowledge documents (RubyKnowledgeBase) the Ruby chatbot retrieves from.')}
      actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEdit({ mode: 'create' })}>{tr('신규 입력', 'New')}</AButton>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ q: '', type: '', status: '' }); reset(); }}>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="rk-q" width={240}><AInput id="rk-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder={tr('제목·내용', 'title / content')} /></FilterField>
        <FilterField label={tr('유형', 'Type')} htmlFor="rk-type" width={170}><ASelect id="rk-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: '', label: adm.common.all }, ...TYPES]} /></FilterField>
        <FilterField label={tr('상태', 'Status')} htmlFor="rk-st" width={140}><ASelect id="rk-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: '', label: adm.common.all }, ...RUBY_STATUS_OPTIONS]} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.id} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => setEdit({ mode: 'edit', id: r.id })} emptyTitle={tr('등록된 지식베이스 항목이 없습니다.', 'No entries.')} dense />

      <DetailDrawer open={!!edit} onClose={() => setEdit(null)} title={edit?.mode === 'create' ? tr('지식베이스 등록', 'New entry') : tr('지식베이스 수정', 'Edit entry')} subtitle={edit?.mode === 'edit' ? `ID ${edit.id}` : undefined} wide
        footer={<><AButton onClick={() => setEdit(null)}>{adm.common.cancel}</AButton>{edit?.mode === 'edit' ? <AButton variant="danger" disabled={!canWrite} onClick={() => setDelOpen(true)}>{adm.common.delete}</AButton> : null}<AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite || (edit?.mode === 'edit' && detail.isPending)} onClick={submit}>{edit?.mode === 'create' ? tr('등록', 'Create') : tr('수정', 'Save')}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('유형', 'Type')} htmlFor="rk-f-type"><ASelect id="rk-f-type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={TYPES} /></FieldRow>
          <FieldRow label={tr('제목', 'Title')} htmlFor="rk-f-title" required error={errors.title}><AInput id="rk-f-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={255} /></FieldRow>
          <FieldRow label={tr('내용', 'Content')} htmlFor="rk-f-content" required error={errors.content}><ATextarea id="rk-f-content" rows={10} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></FieldRow>
          <FieldRow label={tr('상태', 'Status')} htmlFor="rk-f-status"><ASelect id="rk-f-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={RUBY_STATUS_OPTIONS} /></FieldRow>
          <FieldRow label={tr('우선순위', 'Priority')} htmlFor="rk-f-prio"><AInput id="rk-f-prio" type="number" style={{ width: 120 }} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} /></FieldRow>
          <FieldRow label={tr('출처 URL', 'Source URL')} htmlFor="rk-f-src"><AInput id="rk-f-src" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} maxLength={500} /></FieldRow>
          {edit?.mode === 'edit' && detail.data ? <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('임베딩', 'Embedding')}: {detail.data.embeddingModel ?? '—'} {detail.data.embeddingUpdatedAt ? `(${detail.data.embeddingUpdatedAt})` : ''} · {tr('수정일', 'Updated')} {detail.data.updatedAt}</p> : null}
          <Callout tone="warn">{EMBEDDING_NOTE}</Callout>
        </div>
      </DetailDrawer>
      <ConfirmDialog open={delOpen} title={tr('지식베이스 삭제', 'Delete entry')} tone="danger" loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)} body={<p>{tr('행을 삭제합니다(기존 화면과 동일). 되돌릴 수 없습니다.', 'Deletes the row (as the legacy page did). This cannot be undone.')}</p>} />
    </AdminPage>
  );
}
