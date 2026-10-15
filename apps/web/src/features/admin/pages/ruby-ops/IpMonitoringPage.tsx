import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminRubyOpsApi, type IpQueueRow, type IpScanResult } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, Card, DataTable, DateField, FilterBar, FilterField, Kpi, StatusBadge, toIsoDate, type Column } from '../../../../shared/ui/admin';
import { isAppError } from '../../../../shared/api/client';
import { tr } from '../../../../shared/i18n/adminLang';
import { useToast } from '../../../../app/providers/ToastProvider';
import { LEGACY_ADMIN_BASE } from '../../../../shared/auth/adminMenu';
import { useWriteGate } from '../../GrantGate';
import { useAdminMutation } from '../../useAdminMutation';
import { adm } from '../../strings';
import { DeptAGate } from './rubyAccess';

const DEFAULTS = { from: '', to: '', issue: '', companyCode: '', companyQ: '', severity: '', sort: 'severity' };
const SEV_TONE: Record<string, 'danger' | 'warn' | 'info' | 'neutral'> = { CRIT: 'danger', HIGH: 'warn', MED: 'info', LOW: 'neutral' };
const SORTS = [['severity', '등급순', 'By severity'], ['type', '유형별', 'By type'], ['company', '사업장별', 'By company'], ['same_ip', '같은 IP끼리', 'Same IP together'], ['date', '최근 탐지일', 'Latest first'], ['id', '수강생 아이디', 'By learner ID']] as const;
const plusDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/**
 * "IP조회" — abnormal_data_dashboard.php opened study_ip.php?ID=…&ip_addr=… (전체 월, 상세 보기, searched at once). The ported page is
 * /admin/learning/ip-monitor; viewMode=detail must be in the URL because that page queries with p.viewMode (default "group").
 */
export const studyIpUrl = (id: string, ip: string) => `/admin/learning/ip-monitor?${new URLSearchParams({ id, ...(ip ? { ip } : {}), viewMode: 'detail' }).toString()}`;
/** ../docs/archive_monitoring/IP모니터링/IP모니터링_기획안.html of the legacy site (the 기획안 link in the PHP footer). */
export const IP_PLAN_URL = new URL('../docs/archive_monitoring/IP모니터링/IP모니터링_기획안.html', `${LEGACY_ADMIN_BASE}/`).toString();
/** Group key of the separator rows the PHP list draws when sorted by IP (same_ip) or by company. */
export function groupBreaks(rows: readonly IpQueueRow[], sort: string): Set<number> {
  const out = new Set<number>();
  if (sort !== 'same_ip' && sort !== 'company') return out;
  let prev: string | null = null;
  rows.forEach((r, i) => {
    const key = sort === 'same_ip' ? r.ip : (r.company.code || r.company.label);
    if (prev !== null && key !== prev) out.add(i);
    prev = key;
  });
  return out;
}
const yesterday = () => toIsoDate(plusDays(new Date(), -1));

