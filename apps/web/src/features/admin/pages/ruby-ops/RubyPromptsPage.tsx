import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminRubyOpsApi, type RubyPromptRow } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { AButton, ACheckbox, AdminPage, AInput, ATextarea, DataTable, DetailDrawer, FieldRow, YnBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { RubyGate } from './rubyAccess';

type Form = { promptKey: string; title: string; content: string; version: string; isActive: boolean; note: string };
const empty = (): Form => ({ promptKey: 'ruby_system', title: '', content: '', version: '1', isActive: false, note: '' });

/** ruby_prompt.php + ruby_prompt_script.php — RubyPromptConfig list (key asc, version desc) and the save form. */
function RubyPromptsPageInner() {
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const list = useQuery({ queryKey: ['admin', 'ruby', 'prompts'], queryFn: ({ signal }) => adminRubyOpsApi.prompts(signal) });
  const [edit, setEdit] = useState<{ mode: 'create' } | { mode: 'edit'; id: number } | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'ruby', 'prompts', 'detail', edit?.mode === 'edit' ? edit.id : 0], queryFn: ({ signal }) => adminRubyOpsApi.prompt((edit as { id: number }).id, signal), enabled: edit?.mode === 'edit' });
  const [f, setF] = useState<Form>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (edit?.mode === 'create') { setF(empty()); setErrors({}); } }, [edit]);
  useEffect(() => { const d = detail.data; if (edit?.mode === 'edit' && d) { setF({ promptKey: d.promptKey, title: d.title ?? '', content: d.content, version: String(d.version), isActive: d.isActive, note: d.note ?? '' }); setErrors({}); } }, [detail.data, edit]);
  const onErr = (err: unknown) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };
  const inv = [['admin', 'ruby', 'prompts']];
  const create = useAdminMutation({ fn: (b: Record<string, unknown>) => adminRubyOpsApi.createPrompt(b), invalidate: inv, success: adm.common.saved, onSuccess: () => setEdit(null), onError: onErr });
  const patch = useAdminMutation({ fn: (b: Record<string, unknown>) => adminRubyOpsApi.patchPrompt((edit as { id: number }).id, b), invalidate: inv, success: adm.common.saved, onSuccess: () => setEdit(null), onError: onErr });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.promptKey.trim()) e.prompt_key = tr('키를 입력해 주세요.', 'Required.');
    if (!f.content.trim()) e.content = tr('내용을 입력해 주세요.', 'Required.');
    setErrors(e); if (Object.keys(e).length) return;
    const body = { prompt_key: f.promptKey.trim(), title: f.title.trim(), content: f.content, version: Number(f.version) || 1, is_active: f.isActive, note: f.note.trim() || null };
    if (edit?.mode === 'create') create.mutate(body); else patch.mutate(body);
  };
  const columns: Column<RubyPromptRow>[] = [
    { key: 'id', header: 'ID', align: 'right', width: 60 },
    { key: 'promptKey', header: tr('키', 'Key'), nowrap: true, render: (r) => <span className="mono">{r.promptKey}</span> },
    { key: 'title', header: tr('제목', 'Title'), render: (r) => <b>{r.title ?? ''}</b> },
    { key: 'version', header: tr('버전', 'Version'), align: 'right', width: 70 },
    { key: 'isActive', header: tr('활성', 'Active'), align: 'center', render: (r) => <YnBadge value={r.isActive} yes="1" no="0" /> },
    { key: 'updatedAt', header: tr('수정일', 'Updated'), nowrap: true, render: (r) => r.updatedAt ?? '' },
    { key: 'manage', header: tr('관리', 'Manage'), align: 'center', width: 70, render: (r) => <AButton size="xs" onClick={(e) => { e.stopPropagation(); setEdit({ mode: 'edit', id: r.id }); }}>{adm.common.edit}</AButton> },
  ];
  return (
    <AdminPage title={tr('Ruby 프롬프트 설정', 'Ruby prompts')} lead={tr('챗봇 Ruby의 시스템 프롬프트(RubyPromptConfig). 같은 키에서 활성(is_active=1)인 것 중 가장 높은 버전이 쓰입니다.', 'System prompts for the Ruby chatbot (RubyPromptConfig). Per key, the highest active version is used.')}
      actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => setEdit({ mode: 'create' })}>{tr('신규 입력', 'New')}</AButton>}>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.id} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} onRowClick={(r) => setEdit({ mode: 'edit', id: r.id })} size={50} emptyTitle={tr('등록된 프롬프트가 없습니다.', 'No prompts.')} dense />
      <DetailDrawer open={!!edit} onClose={() => setEdit(null)} title={edit?.mode === 'create' ? tr('프롬프트 등록', 'New prompt') : tr('프롬프트 수정', 'Edit prompt')} subtitle={edit?.mode === 'edit' ? `ID ${edit.id}` : undefined} wide
        footer={<><AButton onClick={() => setEdit(null)}>{adm.common.cancel}</AButton><AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite || (edit?.mode === 'edit' && detail.isPending)} onClick={submit}>{adm.common.save}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('키', 'Key')} htmlFor="rp-key" required error={errors.prompt_key}><AInput id="rp-key" value={f.promptKey} onChange={(e) => setF({ ...f, promptKey: e.target.value })} maxLength={80} /></FieldRow>
          <FieldRow label={tr('제목', 'Title')} htmlFor="rp-title"><AInput id="rp-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={150} /></FieldRow>
          <FieldRow label={tr('내용', 'Content')} htmlFor="rp-content" required error={errors.content}><ATextarea id="rp-content" rows={12} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} /></FieldRow>
          <FieldRow label={tr('버전', 'Version')} htmlFor="rp-ver"><AInput id="rp-ver" type="number" style={{ width: 120 }} value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></FieldRow>
          <FieldRow label={tr('활성', 'Active')}><ACheckbox label={tr('이 버전을 사용', 'Use this version')} checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /></FieldRow>
          <FieldRow label={tr('비고', 'Note')} htmlFor="rp-note"><AInput id="rp-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={255} /></FieldRow>
        </div>
      </DetailDrawer>
    </AdminPage>
  );
}

export default function RubyPromptsPage() {
  return <RubyGate><RubyPromptsPageInner /></RubyGate>;
}
