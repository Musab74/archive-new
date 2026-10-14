import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminNudgeApi, type ReservationRow } from '../../../../shared/api/endpoints/admin-nudge';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, ConfirmDialog, DataTable, DateField, DescList, DetailDrawer, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { MemberLink, MessageBlock } from './nudgeShared';

const DEFAULTS = { from: '', to: '', col: 'name', q: '', page: 1 };
const SIZE = 20;
const COLS = [{ value: 'name', label: tr('이름', 'Name') }, { value: 'id', label: tr('아이디', 'User ID') }, { value: 'company', label: tr('사업주명', 'Company') }];

/** study_sms_res_list.php — 예약문자발송 (C1): pending SmsRes rows, CSV export, delete (= cancel) checked rows. */
export default function SmsReservationsPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ from: p.from, to: p.to, col: p.col, q: p.q });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ from: p.from || undefined, to: p.to || undefined, col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'nudge', 'reservations', query], queryFn: ({ signal }) => adminNudgeApi.reservations(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const rows = list.data?.items ?? [];
  const [checked, setChecked] = useState<Set<number>>(new Set());
  useEffect(() => setChecked(new Set()), [list.data]);
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.idx));
  const [sel, setSel] = useState<ReservationRow | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const del = useAdminMutation({ fn: () => adminNudgeApi.deleteReservations([...checked]), invalidate: [['admin', 'nudge', 'reservations']], success: tr('삭제 되었습니다.', 'Deleted.'), onSuccess: () => { setDelOpen(false); setSel(null); } });
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try { await adminNudgeApi.downloadReservationsCsv({ from: query.from, to: query.to, col: query.col, q: query.q }); }
    catch (err) { toast(isAppError(err) ? err.message : tr('목록을 내려받지 못했습니다.', 'Download failed.'), { tone: 'danger' }); }
    finally { setExporting(false); }
  };
  const columns: Column<ReservationRow>[] = [
    { key: 'check', header: <input type="checkbox" aria-label={tr('전체 선택', 'Select all')} checked={allChecked} onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.idx)))} />, width: 40, align: 'center', render: (r) => <input type="checkbox" aria-label={`${tr('선택', 'Select')} ${r.idx}`} checked={checked.has(r.idx)} onClick={(e) => e.stopPropagation()} onChange={() => setChecked((s) => { const n = new Set(s); if (n.has(r.idx)) n.delete(r.idx); else n.add(r.idx); return n; })} /> },
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => firstNo - i },
    { key: 'resDate', header: tr('예약일자', 'Scheduled at'), nowrap: true, render: (r) => r.resDate ?? '' },
    { key: 'companyName', header: tr('사업주', 'Company'), render: (r) => r.companyName ?? '' },
    { key: 'name', header: tr('회원명', 'Name'), render: (r) => r.name ?? '' },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <MemberLink id={r.id} /> },
    { key: 'mobile', header: tr('연락처', 'Mobile'), nowrap: true, render: (r) => r.mobile ?? '' },
  ];
  return (
    <AdminPage title={tr('예약문자발송', 'Scheduled SMS')} lead={tr('아직 발송되지 않은 예약 문자(SmsRes, SendYN=N)입니다. 예약 시각이 되면 기존 사이트의 발송기가 보내고 목록에서 사라집니다. 학습참여독려에서 "체크항목 문자 예약 발송"으로 등록합니다.', 'Reserved SMS not yet sent (SmsRes, SendYN=N). The legacy scheduler sends them at the chosen time; create them from Study nudges.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ from: '', to: '', col: 'name', q: '' }); reset(); }}
        extra={<><AButton onClick={() => void exportCsv()} loading={exporting} disabled={!list.data || total === 0}>{tr('검색항목 엑셀(CSV) 출력', 'Export CSV')}</AButton><AButton variant="danger" disabled={!canWrite || checked.size === 0} title={readOnlyTitle} onClick={() => setDelOpen(true)}>{tr('체크항목 삭제', 'Delete checked')}</AButton></>}>
        <FilterField label={tr('조회기간 시작', 'From')} htmlFor="sr-from" width={160}><DateField id="sr-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} /></FilterField>
        <FilterField label={tr('조회기간 종료', 'To')} htmlFor="sr-to" width={160}><DateField id="sr-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} /></FilterField>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="sr-col" width={130}><ASelect id="sr-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={COLS} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="sr-q" width={240}><AInput id="sr-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 발송내역이 없습니다.', 'No reservations.')} dense />
      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={tr('예약 문자', 'Reserved message')} subtitle={sel ? `${sel.name ?? ''} (${sel.id ?? ''}) · ${sel.resDate ?? ''}` : ''}
        footer={<><AButton onClick={() => setSel(null)}>{adm.common.close}</AButton><AButton variant="danger" disabled={!canWrite} title={readOnlyTitle} onClick={() => { if (sel) { setChecked(new Set([sel.idx])); setDelOpen(true); } }}>{adm.common.delete}</AButton></>}>
        {sel ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DescList items={[[tr('예약일자', 'Scheduled at'), sel.resDate], [tr('사업주', 'Company'), sel.companyName], [tr('회원', 'Member'), `${sel.name ?? ''} (${sel.id ?? ''})`], [tr('연락처', 'Mobile'), sel.mobile], [tr('수강 Seq', 'Study seq'), sel.studySeq === null ? '-' : String(sel.studySeq)], [tr('등록자 / 등록일', 'Created by / at'), `${sel.inputId ?? ''} · ${sel.regDate ?? ''}`]]} />
          <MessageBlock text={sel.message} />
        </div> : null}
      </DetailDrawer>
      <ConfirmDialog open={delOpen} title={tr('예약 문자 삭제', 'Delete reservations')} tone="danger" loading={del.isPending} onCancel={() => setDelOpen(false)} onConfirm={() => del.mutate(undefined as never)}
        body={<div><p>{tr(`선택한 ${checked.size}건의 예약을 삭제합니다. 삭제 후에는 되돌릴 수 없습니다.`, `Delete ${checked.size} reservation(s). This cannot be undone.`)}</p><Callout tone="warn">{tr('기존 사이트와 같이 SmsRes 행이 바로 삭제됩니다(예약 취소).', 'Rows are removed from SmsRes immediately, as on the legacy site.')}</Callout></div>} />
    </AdminPage>
  );
}