/** abnormal_data_dashboard.php — IP 모니터링 (dept A): counts, help, the 7 manual IP rules, the review queue, CSV, report, 다시 집계. */
function IpMonitoringPageInner() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ ...p });
  const { toast } = useToast();
  const { canWrite, readOnlyTitle } = useWriteGate();
  const qc = useQueryClient();
  const range = useMemo(() => ({ from: p.from || undefined, to: p.to || undefined }), [p.from, p.to]);
  const summary = useQuery({ queryKey: ['admin', 'monitoring', 'ip', 'summary', range], queryFn: ({ signal }) => adminRubyOpsApi.ipSummary(range, signal), placeholderData: keepPreviousData });
  const filters = useMemo(() => ({ ...range, issue: p.issue || undefined, companyCode: p.companyCode || undefined, companyQ: p.companyCode ? undefined : p.companyQ || undefined, severity: p.severity || undefined, sort: p.sort }), [range, p]);
  const queue = useQuery({ queryKey: ['admin', 'monitoring', 'ip', 'queue', filters], queryFn: ({ signal }) => adminRubyOpsApi.ipQueue(filters, signal), placeholderData: keepPreviousData });
  const [downloading, setDownloading] = useState<'' | 'csv' | 'report'>('');
  const download = async (kind: 'csv' | 'report') => {
    setDownloading(kind);
    try { await (kind === 'csv' ? adminRubyOpsApi.downloadIpCsv(filters) : adminRubyOpsApi.downloadIpReport(filters)); }
    catch { toast(kind === 'csv' ? tr('목록을 내려받지 못했습니다.', 'Download failed.') : tr('보고서를 내려받지 못했습니다.', 'Report download failed.'), { tone: 'danger' }); }
    finally { setDownloading(''); }
  };
  const [scanDate, setScanDate] = useState(yesterday());
  const [flash, setFlash] = useState<string | null>(null);
  const scan = useAdminMutation({
    fn: (date: string) => adminRubyOpsApi.ipScan({ date: date || undefined }),
    onSuccess: (r: IpScanResult) => { setFlash(r.message); if (r.ok) void qc.invalidateQueries({ queryKey: ['admin', 'monitoring', 'ip'] }); },
    onError: (e) => setFlash(isAppError(e) ? e.message : adm.common.failed),
  });
  const quick = (days: number) => { const to = new Date(); setForm({ ...form, from: toIsoDate(plusDays(to, -(days - 1))), to: toIsoDate(to) }); };
  const s = summary.data; const d = queue.data;
  const sameIp = p.sort === 'same_ip';
  const breaks = useMemo(() => groupBreaks(d?.items ?? [], p.sort), [d, p.sort]);
  const columns: Column<IpQueueRow>[] = useMemo(() => {
    // separator before a new IP / company group (PHP: a 6px row with a 2px top border) — a marker the scoped :has() rule styles
    const brk = (r: IpQueueRow, node: ReactNode) => (breaks.has(d?.items.indexOf(r) ?? -1) ? <><span className="ipq-break" data-testid="ipq-break" aria-hidden="true" />{node}</> : node);
    return [
      { key: 'detectDate', header: tr('일자', 'Date'), nowrap: true, width: 96, render: (r) => brk(r, r.detectDate) },
      { key: 'severity', header: tr('등급', 'Severity'), align: 'center', width: 64, render: (r) => <StatusBadge tone={SEV_TONE[r.severity] ?? 'neutral'}>{r.severityLabel}</StatusBadge> },
      ...(sameIp ? [{ key: 'ip', header: 'IP', nowrap: true, render: (r: IpQueueRow) => <span className="mono">{r.ip || '-'}</span> } as Column<IpQueueRow>] : []),
      { key: 'issueLabel', header: tr('유형', 'Type'), render: (r) => <span title={r.issueCode}>{r.issueLabel}</span> },
      { key: 'company', header: tr('사업장', 'Company'), render: (r) => r.company.label || '-' },
      { key: 'id', header: tr('수강생', 'Learner'), nowrap: true, render: (r) => <Link to={`/admin/members/${encodeURIComponent(r.id)}`}>{r.id}</Link> },
      { key: 'lectureCode', header: tr('과정', 'Course'), nowrap: true, render: (r) => r.studySeq ? <Link to={`/admin/studies/${r.studySeq}`}>{r.lectureCode ?? r.studySeq}</Link> : r.lectureCode ?? '' },
      { key: 'sample', header: tr('내용', 'Detail'), render: (r) => r.sample ?? '' },
      { key: 'check', header: tr('IP조회', 'IP lookup'), align: 'center', width: 70, render: (r) => <Link to={studyIpUrl(r.id, r.ip)}>{tr('IP조회', 'Open')}</Link> },
    ];
  }, [sameIp, breaks, d]);
  return (
    <AdminPage title={tr('IP 모니터링', 'IP monitoring')} lead={tr('자동 검출 요약입니다. 목록에 나왔다고 부정이 아니며 확인용입니다. 학습·수료 숫자는 바꾸지 않습니다.', 'Automatic detection summary for review only; appearing here is not proof of misconduct. No learning numbers are changed.')}
      actions={<><AButton onClick={() => void download('csv')} loading={downloading === 'csv'} disabled={!d}>{tr('엑셀 받기', 'Download CSV')}</AButton><AButton onClick={() => void download('report')} loading={downloading === 'report'} disabled={!d}>{tr('보고서 받기', 'Download report')}</AButton></>}>
      {flash ? <Callout tone={scan.data && !scan.data.ok ? 'warn' : 'ok'} className="u-mb-8"><strong>{flash}</strong></Callout> : null}
      <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>{tr('조회 기간', 'Period')}: {s ? `${s.from} ~ ${s.to}` : '…'} ({tr('기본: 최근 7일', 'default: last 7 days')})</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Kpi label={tr('긴급', 'Critical')} value={s?.counts.CRIT} tone={s?.counts.CRIT ? 'warn' : undefined} />
        <Kpi label={tr('주의', 'Warning')} value={s?.counts.HIGH} tone={s?.counts.HIGH ? 'warn' : undefined} />
        <Kpi label={tr('의심', 'Suspicious')} value={s?.counts.MED} />
        <Kpi label={tr('참고', 'Reference')} value={s?.counts.LOW} />
      </div>
      <ul className="muted" style={{ fontSize: 12, margin: '8px 0 12px', paddingLeft: 18, lineHeight: 1.7 }}>
        <li>{tr('표에 요약이 나옵니다. 깊게 볼 때는 ', 'The table is a summary. For the raw data open ')}<strong>{tr('IP조회', 'IP lookup')}</strong>{tr('로 기존 IP모니터링(원자료)을 엽니다.', ' (IP monitoring raw data).')}</li>
        <li><strong>{tr('유형', 'Type')}</strong>·<strong>{tr('사업장', 'Company')}</strong>{tr('으로 걸러 보고, 정렬로 유형별·사업장별 묶음을 볼 수 있습니다.', ' filter the list; sorting groups it by type or company.')}</li>
        <li>{tr('기본 목록 = ', 'Default list = ')}<strong>{tr('주의', 'warning')}</strong> ({tr(`${s?.counts.HIGH ?? 0}건`, `${s?.counts.HIGH ?? 0}`)}) · {tr('의심·참고는 등급에서 조회', 'choose a severity for suspicious / reference')}</li>
        <li>{tr('엑셀·보고서는 지금 필터와 같은 조건으로 받습니다.', 'CSV and report use the current filters.')}</li>
      </ul>
      <Card className="u-mb-8" title={<span style={{ fontSize: 14 }}>{tr('IP 조건 (매뉴얼 7건)', 'IP rules (manual, 7)')} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {tr('조건 검증 중 · 목록에 떴다고 부정은 아님', 'under validation · listed ≠ misconduct')}</span></span>}>
        <DataTable columns={[{ key: 'label', header: tr('유형', 'Type'), render: (r: NonNullable<typeof s>['issueTypes'][number]) => r.label }, { key: 'severityLabel', header: tr('등급', 'Severity'), align: 'center', width: 70 }, { key: 'explain', header: tr('설명', 'Explanation'), render: (r) => <span style={{ fontSize: 12 }}>{r.explain}</span> }]} rows={s?.issueTypes} rowKey={(r) => r.code} dense />
        <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>{tr('⑤ 훈련기관 IP는 서버에 대상 IP 목록을 등록해야 잡힙니다. 비어 있으면 해당 항목은 건너뜁니다.', 'Rule ⑤ needs the institution IP list configured on the server; otherwise it is skipped.')}</p>
      </Card>
      <h3 style={{ margin: '12px 0 8px', fontSize: 15 }}>{tr('확인 목록', 'Review queue')}</h3>
      <FilterBar onSubmit={() => setP(form)} onReset={() => { setForm({ ...DEFAULTS }); reset(); }}
        extra={<span style={{ display: 'inline-flex', gap: 6 }}><AButton size="sm" onClick={() => quick(7)}>{tr('최근 7일', 'Last 7 days')}</AButton><AButton size="sm" onClick={() => quick(30)}>{tr('최근 30일', 'Last 30 days')}</AButton></span>}>
        <FilterField label={tr('조회기간', 'Period')} wide><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><DateField aria-label={tr('시작일', 'From')} value={form.from} onChange={(v) => setForm({ ...form, from: v })} /> ~ <DateField aria-label={tr('종료일', 'To')} value={form.to} onChange={(v) => setForm({ ...form, to: v })} /></div></FilterField>
        <FilterField label={tr('유형', 'Type')} htmlFor="ip-issue" width={260}><ASelect id="ip-issue" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} options={[{ value: '', label: tr('전체 유형', 'All types') }, ...(s?.issueTypes ?? []).map((t) => ({ value: t.code, label: t.label }))]} /></FilterField>
        <FilterField label={tr('사업장', 'Company')} htmlFor="ip-co" width={220}><ASelect id="ip-co" value={form.companyCode} onChange={(e) => setForm({ ...form, companyCode: e.target.value })} options={[{ value: '', label: tr('전체 사업장', 'All companies') }, ...(s?.companies ?? []).map((c) => ({ value: c.code, label: `${c.name || c.code} (${c.count})` }))]} /></FilterField>
        <FilterField label={tr('사업장검색', 'Company search')} htmlFor="ip-coq" width={160}><AInput id="ip-coq" value={form.companyQ} onChange={(e) => setForm({ ...form, companyQ: e.target.value })} placeholder={tr('사업장명·코드', 'name / code')} /></FilterField>
        <FilterField label={tr('등급', 'Severity')} htmlFor="ip-sev" width={140}><ASelect id="ip-sev" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} options={[{ value: '', label: tr('주의 (기본)', 'Warning (default)') }, { value: 'CRIT', label: tr('긴급', 'Critical') }, { value: 'HIGH', label: tr('주의', 'Warning') }, { value: 'MED', label: tr('의심', 'Suspicious') }, { value: 'LOW', label: tr('참고', 'Reference') }]} /></FilterField>
        <FilterField label={tr('정렬', 'Sort')} htmlFor="ip-sort" width={160}><ASelect id="ip-sort" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} options={SORTS.map(([v, ko, en]) => ({ value: v, label: tr(ko, en) }))} /></FilterField>
      </FilterBar>
      <style>{'.ipq tr:has(.ipq-break) > td { border-top: 2px solid #d0d7de; } .ipq-break { display: none; }'}</style>
      <div className="ipq">
        <DataTable columns={columns} rows={d?.items} rowKey={(r) => r.idx} loading={queue.isPending || queue.isFetching} error={queue.error ?? summary.error} onRetry={() => { void queue.refetch(); void summary.refetch(); }} size={500} emptyTitle={tr('지금 확인할 건이 없습니다.', 'Nothing to review right now.')} caption={d ? tr(`${d.items.length}건 표시 (최대 ${d.limit}건)`, `${d.items.length} rows shown (limit ${d.limit})`) : undefined} dense />
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '16px 0 4px' }}>{tr('표에 나온 건은 확인용입니다. 학습·수료 숫자는 바꾸지 않습니다.', 'Listed rows are for review only; learning and completion numbers are not changed.')} · <a href={IP_PLAN_URL} target="_blank" rel="noreferrer">{tr('기획안', 'Plan document')}</a></p>
      <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <DateField aria-label={tr('집계 기준일', 'Scan date')} value={scanDate} onChange={setScanDate} />
        <AButton size="sm" loading={scan.isPending} disabled={!canWrite} title={readOnlyTitle} onClick={() => scan.mutate(scanDate)}>{tr('다시 집계', 'Re-scan')}</AButton>
        <span>({tr('목록이 비어 있을 때만 · 5분에 한 번', 'only when the list is empty · once per 5 minutes')})</span>
        <span>{adm.common.total(d?.items.length ?? 0)}</span>
      </div>
    </AdminPage>
  );
}

export default function IpMonitoringPage() {
  return <DeptAGate><IpMonitoringPageInner /></DeptAGate>;
}
