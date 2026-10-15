import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminRubyOpsApi, type RubyRuntimeRow } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { AButton, ACheckbox, AdminPage, AInput, ASelect, Callout, DataTable, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { RubyGate } from './rubyAccess';

const TYPES = ['string', 'number', 'boolean', 'json'].map((v) => ({ value: v, label: v }));
type Draft = { configValue: string; valueType: string; isActive: boolean; note: string };

/** ruby_runtime.php + ruby_runtime_script.php — every RubyRuntimeConfig row editable in place, one 저장 for all. */
function RubyRuntimePageInner() {
  const { canWrite, readOnlyTitle } = useWriteGate();
  const list = useQuery({ queryKey: ['admin', 'ruby', 'runtime'], queryFn: ({ signal }) => adminRubyOpsApi.runtime(signal) });
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  useEffect(() => { if (list.data) setDraft(Object.fromEntries(list.data.items.map((i) => [i.configKey, { configValue: i.configValue, valueType: i.valueType, isActive: i.isActive, note: i.note ?? '' }]))); }, [list.data]);
  const save = useAdminMutation({
    fn: () => adminRubyOpsApi.putRuntime((list.data?.items ?? []).map((i) => { const d = draft[i.configKey]!; return { config_key: i.configKey, config_value: d.configValue, value_type: d.valueType, is_active: d.isActive, note: d.note || null }; })),
    invalidate: [['admin', 'ruby', 'runtime']], success: (r) => tr(`${r.updated}개 설정을 저장했습니다.`, `${r.updated} settings saved.`),
  });
  const set = (key: string, patch: Partial<Draft>) => setDraft((d) => ({ ...d, [key]: { ...d[key]!, ...patch } }));
  const dirty = (list.data?.items ?? []).some((i) => { const d = draft[i.configKey]; return d && (d.configValue !== i.configValue || d.valueType !== i.valueType || d.isActive !== i.isActive || d.note !== (i.note ?? '')); });
  const columns: Column<RubyRuntimeRow>[] = [
    { key: 'configKey', header: tr('키', 'Key'), nowrap: true, render: (r) => <span className="mono">{r.configKey}</span> },
    { key: 'configValue', header: tr('값', 'Value'), render: (r) => <AInput aria-label={`${r.configKey} ${tr('값', 'value')}`} value={draft[r.configKey]?.configValue ?? ''} onChange={(e) => set(r.configKey, { configValue: e.target.value })} disabled={!canWrite} style={{ width: '100%' }} /> },
    { key: 'valueType', header: tr('타입', 'Type'), width: 130, render: (r) => <ASelect aria-label={`${r.configKey} ${tr('타입', 'type')}`} value={draft[r.configKey]?.valueType ?? 'string'} onChange={(e) => set(r.configKey, { valueType: e.target.value })} options={TYPES} disabled={!canWrite} /> },
    { key: 'isActive', header: tr('활성', 'Active'), align: 'center', width: 80, render: (r) => <ACheckbox label="" aria-label={`${r.configKey} ${tr('활성', 'active')}`} checked={draft[r.configKey]?.isActive ?? false} onChange={(e) => set(r.configKey, { isActive: e.target.checked })} disabled={!canWrite} /> },
    { key: 'note', header: tr('비고', 'Note'), render: (r) => <AInput aria-label={`${r.configKey} ${tr('비고', 'note')}`} value={draft[r.configKey]?.note ?? ''} onChange={(e) => set(r.configKey, { note: e.target.value })} disabled={!canWrite} style={{ width: '100%' }} /> },
    { key: 'updatedAt', header: tr('수정', 'Updated'), nowrap: true, render: (r) => <span className="muted" style={{ fontSize: 12 }}>{r.updatedAt ?? ''}{r.updatedBy ? ` · ${r.updatedBy}` : ''}</span> },
  ];
  return (
    <AdminPage title={tr('Ruby 런타임 설정', 'Ruby runtime settings')} lead={tr('챗봇 Ruby의 임계값·스위치(RubyRuntimeConfig). 기존 화면처럼 표에서 바로 고치고 한 번에 저장합니다. 새 키는 만들 수 없습니다.', 'Thresholds and switches for the Ruby chatbot (RubyRuntimeConfig). Edit in place and save once; new keys cannot be created here.')}
      actions={<AButton variant="primary" loading={save.isPending} disabled={!canWrite || !dirty} title={readOnlyTitle} onClick={() => save.mutate(undefined as never)}>{adm.common.save}</AButton>}>
      {!canWrite ? <Callout tone="warn" className="u-mb-8">{adm.readOnly}</Callout> : null}
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.configKey} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} emptyTitle={tr('설정 행이 없습니다.', 'No settings.')} dense />
    </AdminPage>
  );
}

export default function RubyRuntimePage() {
  return <RubyGate><RubyRuntimePageInner /></RubyGate>;
}
