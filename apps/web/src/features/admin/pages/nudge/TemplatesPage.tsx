import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminNudgeApi, type TemplateRow } from '../../../../shared/api/endpoints/admin-nudge';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ATextarea, Card, ConfirmDialog, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { MessageBlock } from './nudgeShared';

const DEFAULTS = { q: '', page: 1 };
const SIZE = 30; // include_top.php $page_size
type Form = { MessageMode: string; TemplateCode: string; TemplateMessage: string };
const empty = (): Form => ({ MessageMode: '', TemplateCode: '', TemplateMessage: '' });

/** smsdata.php / smsdata_write.php / smsdata_read.php — 문자/템플릿 관리 (C5): SendMessage CRUD. */
export default function TemplatesPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [q, setQ] = useState(p.q);
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'nudge', 'templates', query], queryFn: ({ signal }) => adminNudgeApi.templates(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const [sel, setSel] = useState<TemplateRow | null>(null);
  const [editOpen, setEditOpen] = useState<'create' | 'edit' | null>(null);
  const [f, setF] = useState<Form>(empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (editOpen === 'edit' && sel) setF({ MessageMode: sel.messageMode, TemplateCode: sel.templateCode, TemplateMessage: sel.templateMessage ?? sel.message ?? '' }); if (editOpen === 'create') setF(empty()); setErrors({}); }, [editOpen, sel]);
  const onErr = (err: unknown) => { if (isAppError(err) && Array.isArray(err.details)) { const e: Record<string, string> = {}; for (const d of err.details as { path?: string; message?: string }[]) if (d.path) e[d.path] = d.message ?? ''; setErrors(e); } toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };
  const inv = [['admin', 'nudge', 'templates'], ['admin', 'nudge', 'meta']];
  const create = useAdminMutation({ fn: (b: Form) => adminNudgeApi.createTemplate(b), invalidate: inv, success: tr('처리되었습니다.', 'Saved.'), onSuccess: () => setEditOpen(null), onError: onErr });
  const patch = useAdminMutation({ fn: (b: Form) => adminNudgeApi.patchTemplate(sel!.idx, b), invalidate: inv, success: tr('처리되었습니다.', 'Saved.'), onSuccess: (_r, b) => { setEditOpen(null); setSel((s) => (s ? { ...s, messageMode: b.MessageMode, templateCode: b.TemplateCode, templateMessage: b.TemplateMessage, message: b.TemplateMessage } : s)); }, onError: onErr });
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminNudgeApi.deleteTemplate(sel!.idx), invalidate: inv, success: adm.common.deleted, onSuccess: () => { setDelOpen(false); setSel(null); } });
  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.MessageMode.trim()) e.MessageMode = tr('모드를 입력하세요.', 'Enter the mode.');
    if (!f.TemplateCode.trim()) e.TemplateCode = tr('템플릿코드를 입력하세요.', 'Enter the template code.');
    if (!f.TemplateMessage.trim()) e.TemplateMessage = tr('카카오톡 메시지를 입력하세요.', 'Enter the message.');
    setErrors(e); if (Object.keys(e).length) return;
    const body = { MessageMode: f.MessageMode.trim(), TemplateCode: f.TemplateCode.trim(), TemplateMessage: f.TemplateMessage };
    setConfirmSave(body); // smsdata_write.php: confirm('등록하시겠습니까?') for both new and edit
  };
  const [confirmSave, setConfirmSave] = useState<Form | null>(null);
  const doSave = () => { if (!confirmSave) return; const body = confirmSave; setConfirmSave(null); if (editOpen === 'create') create.mutate(body); else patch.mutate(body); };
  const modes = list.data?.modes ?? [];
  const keywordColumns: Column<{ key: string; label: string; example: string }>[] = [
    { key: 'key', header: tr('키워드', 'Keyword'), nowrap: true, render: (v) => <b>{v.key}</b> },
    { key: 'label', header: tr('설명', 'Meaning') },
    { key: 'example', header: tr('예', 'Example') },
  ];
  const columns: Column<TemplateRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => firstNo - i },
    { key: 'messageMode', header: tr('모드', 'Mode'), nowrap: true, render: (r) => <><b>{r.messageMode}</b>{r.modeLabel !== r.messageMode ? <span className="muted"> ({r.modeLabel})</span> : null}</> },
    { key: 'templateCode', header: tr('템플릿코드', 'Template code'), nowrap: true, render: (r) => <span className="mono">{r.templateCode}</span> },
    { key: 'templateMessage', header: tr('메시지', 'Message'), render: (r) => <div style={{ whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: 360, wordBreak: 'break-word' }}>{r.templateMessage ?? ''}</div> },
    { key: 'aligoStatus', header: tr('알리고상태', 'Aligo status'), align: 'center', nowrap: true, render: (r) => r.aligoStatus ? <StatusBadge tone="ok">{r.aligoStatus}</StatusBadge> : <StatusBadge tone="neutral" title={tr('알리고 템플릿 비교는 기존 관리자 사이트에서 확인하세요.', 'Compare with Aligo on the legacy admin.')}>{tr('미연동', 'not linked')}</StatusBadge> },
    { key: 'actions', header: tr('사용 유무', 'Actions'), align: 'center', nowrap: true, render: (r) => <span style={{ display: 'inline-flex', gap: 6 }}><AButton size="xs" disabled={!canWrite} title={readOnlyTitle} onClick={(e) => { e.stopPropagation(); setSel(r); setEditOpen('edit'); }}>{tr('수정', 'Edit')}</AButton><AButton size="xs" variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={(e) => { e.stopPropagation(); setSel(r); setDelOpen(true); }}>{tr('삭제', 'Delete')}</AButton></span> },
  ];
  return (
    <AdminPage title={tr('문자/템플릿 관리', 'SMS / Kakao templates')} lead={tr('학습참여독려 단계별 알림톡 템플릿(SendMessage)입니다. 아래 키워드를 본문에 넣으면 발송 시 수강생 정보로 치환됩니다.', 'Alimtalk templates per nudge stage (SendMessage). Keywords below are substituted per learner when sending.')}
      actions={<AButton variant="primary" disabled={!canWrite} title={readOnlyTitle} onClick={() => { setSel(null); setEditOpen('create'); }}>{tr('등록', 'New')}</AButton>}>
      <Card title={tr('아래 키워드를 사용하면 해당 메시지가 적용됩니다.', 'Keywords replaced at send time')}>
        {/* smsdata.php keyword table: 키워드 | 설명 | 예 (the sender substitutes them written as #{키워드}) */}
        <DataTable dense rows={list.data?.variables} rowKey={(v) => v.key} columns={keywordColumns} emptyTitle={tr('키워드 없음', 'No keywords')} />
      </Card>
      <FilterBar onSubmit={() => setP({ q }, true)} onReset={() => { setQ(''); reset(); }}>
        <FilterField label={tr('메시지 검색', 'Search message')} htmlFor="tp-q" width={300}><AInput id="tp-q" value={q} onChange={(e) => setQ(e.target.value)} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 내용이 없습니다.', 'No templates.')} dense />

      <DetailDrawer open={!!sel && !editOpen && !delOpen} onClose={() => setSel(null)} title={sel ? `${sel.messageMode} · ${sel.templateCode}` : ''} subtitle={sel?.modeLabel} wide
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="danger" disabled={!canWrite} onClick={() => setDelOpen(true)}>{tr('삭 제', 'Delete')}</AButton><AButton variant="primary" disabled={!canWrite} onClick={() => setEditOpen('edit')}>{tr('정보 수정', 'Edit')}</AButton></>}>
        {sel ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><DescList items={[[tr('모드', 'Mode'), sel.messageMode], [tr('템플릿코드', 'Template code'), sel.templateCode], [tr('등록일', 'Registered'), sel.regDate ?? '-']]} /><Card title={tr('메시지(카톡)', 'Message (Kakao)')}><MessageBlock text={sel.templateMessage} maxHeight={420} /></Card></div> : null}
      </DetailDrawer>

      <DetailDrawer open={!!editOpen} onClose={() => setEditOpen(null)} title={editOpen === 'create' ? tr('문자/템플릿 관리 등록', 'New template') : tr('문자/템플릿 관리 수정', 'Edit template')} wide
        footer={<><AButton onClick={() => setEditOpen(null)}>{adm.common.cancel}</AButton><AButton variant="primary" loading={create.isPending || patch.isPending} disabled={!canWrite} onClick={submit}>{editOpen === 'create' ? tr('등록', 'Create') : tr('수정', 'Save')}</AButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldRow label={tr('모드', 'Mode')} htmlFor="tp-mode" required error={errors.MessageMode} help={tr('학습참여독려 단계 코드: ', 'Nudge stage code: ') + modes.map((m) => `${m.mode}(${m.label})`).join(', ')}><AInput id="tp-mode" list="tp-mode-list" value={f.MessageMode} onChange={(e) => setF({ ...f, MessageMode: e.target.value })} maxLength={50} /><datalist id="tp-mode-list">{modes.map((m) => <option key={m.mode} value={m.mode}>{m.label}</option>)}</datalist></FieldRow>
          <FieldRow label={tr('템플릿코드', 'Template code')} htmlFor="tp-code" required error={errors.TemplateCode} help={tr('알리고(카카오)에 승인된 템플릿 코드와 같아야 알림톡으로 발송됩니다.', 'Must match the approved Aligo (Kakao) template code for alimtalk delivery.')}><AInput id="tp-code" value={f.TemplateCode} onChange={(e) => setF({ ...f, TemplateCode: e.target.value })} maxLength={50} /></FieldRow>
          <FieldRow label={tr('메시지', 'Message')} htmlFor="tp-msg" required error={errors.TemplateMessage}><ATextarea id="tp-msg" rows={16} value={f.TemplateMessage} onChange={(e) => setF({ ...f, TemplateMessage: e.target.value })} /></FieldRow>
        </div>
      </DetailDrawer>

      <ConfirmDialog open={!!confirmSave} title={editOpen === 'create' ? tr('문자/템플릿 관리 등록', 'New template') : tr('문자/템플릿 관리 수정', 'Edit template')} body={<p>{tr('등록하시겠습니까?', 'Save this template?')}</p>} loading={create.isPending || patch.isPending} onCancel={() => setConfirmSave(null)} onConfirm={doSave} />
      <ConfirmDialog open={delOpen} title={tr('템플릿 삭제', 'Delete template')} tone="danger" loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)} body={<p>{tr('현재 글을 삭제하시겠습니까? 기존 사이트와 같이 행이 바로 삭제됩니다.', 'Delete this template? The row is removed immediately, as on the legacy site.')} <b>{sel?.messageMode} · {sel?.templateCode}</b></p>} />
    </AdminPage>
  );
}
