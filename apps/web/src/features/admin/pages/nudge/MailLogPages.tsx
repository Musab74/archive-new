import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminNudgeApi, type MailRow, type ManagerMailRow } from '../../../../shared/api/endpoints/admin-nudge';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, DataTable, DescList, DetailDrawer, FilterBar, FilterField, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { MemberLink, MessageBlock, clip } from './nudgeShared';

const DEFAULTS = { col: 'name', q: '', page: 1 };
const SIZE = 20;
const statusBadge = (r: { code?: string | null; status: string }) => <StatusBadge tone={r.code === 'Y' ? 'ok' : 'neutral'}>{r.status}</StatusBadge>;

/** study_email_log_for_edumanager.php — 메일발송내역(교육담당자) (C3). */
export function ManagerMailLogPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'nudge', 'manager-mail-log', query], queryFn: ({ signal }) => adminNudgeApi.managerMailLog(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const [sel, setSel] = useState<ManagerMailRow | null>(null);
  const columns: Column<ManagerMailRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'eduManager', header: tr('교육담당자', 'Training manager'), nowrap: true, render: (r) => r.eduManager ?? '' },
    { key: 'email', header: tr('이메일', 'E-mail'), nowrap: true, render: (r) => r.email ?? '' },
    { key: 'companyName', header: tr('사업주', 'Company'), render: (r) => r.companyName },
    { key: 'messageText', header: tr('발송내용', 'Message'), render: (r) => <span title={r.title ?? ''}>{clip(r.messageText, 80)}</span> },
    { key: 'regDate', header: tr('발송일', 'Sent at'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', render: statusBadge },
  ];
  return (
    <AdminPage title={tr('메일발송내역 (교육담당자)', 'Mail log (training managers)')} lead={tr('교육담당자에게 보낸 메일 로그(EmailSendLogForEduManager)입니다. 상태 "수신"은 수신자가 메일을 연 경우입니다.', 'Mails sent to company training managers (EmailSendLogForEduManager). "수신" means the recipient opened the mail.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'name', q: '' }); reset(); }}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="mm-col" width={150}><ASelect id="mm-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'name', label: tr('교육담당자', 'Manager name') }, { value: 'id', label: tr('이메일', 'E-mail') }, { value: 'company', label: tr('사업주명', 'Company') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="mm-q" width={260}><AInput id="mm-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 발송내역이 없습니다.', 'No records.')} dense />
      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={sel?.title || tr('메일 내용', 'Mail')} subtitle={sel ? `${sel.eduManager ?? ''} · ${sel.email ?? ''} · ${sel.regDate ?? ''}` : ''} wide footer={<AButton onClick={() => setSel(null)}>{adm.common.close}</AButton>}>
        {sel ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><DescList cols={2} items={[[tr('사업주', 'Company'), `${sel.companyName} (${sel.companyCode ?? '-'})`], [tr('상태', 'Status'), sel.status], [tr('수신일', 'Opened at'), sel.reciveDate ?? '-'], [tr('발송자', 'Sent by'), sel.inputId ?? '-']]} /><MessageBlock text={sel.messageText} maxHeight={480} /></div> : null}
      </DetailDrawer>
    </AdminPage>
  );
}

/** study_email_log.php — 메일발송내역(훈련생) (C4). */
export function LearnerMailLogPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ col: p.col, q: p.q });
  const { toast } = useToast();
  const query = useMemo(() => ({ col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'nudge', 'mail-log', query], queryFn: ({ signal }) => adminNudgeApi.mailLog(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0; const firstNo = total - (p.page - 1) * SIZE;
  const [sel, setSel] = useState<MailRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try { await adminNudgeApi.downloadMailLogCsv({ col: query.col, q: query.q }); }
    catch (err) { toast(isAppError(err) ? err.message : tr('목록을 내려받지 못했습니다.', 'Download failed.'), { tone: 'danger' }); }
    finally { setExporting(false); }
  };
  const columns: Column<MailRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'eduManager', header: tr('교육담당자', 'Training manager'), nowrap: true, render: (r) => r.eduManager ?? '' },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <MemberLink id={r.id} /> },
    { key: 'name', header: tr('이름', 'Name'), nowrap: true, render: (r) => <MemberLink id={r.id}>{r.name ?? ''}</MemberLink> },
    { key: 'email', header: tr('이메일', 'E-mail'), nowrap: true, render: (r) => r.email ?? '' },
    { key: 'companyName', header: tr('사업주', 'Company'), render: (r) => r.companyName },
    { key: 'messageText', header: tr('발송내용', 'Message'), render: (r) => <span title={r.title ?? ''}>{clip(r.messageText, 80)}</span> },
    { key: 'regDate', header: tr('발송일', 'Sent at'), nowrap: true, render: (r) => r.regDate ?? '' },
    { key: 'status', header: tr('상태', 'Status'), align: 'center', render: statusBadge },
  ];
  return (
    <AdminPage title={tr('메일발송내역(훈련생)', 'Mail log (learners)')} lead={tr('훈련생에게 보낸 메일 로그(EmailSendLog)입니다. 상태 "수신"은 수신자가 메일을 연 경우입니다.', 'Mails sent to learners (EmailSendLog). "수신" means the recipient opened the mail.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ col: 'name', q: '' }); reset(); }} extra={<AButton onClick={() => void exportCsv()} loading={exporting} disabled={!list.data || total === 0}>{tr('검색항목 엑셀(CSV) 출력', 'Export CSV')}</AButton>}>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="lm-col" width={150}><ASelect id="lm-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'name', label: tr('이름', 'Name') }, { value: 'id', label: tr('아이디', 'User ID') }, { value: 'company', label: tr('사업주명', 'Company') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="lm-q" width={260}><AInput id="lm-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></FilterField>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} onRowClick={setSel} selectedKey={sel?.idx ?? null} emptyTitle={tr('등록된 발송내역이 없습니다.', 'No records.')} dense />
      <DetailDrawer open={!!sel} onClose={() => setSel(null)} title={sel?.title || tr('메일 내용', 'Mail')} subtitle={sel ? `${sel.name ?? ''} (${sel.id ?? ''}) · ${sel.email ?? ''} · ${sel.regDate ?? ''}` : ''} wide footer={<AButton onClick={() => setSel(null)}>{adm.common.close}</AButton>}>
        {sel ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><DescList cols={2} items={[[tr('사업주', 'Company'), `${sel.companyName} (${sel.companyCode ?? '-'})`], [tr('수강 Seq', 'Study seq'), sel.studySeq === null ? '-' : String(sel.studySeq)], [tr('상태', 'Status'), sel.status], [tr('수신일', 'Opened at'), sel.reciveDate ?? '-'], [tr('발송자', 'Sent by'), sel.inputId ?? '-']]} /><MessageBlock text={sel.messageText} maxHeight={480} /></div> : null}
      </DetailDrawer>
    </AdminPage>
  );
}
