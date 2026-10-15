import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminSiteCmsApi } from '../../../../shared/api/endpoints/admin-site-cms';
import type { BackupRow } from '../../../../shared/api/endpoints/admin-site-cms';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, DataTable, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { useWriteGate } from '../../GrantGate';
import { adm } from '../../strings';
import { LEGACY_PAGE_SIZE, rowNumber } from './siteCms.helpers';

const DEFAULTS = { q: '', page: 1 };
const SIZE = LEGACY_PAGE_SIZE; // include_top.php $page_size = 30

/** backup_list.php / backup_list_excel.php — 사이트관리 > 백업 목록 (G3). Read-only; the table is filled by the 08:10 backup batch. */
export default function BackupsPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ q: p.q });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const query = useMemo(() => ({ col: 'reg_date', q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'backups', query], queryFn: ({ signal }) => adminSiteCmsApi.backups(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const [exporting, setExporting] = useState(false);
  /** *_excel.php: .xlsx with the current search, no row cap; a search with no rows still downloads the header row. */
  const exportXlsx = async () => {
    setExporting(true);
    try { await adminSiteCmsApi.downloadBackupsXlsx({ col: 'reg_date', q: query.q }); }
    catch (e) { toast(isAppError(e) ? e.message : adm.common.failed, { tone: 'danger' }); }
    finally { setExporting(false); }
  };
  const mono = (v: string | null | undefined) => <span className="mono" style={{ fontSize: 12 }}>{v ?? ''}</span>;
  const columns: Column<BackupRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => rowNumber(total, p.page, SIZE, i) },
    { key: 'regDay', header: tr('백업일자', 'Backup date'), nowrap: true, render: (r) => r.regDay ?? '' },
    { key: 'backupType', header: tr('백업수단', 'Method'), nowrap: true, render: (r) => r.backupType ?? '' },
    { key: 'backupInterval', header: tr('백업주기', 'Interval'), nowrap: true, render: (r) => r.backupInterval ?? '' },
    { key: 'expiryDay', header: tr('보관만료일', 'Expires'), nowrap: true, render: (r) => r.expiryDay ?? '' },
    { key: 'webFile', header: tr('백업_WebSource', 'WebSource'), render: (r) => mono(r.webFile) },
    { key: 'weblogFile', header: tr('백업_WebLog', 'WebLog'), render: (r) => mono(r.weblogFile) },
    { key: 'dbFile', header: tr('백업_DB', 'DB'), render: (r) => mono(r.dbFile) },
    { key: 'vodFile', header: tr('백업_VOD', 'VOD'), render: (r) => mono(r.vodFile) },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
  ];
  return (
    <AdminPage title={tr('백업 목록', 'Backups')} lead={tr('서버 백업 로그(backup_data_list)입니다. 조회 전용입니다.', 'Server backup log (backup_data_list). Read-only.')}>
      <Callout>{tr('* 백업 리스트는 매일 오전 08:10 업데이트', '* The backup list is updated daily at 08:10.')}</Callout>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ q: '' }); reset(); }}
        extra={<AButton onClick={() => void exportXlsx()} loading={exporting} disabled={!canWrite} title={readOnlyTitle}>{tr('검색항목 엑셀 출력', 'Export to Excel')}</AButton>}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="bk-col" width={130}><ASelect id="bk-col" value="reg_date" onChange={() => undefined} options={[{ value: 'reg_date', label: tr('백업일자', 'Backup date') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="bk-q" width={260}><AInput id="bk-q" value={form.q} placeholder={tr('검색어를 입력하세요 (예: 2026-10)', 'e.g. 2026-10')} onChange={(e) => setForm({ q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('등록된 백업 목록이 없습니다.', 'No backups.')} dense />
    </AdminPage>
  );
}
