import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminRubyOpsApi, type RubyFaqRow } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, Callout, ConfirmDialog, DataTable, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

const DEFAULTS = { q: '', status: '', page: 1 };
const SIZE = 20;
export const RUBY_STATUS_OPTIONS = [{ value: 'draft', label: 'draft' }, { value: 'published', label: 'published' }, { value: 'archived', label: 'archived' }];
export const statusTone = (s: string) => (s === 'published' ? 'ok' : s === 'draft' ? 'warn' : 'neutral') as 'ok' | 'warn' | 'neutral';
export const EMBEDDING_NOTE = tr('저장 후 RAG 임베딩 갱신은 아직 새 API에 연결되지 않았습니다(기존 관리자 Ruby 임베딩 작업에서 재생성).', 'The RAG embedding refresh after saving is not wired to the new API yet (regenerate from the legacy Ruby embeddings page).');

type Form = { question: string; answer: string; intent: string; keywords: string; status: string; priority: string };
const empty = (): Form => ({ question: '', answer: '', intent: 'general', keywords: '', status: 'published', priority: '70' });

/** ruby_faq.php + ruby_faq_script.php — list, create/edit form, delete. */
export default function RubyFaqPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q, status: p.status });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ q: p.q || undefined, status: p.status || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'ruby', 'faq', query], queryFn: ({ signal }) => adminRubyOpsApi.faqs(query, signal), placeholderData: keepPreviousData });
  const [edit, setEdit] = useState<{ mode: 'create' } | { mode: 'edit'; idx: number } | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'ruby', 'faq', 'detail', edit?.mode === 'edit' ? edit.idx : 0], queryFn: ({ signal }) => adminRubyOpsApi.faq((edit as { idx: number }).idx, signal), enabled: edit?.mode === 'edit' });
  const [f, setF] = useState<Form>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (edit?.mode === 'create') { setF(empty()); setErrors({}); } }, [edit]);
  useEffect(() => { const d = detail.data; if (edit?.mode === 'edit' && d) { setF({ question: d.question, answer: d.answer, intent: d.intent ?? 'general', keywords: d.keywords ?? '', status: d.status, priority: String(d.priority) }); setErrors({}); } }, [detail.data, edit]);
  const onErr = (err: unknown) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };
  const inv = [['admin', 'ruby', 'faq']];
  const create = useAdminMutation({ fn: (b: Record<string, unknown>) => adminRubyOpsApi.createFaq(b), invalidate: inv, success: adm.common.created, onSuccess: () => setEdit(null), onError: onErr });
  const patch = useAdminMutation({ fn: (b: Record<string, unknown>) => adminRubyOpsApi.patchFaq((edit as { idx: number }).idx, b), invalidate: inv, success: adm.common.saved, onSuccess: () => setEdit(null), onError: onErr });
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminRubyOpsApi.deleteFaq((edit as { idx: number }).idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDelOpen(false); setEdit(null); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.question.trim()) e.question = tr('질문을 입력해 주세요.', 'Required.');
    if (!f.answer.trim()) e.answer = tr('답변을 입력해 주세요.', 'Required.');
    setErrors(e); if (Object.keys(e).length) return;
    const body = { question: f.question.trim(), answer: f.answer.trim(), intent: f.intent.trim() || 'general', keywords: f.keywords.trim(), status: f.status, priority: Number(f.priority) || 0 };
    if (edit?.mode === 'create') create.mutate(body); else patch.mutate(body);
  };
  const total = list.data?.total ?? 0;
  const columns: Column<RubyFaqRow>[] = [
    { key: 'idx', header: 'ID', align: 'right', width: 60 },
    { key: 'question', header: tr('질문', 'Question'), render: (r) => <b>{r.question}</b> },
    { key: 'intent', header: tr('의도', 'Intent'), nowrap: true, render: (r) => r.intent ?? '' },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge> },
    { key: 'priority', header: tr('우선순위', 'Priority'), align: 'right', width: 80 },
    { key: 'updatedAt', header: tr('수정일', 'Updated'), nowrap: true, render: (r) => r.updatedAt ?? '' },
    { key: 'manage', header: tr('관리', 'Manage'), align: 'center', width: 70, render: (r) => <AButton size="xs" onClick={(e) => { e.stopPropagation(); setEdit({ mode: 'edit', idx: r.idx }); }}>{adm.common.edit}</AButton> },
  ];
  return (
    <AdminPage title={tr('Ruby FAQ 관리', 'Ruby FAQ')} lead={tr('챗봇 Ruby가 답변에 쓰는 FAQ(RubyFaq)입니다. 기존 화면과 같은 항목: 질문/답변/의도/키워드/상태/우선순위.', 'FAQ entries (RubyFaq) the Ruby chatbot answers from — same fields as the legacy page.')}
      actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEdit({ mode: 'create' })}>{tr('신규 입력', 'New')}</AButton>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ q: '', status: '' }); reset(); }}>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="rf-q" width={240}><AInput id="rf-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder={tr('질문·답변·키워드·의도', 'question / answer / keywords / intent')} /></FilterField>
        <FilterField label={tr('상태', 'Status')} htmlFor="rf-st" width={140}><ASelect id="rf-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: '', label: adm.common.all }, ...RUBY_STATUS_OPTIONS]} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={(r) => setEdit({ mode: 'edit', idx: r.idx })} emptyTitle={tr('등록된 FAQ가 없습니다.', 'No FAQ entries.')} dense />

      <DetailDrawer open={!!edit} onClose={() => setEdit(null)} title={edit?.mode === 'create' ? tr('Ruby FAQ 등록', 'New FAQ') : tr('Ruby FAQ 수정', 'Edit FAQ')} subtitle={edit?.mode === 'edit' ? `ID ${edit.idx}` : undefined} wide
        footer={<><AButton onClick={() => setEdit(null)}>{adm.common.cancel}</AButton>{edit?.mode === 'edit' ? <AButton variant="danger" disabled={!canWrite} onClick={() => setDelOpen(true)}>{adm.common.delete}</AButton> : null}<AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite || (edit?.mode === 'edit' && detail.isPending)} onClick={submit}>{edit?.mode === 'create' ? tr('등록', 'Create') : tr('수정', 'Save')}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('질문', 'Question')} htmlFor="rf-question" required error={errors.question}><AInput id="rf-question" value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} maxLength={500} /></FieldRow>
          <FieldRow label={tr('답변', 'Answer')} htmlFor="rf-answer" required error={errors.answer}><ATextarea id="rf-answer" rows={7} value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} /></FieldRow>
          <FieldRow label={tr('의도', 'Intent')} htmlFor="rf-intent"><AInput id="rf-intent" value={f.intent} onChange={(e) => setF({ ...f, intent: e.target.value })} maxLength={80} /></FieldRow>
          <FieldRow label={tr('키워드', 'Keywords')} htmlFor="rf-kw"><AInput id="rf-kw" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} maxLength={1000} /></FieldRow>
          <FieldRow label={tr('상태', 'Status')} htmlFor="rf-status" help="draft / published / archived"><ASelect id="rf-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={RUBY_STATUS_OPTIONS} /></FieldRow>
          <FieldRow label={tr('우선순위', 'Priority')} htmlFor="rf-prio"><AInput id="rf-prio" type="number" style={{ width: 120 }} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} /></FieldRow>
          {edit?.mode === 'edit' && detail.data ? <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr('수정일', 'Updated')} {detail.data.updatedAt} · v{detail.data.version} · {detail.data.locale}</p> : null}
          <Callout tone="warn">{EMBEDDING_NOTE}</Callout>
        </div>
      </DetailDrawer>
      <ConfirmDialog open={delOpen} title={tr('FAQ 삭제', 'Delete FAQ')} tone="danger" loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)} body={<p>{tr('행을 삭제합니다(기존 화면과 동일). 되돌릴 수 없습니다.', 'Deletes the row (as the legacy page did). This cannot be undone.')}</p>} />
    </AdminPage>
  );
}
