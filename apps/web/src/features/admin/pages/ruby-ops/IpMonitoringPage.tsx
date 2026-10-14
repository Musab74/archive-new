import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminRubyOpsApi, type IpQueueRow } from '../../../../shared/api/endpoints/admin-ruby-ops';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, Card, DataTable, DateField, FilterBar, FilterField, Kpi, StatusBadge, toIsoDate, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { useToast } from '../../../../app/providers/ToastProvider';
import { legacyUrl } from '../../../../shared/auth/adminMenu';
import { adm } from '../../strings';

const DEFAULTS = { from: '', to: '', issue: '', companyCode: '', companyQ: '', severity: '', sort: 'severity' };
const SEV_TONE: Record<string, 'danger' | 'warn' | 'info' | 'neutral'> = { CRIT: 'danger', HIGH: 'warn', MED: 'info', LOW: 'neutral' };
const SORTS = [['severity', '등급순', 'By severity'], ['type', '유형별', 'By type'], ['company', '사업장별', 'By company'], ['same_ip', '같은 IP끼리', 'Same IP together'], ['date', '최근 탐지일', 'Latest first'], ['id', '수강생 아이디', 'By learner ID']] as const;
const plusDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** study_ip.php?ID=…&ip_addr=… — the legacy raw IP page the dashboard's "IP조회" link opens. */
export const studyIpUrl = (id: string, ip: string) => legacyUrl(`study_ip.php?ID=${encodeURIComponent(id)}${ip ? `&ip_addr=${encodeURIComponent(ip)}` : ''}`);

