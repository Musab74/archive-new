import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminRubyOpsApi, type RubyTicketRow } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, ATextarea, Card, DataTable, DescList, DetailDrawer, FieldRow, FilterBar, FilterField, Kpi, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';

const DEFAULTS = { status: '', q: '', page: 1 };
const SIZE = 20;
const STATUSES = [{ value: 'new', label: 'new' }, { value: 'in_progress', label: 'in_progress' }, { value: 'closed', label: 'closed' }];
const tone = (s: string) => (s === 'new' ? 'danger' : s === 'in_progress' ? 'warn' : 'ok') as 'danger' | 'warn' | 'ok';
const score = (v: number | null) => (v === null || v === undefined ? '' : v.toFixed(4));

/** ruby_tickets.php + ruby_tickets_script.php — RubySupportTicket list with the per-row status change. */
export default function RubyTicketsPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ status: p.status, q: p.q });
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ status: p.status || undefined, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'ruby', 'tickets', query], queryFn: ({ signal }) => adminRubyOpsApi.tickets(query, signal), placeholderData: keepPreviousData });
  const [sel, setSel] = useState<RubyTicketRow | null>(null);
  const detail = useQuery({ queryKey: ['admin', 'ruby', 'tickets', 'detail', sel?.id], queryFn: ({ signal }) => adminRubyOpsApi.ticket(sel!.id, signal), enabled: !!sel });
  const [edit, setEdit] = useState({ status: 'new', note: '', assignedTo: '' });
  useEffect(() => { if (sel) setEdit({ status: sel.status, note: sel.resolvedNote ?? '', assignedTo: sel.assignedTo ?? '' }); }, [sel]);
  const inv = [['admin', 'ruby', 'tickets']];
  const quick = useAdminMutation({ fn: (v: { id: number; status: string }) => adminRubyOpsApi.patchTicket(v.id, { status: v.status }), invalidate: inv, success: adm.common.saved });
  const save = useAdminMutation({ fn: () => adminRubyOpsApi.patchTicket(sel!.id, { status: edit.status, resolved_note: edit.note.trim() || null, assigned_to: edit.assignedTo.trim() || null }), invalidate: [...inv, ['admin', 'ruby', 'tickets', 'detail', sel?.id]], success: adm.common.saved, onSuccess: () => setSel(null) });
  const [rowStatus, setRowStatus] = useState<Record<number, string>>({});
  const total = list.data?.total ?? 0;
  const by = Object.fromEntries((list.data?.byStatus ?? []).map((s) => [s.status, s.count]));
  const columns: Column<RubyTicketRow>[] = [
    { key: 'id', header: 'ID', align: 'right', width: 60 },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge> },
    { key: 'contactName', header: tr('이름', 'Name'), nowrap: true, render: (r) => <b>{r.contactName}</b> },
    { key: 'contactPhone', header: tr('연락처', 'Contact'), nowrap: true },
    { key: 'userMessage', header: tr('문의', 'Message'), render: (r) => <span style={{ display: 'inline-block', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={r.userMessage}>{r.userMessage}</span> },
    { key: 'similarityScore', header: tr('유사도', 'Similarity'), align: 'right', render: (r) => score(r.similarityScore) },
    { key: 'modelConfidence', header: tr('신뢰도', 'Confidence'), align: 'right', render: (r) => score(r.modelConfidence) },
    { key: 'createdAt', header: tr('생성일', 'Created'), nowrap: true, render: (r) => r.createdAt ?? '' },
    { key: 'manage', header: tr('처리', 'Handle'), nowrap: true, width: 200, render: (r) => (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        <ASelect aria-label={`${tr('티켓', 'Ticket')} ${r.id} ${tr('상태', 'status')}`} value={rowStatus[r.id] ?? r.status} onChange={(e) => setRowStatus({ ...rowStatus, [r.id]: e.target.value })} options={STATUSES} disabled={!canWrite} />
        <AButton size="xs" disabled={!canWrite || (rowStatus[r.id] ?? r.status) === r.status} title={readOnlyTitle} loading={quick.isPending && quick.variables?.id === r.id} onClick={() => quick.mutate({ id: r.id, status: rowStatus[r.id] ?? r.status })}>{adm.common.save}</AButton>
      </span>
    ) },
  ];
  const d = detail.data;
  return (
    <AdminPage title={tr('Ruby 지원티켓', 'Ruby support tickets')} lead={tr('챗봇이 답하지 못해 상담 연결을 요청한 건(RubySupportTicket)입니다. 상태: new → in_progress → closed.', 'Requests the chatbot escalated to a human (RubySupportTicket). Status: new → in_progress → closed.')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <Kpi label="new" value={by.new ?? 0} tone={by.new ? 'warn' : undefined} />
        <Kpi label="in_progress" value={by.in_progress ?? 0} />
        <Kpi label="closed" value={by.closed ?? 0} tone="ok" />
      </div>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ status: '', q: '' }); reset(); }}>
        <FilterField label={tr('상태', 'Status')} htmlFor="rt-st" width={150}><ASelect id="rt-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: '', label: adm.common.all }, ...STATUSES]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="rt-q" width={240}><AInput id="rt-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder={tr('이름·연락처·문의·아이디', 'name / contact / message / user ID')} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.id} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.id ?? null} emptyTitle={tr('지원티켓이 없습니다.', 'No tickets.')} dense />
      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${tr('티켓', 'Ticket')} #${sel.id}` : ''} subtitle={sel?.contactName} wide
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="primary" loading={save.isPending} disabled={!canWrite} title={readOnlyTitle} onClick={() => save.mutate(undefined as never)}>{adm.common.save}</AButton></>}>
        {sel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title={tr('문의 내용', 'Request')}>
              <DescList items={[[tr('이름', 'Name'), sel.contactName], [tr('연락처', 'Contact'), sel.contactPhone], [tr('회원', 'Member'), sel.userId ? `${sel.userName ?? ''} (${sel.userId})` : tr('비로그인', 'guest')], [tr('세션', 'Session'), <span key="s" className="mono">{sel.sessionId ?? ''}</span>], [tr('유사도 / 신뢰도', 'Similarity / confidence'), `${score(sel.similarityScore)} / ${score(sel.modelConfidence)}`], [tr('생성일', 'Created'), sel.createdAt], [tr('수정일', 'Updated'), sel.updatedAt]]} />
              <p style={{ whiteSpace: 'pre-wrap', margin: '10px 0 0', fontSize: 13 }}>{sel.userMessage}</p>
            </Card>
            {d?.botContext ? <Card title={tr('봇 컨텍스트', 'Bot context')}><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0, maxHeight: 240, overflow: 'auto' }}>{d.botContext}</pre></Card> : null}
            <Card title={tr('처리', 'Handling')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow label={tr('상태', 'Status')} htmlFor="rt-d-st"><ASelect id="rt-d-st" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={STATUSES} disabled={!canWrite} /></FieldRow>
                <FieldRow label={tr('담당자', 'Assignee')} htmlFor="rt-d-as"><AInput id="rt-d-as" value={edit.assignedTo} onChange={(e) => setEdit({ ...edit, assignedTo: e.target.value })} maxLength={100} disabled={!canWrite} /></FieldRow>
                <FieldRow label={tr('처리 메모', 'Resolution note')} htmlFor="rt-d-note"><ATextarea id="rt-d-note" rows={4} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} disabled={!canWrite} /></FieldRow>
              </div>
            </Card>
          </div>
        ) : null}
      </DetailDrawer>
    </AdminPage>
  );
}
