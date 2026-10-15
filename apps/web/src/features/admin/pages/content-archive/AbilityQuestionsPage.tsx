import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, type ArchiveQuestionRow } from '../../../../shared/api/endpoints/admin-content-archive';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { GrantGate, useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { SIZE, noOf } from './shared';

const DEFAULTS = { col: 'aValue', q: '', page: 1 };
type Form = { aDepth: string; aGroup: string; aOrder: string; aValue: string; aValueDetail: string; aType: string; aBind: string };
const empty = (): Form => ({ aDepth: '', aGroup: '', aOrder: '', aValue: '', aValueDetail: '', aType: '', aBind: '' });
const fromRow = (r: ArchiveQuestionRow): Form => ({ aDepth: r.aDepth ?? '', aGroup: r.aGroup ?? '', aOrder: r.aOrder === null || r.aOrder === undefined ? '' : String(r.aOrder), aValue: r.aValue ?? '', aValueDetail: r.aValueDetail ?? '', aType: r.aType ?? '', aBind: r.aBind ?? '' });

/** ability_question_manager.php (+ _write / _script) — 역량진단 문항관리, grant D3. */
export default function AbilityQuestionsPage() {
  return <GrantGate grant="D3"><Questions /></GrantGate>;
}

function Questions() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'archive-questions', query], queryFn: ({ signal }) => apiX.questions(query, signal), placeholderData: keepPreviousData });
  const meta = useQuery({ queryKey: ['admin', 'archive-questions', 'meta'], queryFn: ({ signal }) => apiX.questionMeta(signal), staleTime: 10 * 60_000 });
  const total = list.data?.total ?? 0;

  const [sel, setSel] = useState<ArchiveQuestionRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'archive-question', sel?.idx], queryFn: ({ signal }) => apiX.question(sel!.idx, signal), enabled: !!sel });
  const [editOpen, setEditOpen] = useState<'create' | 'edit' | null>(null);
  const [f, setF] = useState<Form>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (editOpen === 'edit' && sel) setF(fromRow(sel)); if (editOpen === 'create') setF(empty()); setErrors({}); }, [editOpen, sel]);
  const onErr = (err: unknown) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string | string[]; message?: string }[]) { const k = Array.isArray(d.path) ? d.path.join('.') : d.path; if (k) e[k] = d.message ?? ''; } setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };
  const inv = [['admin', 'archive-questions']];
  const create = useAdminMutation({ fn: (b: Record<string, unknown>) => apiX.createQuestion(b), invalidate: inv, success: adm.common.created, onSuccess: () => setEditOpen(null), onError: onErr });
  const patch = useAdminMutation({ fn: (b: Record<string, unknown>) => apiX.patchQuestion(sel!.idx, b), invalidate: [...inv, ['admin', 'archive-question', sel?.idx]], success: adm.common.saved, onSuccess: () => { setEditOpen(null); setSel(null); }, onError: onErr });
  const [del, setDel] = useState<{ force: boolean; answers: number } | null>(null);
  const remove = useAdminMutation({
    fn: (force: boolean) => apiX.deleteQuestion(sel!.idx, force), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDel(null); setSel(null); },
    onError: (err) => { if (isAppError(err) && (err.details as { requiresForce?: boolean; answers?: number } | undefined)?.requiresForce) { setDel({ force: true, answers: (err.details as { answers: number }).answers }); toast(err.message, { tone: 'danger' }); return; } onErr(err); },
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (f.aOrder.trim() === '' || !/^\d{1,2}$/.test(f.aOrder.trim())) e.aOrder = tr('순서를 입력하세요. (0~99)', 'Enter the order (0–99).');
    if (!f.aValue.trim()) e.aValue = tr('문항을 입력하세요.', 'Enter the question.');
    setErrors(e); if (Object.keys(e).length) return;
    const body = { aDepth: f.aDepth || null, aGroup: f.aGroup || null, aOrder: Number(f.aOrder), aValue: f.aValue.trim(), aValueDetail: f.aValueDetail || null, aType: f.aType || null, aBind: f.aBind.trim() || null };
    // ability_question_manager_write.php: confirm("<?=$ScriptTitle?> 하시겠습니까?")
    if (!window.confirm(editOpen === 'create' ? tr('등록 하시겠습니까?', 'Register this question?') : tr('수정 하시겠습니까?', 'Save the changes?'))) return;
    if (editOpen === 'create') create.mutate(body); else patch.mutate(body);
  };
  /** "다시 작성" (location.reload on the PHP form): back to the stored values (edit) or an empty form (create). */
  const resetForm = () => { setF(editOpen === 'edit' && sel ? fromRow(sel) : empty()); setErrors({}); };

  const columns: Column<ArchiveQuestionRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => noOf(total, p.page, SIZE, i) },
    { key: 'typeLabel', header: tr('역량타입', 'Assessment'), nowrap: true, align: 'center' },
    { key: 'depthLabel', header: tr('단계', 'Step'), nowrap: true, align: 'center' },
    { key: 'groupLabel', header: tr('타입', 'Type'), nowrap: true, align: 'center' },
    { key: 'aOrder', header: tr('순서', 'Order'), align: 'right', width: 60, render: (r) => r.aOrder ?? '' },
    { key: 'aValue', header: tr('문항', 'Question'), render: (r) => <b>{r.aValue ?? ''}</b> },
    { key: 'aValueDetail', header: tr('상세', 'Detail'), render: (r) => <span style={{ whiteSpace: 'pre-wrap' }}>{r.aValueDetail ?? ''}</span> },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
  ];
  const d = detail.data;
  const opt = (xs: { value: string; label: string }[] | undefined, none: string) => [{ value: '', label: none }, ...(xs ?? [])];
  return (
    <AdminPage title={tr('역량진단 문항관리', 'Assessment questions')} lead={tr('ArchiveQuestion 문항 목록입니다. 삭제된 문항(Del=Y)은 보이지 않습니다. 행을 누르면 상세·수정·삭제가 열립니다.', 'ArchiveQuestion rows (deleted ones hidden). Click a row for details, edit and delete.')}
      actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setSel(null); setEditOpen('create'); }}>{tr('신규 등록', 'New')}</AButton>}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'aValue', q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="aq-col" width={140}><ASelect id="aq-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'aValue', label: tr('문항명', 'Question') }, { value: 'aType', label: tr('역량타입', 'Assessment (사전/사후)') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="aq-q" width={260}><AInput id="aq-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder={form.col === 'aType' ? tr('사전 / 사후', '사전 / 사후') : undefined} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 문항이 없습니다.', 'No questions.')} dense />

      <DetailDrawer open={!!sel && !editOpen} onClose={() => setSel(null)} title={sel ? `#${sel.idx} ${sel.aValue ?? ''}` : ''} subtitle={sel ? `${sel.typeLabel} · ${sel.depthLabel} · ${sel.groupLabel}` : ''}
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="danger" disabled={!canWrite} onClick={() => setDel({ force: false, answers: d?.answers ?? 0 })}>{adm.common.delete}</AButton><AButton variant="primary" disabled={!canWrite} onClick={() => setEditOpen('edit')}>{adm.common.edit}</AButton></>}>
        {d ? <DescList items={[[tr('역량타입', 'Assessment'), d.question.typeLabel], [tr('사전/사후 (aType)', 'aType'), d.question.aType], [tr('단계', 'Step'), d.question.depthLabel], [tr('타입', 'Type'), d.question.groupLabel], [tr('순서', 'Order'), d.question.aOrder], [tr('역량 (aBind)', 'Competency (aBind)'), d.question.bindLabel], [tr('문항', 'Question'), d.question.aValue], [tr('문항 상세', 'Detail'), <span key="d" style={{ whiteSpace: 'pre-wrap' }}>{d.question.aValueDetail}</span>], [tr('진단 결과 수', 'Answers'), d.answers.toLocaleString()], [tr('등록일', 'Registered'), d.question.regDate], [tr('수정일', 'Modified'), d.question.modDate]]} />
          : detail.isError ? <p className="muted">{adm.common.failed}</p> : <p className="muted">{adm.common.loading}</p>}
      </DetailDrawer>

      <DetailDrawer open={!!editOpen} onClose={() => setEditOpen(null)} title={editOpen === 'create' ? tr('역량진단 문항관리 등록', 'New question') : tr('역량진단 문항관리 수정', 'Edit question')}
        footer={<><AButton onClick={() => setEditOpen(null)}>{adm.common.cancel}</AButton><AButton onClick={resetForm} disabled={!canWrite}>{tr('다시 작성', 'Reset')}</AButton><AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{editOpen === 'create' ? adm.common.create : adm.common.save}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('단계', 'Step')} htmlFor="qf-depth"><ASelect id="qf-depth" value={f.aDepth} onChange={(e) => setF({ ...f, aDepth: e.target.value })} options={opt(meta.data?.depths, tr('-- 단계 선택 --', '-- step --'))} loading={meta.isPending} /></FieldRow>
          <FieldRow label={tr('타입', 'Type')} htmlFor="qf-group"><ASelect id="qf-group" value={f.aGroup} onChange={(e) => setF({ ...f, aGroup: e.target.value })} options={opt(meta.data?.groups, tr('-- 타입 선택 --', '-- type --'))} loading={meta.isPending} /></FieldRow>
          <FieldRow label={tr('순서', 'Order')} htmlFor="qf-order" required error={errors.aOrder}><AInput id="qf-order" type="number" min={0} max={99} value={f.aOrder} onChange={(e) => setF({ ...f, aOrder: e.target.value })} style={{ width: 120 }} /></FieldRow>
          <FieldRow label={tr('문항', 'Question')} htmlFor="qf-value" required error={errors.aValue}><AInput id="qf-value" value={f.aValue} onChange={(e) => setF({ ...f, aValue: e.target.value })} maxLength={100} /></FieldRow>
          <FieldRow label={tr('문항 상세', 'Detail')} htmlFor="qf-detail"><ATextarea id="qf-detail" rows={5} value={f.aValueDetail} onChange={(e) => setF({ ...f, aValueDetail: e.target.value })} maxLength={1000} placeholder={tr('내용을 입력해 주세요.', 'Enter the detail.')} /></FieldRow>
          <FieldRow label={tr('사전/사후', 'Pre/post')} htmlFor="qf-type" help={tr('기존 폼에는 없던 항목입니다. 학습자 진단 화면은 이 값으로 문항을 고르므로 새 문항에는 지정하세요.', 'Not on the legacy form; the learner assessment picks questions by this value, so set it for new questions.')}><ASelect id="qf-type" value={f.aType} onChange={(e) => setF({ ...f, aType: e.target.value })} options={opt(meta.data?.types, tr('-- 선택 안 함 --', '-- none --'))} /></FieldRow>
          <FieldRow label={tr('역량 (aBind)', 'Competency (aBind)')} htmlFor="qf-bind" help={tr('비워 두면 목록에 "사후 (만족도)"로 표시됩니다.', 'Empty shows as "사후 (만족도)" in the list.')}><ASelect id="qf-bind" value={f.aBind} onChange={(e) => setF({ ...f, aBind: e.target.value })} options={[{ value: '', label: tr('-- 없음 --', '-- none --') }, ...(meta.data?.binds ?? []), ...(f.aBind && !(meta.data?.binds ?? []).some((b) => b.value === f.aBind) ? [{ value: f.aBind, label: f.aBind }] : [])]} /></FieldRow>
        </div>
      </DetailDrawer>

      <ConfirmDialog open={!!del} title={tr('문항 삭제', 'Delete question')} tone="danger" loading={remove.isPending} confirmLabel={del?.force ? tr('강제 삭제', 'Delete anyway') : adm.common.delete} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.force)}
        body={<div><p>{tr('기존 사이트와 같이 문항 행을 실제로 삭제합니다. 되돌릴 수 없습니다.', 'Deletes the row like the legacy site. This cannot be undone.')} <b>#{sel?.idx} {sel?.aValue}</b></p>{del?.answers ? <p>{tr(`이 문항에 연결된 진단 결과 ${del.answers.toLocaleString()}건은 그대로 남습니다.`, `${del.answers.toLocaleString()} answers referencing it will remain.`)}</p> : null}</div>} />
    </AdminPage>
  );
}
