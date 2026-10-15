import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { PrivacyLogRow } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, DataTable, DateField, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { useWriteGate } from '../../GrantGate';
import { adm } from '../../strings';
import { staffParityApi } from './staffApi';

const DEFAULTS = { col: 'Name', q: '', from: '', to: '', page: 1 };
/** include_top.php $page_size = 30. */
const SIZE = 30;

/** read_reason.php — InformationProtectionLog (who looked at whose personal data, and why). */
export default function PrivacyLogPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q, from: p.from, to: p.to });
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, from: p.from || undefined, to: p.to || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'privacy-log', query], queryFn: ({ signal }) => adminApi.privacyLog(query, signal), placeholderData: keepPreviousData });
  const { canWrite } = useWriteGate();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  /** read_reason_excel.php: the applied search (col/sw + 기간), every row. Hidden for 영업(B) accounts like $AdminWrite. */
  const exportCsv = async () => { setExporting(true); try { await staffParityApi.downloadPrivacyCsv({ col: p.col, q: p.q || undefined, from: p.from || undefined, to: p.to || undefined }); } catch (err) { toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); } finally { setExporting(false); } };
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const columns: Column<PrivacyLogRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'target', header: tr('열람대상자', 'Subject'), nowrap: true, render: (r) => r.targetId ? <Link to={`/admin/members/${encodeURIComponent(r.targetId)}`}>{r.targetName ?? ''} ({r.targetId})</Link> : '' },
    { key: 'adminId', header: tr('열람자', 'Viewed by'), nowrap: true, render: (r) => <b>{r.adminId ?? ''}</b> },
    { key: 'reason', header: tr('열람사유', 'Reason'), render: (r) => r.reason ?? '' },
    { key: 'field', header: tr('열람구분', 'Field'), nowrap: true, render: (r) => r.field ?? '' },
    { key: 'gubun', header: tr('구분', 'Kind'), align: 'center', render: (r) => r.gubun ?? '' },
    { key: 'at', header: tr('열람일', 'Viewed at'), nowrap: true, render: (r) => r.at ?? '' },
  ];
  return (
    <AdminPage title={tr('개인정보 열람내역', 'Personal-data access log')} lead={tr('관리자가 회원의 개인정보를 열람한 기록(InformationProtectionLog)입니다.', 'Records of operators viewing member personal data (InformationProtectionLog).')}
      actions={canWrite ? <AButton icon="download" loading={exporting} onClick={() => void exportCsv()}>{tr('검색항목 엑셀 출력', 'Export search results')}</AButton> : undefined}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'Name', q: '', from: '', to: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="pl-col" width={170}><ASelect id="pl-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'Name', label: tr('열람대상자 (이름)', 'Subject (name)') }, { value: 'ID', label: tr('열람대상자 (아이디)', 'Subject (ID)') }, { value: 'AdminID', label: tr('열람자', 'Viewed by') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="pl-q" width={220}><AInput id="pl-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
        <FilterField label={tr('열람일 시작', 'From')} htmlFor="pl-from" width={160}><DateField id="pl-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} /></FilterField>
        <FilterField label={tr('열람일 종료', 'To')} htmlFor="pl-to" width={160}><DateField id="pl-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('열람된 기록이 없습니다.', 'No access records.')} dense />
    </AdminPage>
  );
}