/** abnormal_data_dashboard.php — IP 모니터링 (dept A): counts, the 7 manual IP rules, the review queue, CSV. */
export default function IpMonitoringPage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ ...p });
  const { toast } = useToast();
  const range = useMemo(() => ({ from: p.from || undefined, to: p.to || undefined }), [p.from, p.to]);
  const summary = useQuery({ queryKey: ['admin', 'monitoring', 'ip', 'summary', range], queryFn: ({ signal }) => adminRubyOpsApi.ipSummary(range, signal), placeholderData: keepPreviousData });
  const filters = useMemo(() => ({ ...range, issue: p.issue || undefined, companyCode: p.companyCode || undefined, companyQ: p.companyCode ? undefined : p.companyQ || undefined, severity: p.severity || undefined, sort: p.sort }), [range, p]);
  const queue = useQuery({ queryKey: ['admin', 'monitoring', 'ip', 'queue', filters], queryFn: ({ signal }) => adminRubyOpsApi.ipQueue(filters, signal), placeholderData: keepPreviousData });
  const [downloading, setDownloading] = useState(false);
  const download = async () => { setDownloading(true); try { await adminRubyOpsApi.downloadIpCsv(filters); } catch { toast(tr('목록을 내려받지 못했습니다.', 'Download failed.'), { tone: 'danger' }); } finally { setDownloading(false); } };
  const quick = (days: number) => { const to = new Date(); setForm({ ...form, from: toIsoDate(plusDays(to, -(days - 1))), to: toIsoDate(to) }); };
  const s = summary.data; const d = queue.data;
  const sameIp = p.sort === 'same_ip';
  const columns: Column<IpQueueRow>[] = useMemo(() => [
    { key: 'detectDate', header: tr('일자', 'Date'), nowrap: true, width: 96 },
    { key: 'severity', header: tr('등급', 'Severity'), align: 'center', width: 64, render: (r) => <StatusBadge tone={SEV_TONE[r.severity] ?? 'neutral'}>{r.severityLabel}</StatusBadge> },
    ...(sameIp ? [{ key: 'ip', header: 'IP', nowrap: true, render: (r: IpQueueRow) => <span className="mono">{r.ip || '-'}</span> } as Column<IpQueueRow>] : []),
    { key: 'issueLabel', header: tr('유형', 'Type'), render: (r) => <span title={r.issueCode}>{r.issueLabel}</span> },
    { key: 'company', header: tr('사업장', 'Company'), render: (r) => r.company.label || '-' },
    { key: 'id', header: tr('수강생', 'Learner'), nowrap: true, render: (r) => <Link to={`/admin/members/${encodeURIComponent(r.id)}`}>{r.id}</Link> },
    { key: 'lectureCode', header: tr('과정', 'Course'), nowrap: true, render: (r) => r.studySeq ? <Link to={`/admin/studies/${r.studySeq}`}>{r.lectureCode ?? r.studySeq}</Link> : r.lectureCode ?? '' },
    { key: 'sample', header: tr('내용', 'Detail'), render: (r) => r.sample ?? '' },
    { key: 'check', header: tr('IP조회', 'IP lookup'), align: 'center', width: 70, render: (r) => <a href={studyIpUrl(r.id, r.ip)} target="_blank" rel="noreferrer">{tr('IP조회', 'Open')}</a> },
  ], [sameIp]);
  return (
    <AdminPage title={tr('IP 모니터링', 'IP monitoring')} lead={tr('자동 검출 요약입니다. 목록에 나왔다고 부정이 아니며 확인용입니다. 학습·수료 숫자는 바꾸지 않습니다.', 'Automatic detection summary for review only; appearing here is not proof of misconduct. No learning numbers are changed.')}
      actions={<><AButton onClick={download} loading={downloading} disabled={!d}>{tr('엑셀 받기 (CSV)', 'Download CSV')}</AButton><AButton onClick={() => window.print()} disabled={!d}>{tr('보고서 인쇄', 'Print report')}</AButton></>}>
      <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>{tr('조회 기간', 'Period')}: {s ? `${s.from} ~ ${s.to} (${s.days}${tr('일', ' days')})` : '…'} · {tr('기본: 최근 7일 · 기본 목록 = 긴급+주의 · 의심·참고는 등급에서 조회', 'default: last 7 days · default list = critical + warning · choose a severity to see the rest')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <Kpi label={tr('긴급', 'Critical')} value={s?.counts.CRIT} tone={s?.counts.CRIT ? 'warn' : undefined} />
        <Kpi label={tr('주의', 'Warning')} value={s?.counts.HIGH} tone={s?.counts.HIGH ? 'warn' : undefined} />
        <Kpi label={tr('의심', 'Suspicious')} value={s?.counts.MED} />
        <Kpi label={tr('참고', 'Reference')} value={s?.counts.LOW} />
      </div>
      <details className="u-mb-8">
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{tr('IP 조건 (매뉴얼 7건) · 조건 검증 중 · 목록에 떴다고 부정은 아님', 'The 7 manual IP rules (under validation)')}</summary>
        <Card className="u-mt-8">
          <DataTable columns={[{ key: 'label', header: tr('유형', 'Type'), render: (r: NonNullable<typeof s>['issueTypes'][number]) => r.label }, { key: 'severityLabel', header: tr('등급', 'Severity'), align: 'center', width: 70 }, { key: 'explain', header: tr('설명', 'Explanation'), render: (r) => <span style={{ fontSize: 12 }}>{r.explain}</span> }]} rows={s?.issueTypes} rowKey={(r) => r.code} dense />
          <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>{tr('⑤ 훈련기관 IP는 서버에 대상 IP 목록을 등록해야 잡힙니다. 비어 있으면 해당 항목은 건너뜁니다.', 'Rule ⑤ needs the institution IP list configured on the server; otherwise it is skipped.')}</p>
        </Card>
      </details>
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
      <DataTable columns={columns} rows={d?.items} rowKey={(r) => r.idx} loading={queue.isPending || queue.isFetching} error={queue.error ?? summary.error} onRetry={() => { void queue.refetch(); void summary.refetch(); }} size={100} emptyTitle={tr('지금 확인할 건이 없습니다.', 'Nothing to review right now.')} caption={d ? tr(`${d.items.length}건 표시 (최대 ${d.limit}건)`, `${d.items.length} rows shown (limit ${d.limit})`) : undefined} dense />
      <Callout className="u-mt-16">{tr('"다시 집계"(abn_run_light_scan)는 기존 관리자 화면에서만 실행됩니다. 이 화면은 저장된 AbnormalDataLog 를 보여 줍니다.', 'The "re-scan" action (abn_run_light_scan) still runs only on the legacy admin page; this screen reads the stored AbnormalDataLog rows.')} · <a href={legacyUrl('abnormal_data_dashboard.php')} target="_blank" rel="noreferrer">abnormal_data_dashboard.php</a> · <span className="muted">{adm.common.total(d?.items.length ?? 0)}</span></Callout>
    </AdminPage>
  );
}
