import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { AbnormalRow, DailyMonitor, OverlapMonitor } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, DataTable, FilterBar, FilterField, JsonViewer, Kpi, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { formatMinutes } from '../../../../shared/utils/format';
import { adm } from '../../strings';

const today = () => new Date().toISOString().slice(0, 10);
const secToMin = (s: number) => formatMinutes(Math.round(s / 60));

// ---------------------------------------------------------------- /admin/monitoring/daily
type DailyItem = DailyMonitor['items'][number];
const dailyCols: Column<DailyItem>[] = [
  { key: 'id', header: '아이디', sortable: true, render: (r) => <Link to={`/admin/members/${encodeURIComponent(r.id)}`}>{r.id}</Link> },
  { key: 'name', header: '이름', sortable: true, render: (r) => r.name ?? '' },
  { key: 'companyName', header: '기업', render: (r) => r.companyName ?? r.companyCode ?? '' },
  { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <Link to={`/admin/studies/${r.studySeq}`}>{r.studySeq}</Link> },
  { key: 'lectureCode', header: '과정', render: (r) => r.lectureCode ?? '' },
  { key: 'seconds', header: '학습', align: 'right', sortable: true, render: (r) => `${r.formatted} (${r.seconds.toLocaleString('ko-KR')}초)` },
  { key: 'creditedSec', header: '인정', align: 'right', render: (r) => secToMin(r.creditedSec) },
  { key: 'excessSec', header: '초과', align: 'right', sortable: true, render: (r) => (r.excessSec ? <span style={{ color: 'var(--c-danger)' }}>{secToMin(r.excessSec)}</span> : '—') },
  { key: 'status', header: '상태', align: 'center', render: (r) => <StatusBadge tone={r.status === 'over' ? 'danger' : r.status === 'cap' ? 'warn' : 'ok'}>{r.statusLabel}</StatusBadge> },
];

export function MonitoringDailyPage() {
  const [p, setP, reset] = useSearchState({ date: '', companyCode: '', status: 'all' });
  const [form, setForm] = useState({ date: p.date || today(), companyCode: p.companyCode, status: p.status });
  const q = useQuery({ queryKey: ['admin', 'monitoring', 'daily', p], queryFn: ({ signal }) => adminApi.monitoringDaily({ date: p.date || undefined, companyCode: p.companyCode || undefined, status: p.status }, signal), placeholderData: keepPreviousData });
  const m = adm.monitoring.daily;
  const d = q.data;
  return (
    <AdminPage title={m.title} lead={m.lead}>
      <FilterBar onSubmit={() => setP(form)} onReset={() => { setForm({ date: today(), companyCode: '', status: 'all' }); reset(); }}>
        <FilterField label={m.date} htmlFor="d-date" width={160}><AInput id="d-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></FilterField>
        <FilterField label={adm.studies.filters.companyCode} htmlFor="d-cc" width={140}><AInput id="d-cc" value={form.companyCode} onChange={(e) => setForm({ ...form, companyCode: e.target.value })} /></FilterField>
        <FilterField label={m.status} htmlFor="d-st" width={140}><ASelect id="d-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={m.statuses} /></FilterField>
      </FilterBar>
      {d ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 10, marginBottom: 12 }}>
          <Kpi label={m.stats.learners} value={d.stats.learners} unit="명" hint={d.date} />
          <Kpi label={m.stats.rows} value={d.stats.rows} unit="행" />
          <Kpi label={m.stats.total} value={Math.round(d.stats.totalSeconds / 3600)} unit="시간" hint={`${d.stats.totalSeconds.toLocaleString('ko-KR')}초`} />
          <Kpi label={m.stats.over} value={d.stats.over} unit="건" tone={d.stats.over ? 'warn' : undefined} hint={`${d.stats.capSeconds.toLocaleString('ko-KR')}초 초과`} />
          <Kpi label={m.stats.cap} value={d.stats.cap} unit="건" />
        </div>
      ) : null}
      <DataTable columns={dailyCols} rows={d?.items} rowKey={(r) => `${r.id}-${r.studySeq}-${r.lectureCode}`} loading={q.isPending || q.isFetching} error={q.error} onRetry={() => void q.refetch()} size={50} dense />
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/monitoring/overlap
type OverlapItem = OverlapMonitor['items'][number];
function heat(minutes: number): string { const a = Math.min(1, minutes / 60); return `rgba(180,35,24,${0.08 + a * 0.5})`; }
const overlapCols: Column<OverlapItem>[] = [
  { key: 'sharedMinutes', header: adm.monitoring.overlap.cols.minutes, align: 'right', sortable: true, render: (r) => <span style={{ display: 'inline-block', minWidth: 48, padding: '2px 8px', borderRadius: 4, background: heat(r.sharedMinutes), fontWeight: 700 }}>{r.sharedMinutes}분</span> },
  { key: 'id', header: adm.monitoring.overlap.cols.id, sortable: true, render: (r) => <Link to={`/admin/members/${encodeURIComponent(r.id)}`}>{r.id}</Link> },
  { key: 'name', header: adm.monitoring.overlap.cols.name, render: (r) => r.name ?? '' },
  { key: 'companyCode', header: adm.monitoring.overlap.cols.company, render: (r) => r.companyCode ?? '' },
  { key: 'studySeq', header: adm.monitoring.overlap.cols.seq, align: 'right', render: (r) => <Link to={`/admin/studies/${r.studySeq}`}>{r.studySeq}</Link> },
  { key: 'firstMinute', header: adm.monitoring.overlap.cols.first, nowrap: true, render: (r) => r.firstMinute ?? '' },
  { key: 'lastMinute', header: adm.monitoring.overlap.cols.last, nowrap: true, render: (r) => r.lastMinute ?? '' },
];

export function MonitoringOverlapPage() {
  const [p, setP, reset] = useSearchState({ from: '', to: '' });
  const [form, setForm] = useState({ from: p.from, to: p.to });
  const q = useQuery({ queryKey: ['admin', 'monitoring', 'overlap', p], queryFn: ({ signal }) => adminApi.monitoringOverlap({ from: p.from || undefined, to: p.to || undefined }, signal), placeholderData: keepPreviousData });
  const m = adm.monitoring.overlap;
  const rows = useMemo(() => (q.data?.items ?? []).slice().sort((a, b) => b.sharedMinutes - a.sharedMinutes), [q.data]);
  return (
    <AdminPage title={m.title} lead={m.lead}>
      <FilterBar onSubmit={() => setP(form)} onReset={() => { setForm({ from: '', to: '' }); reset(); }}>
        <FilterField label={m.from} htmlFor="o-from" width={160}><AInput id="o-from" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></FilterField>
        <FilterField label={m.to} htmlFor="o-to" width={160}><AInput id="o-to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></FilterField>
      </FilterBar>
      {q.data ? <Callout className="u-mb-8">{q.data.from} ~ {q.data.to} · {q.data.rule}</Callout> : null}
      <DataTable columns={overlapCols} rows={q.isPending ? undefined : rows} rowKey={(r) => `${r.id}-${r.studySeq}`} loading={q.isPending || q.isFetching} error={q.error} onRetry={() => void q.refetch()} size={50} dense emptyTitle="중복 학습이 감지되지 않았습니다." emptyBody=" " />
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/monitoring/abnormal
const ISSUE_LEGEND: Record<string, string> = {
  DAILY_OVER_CAP: '하루 8시간 초과 학습', OVERLAP_MINUTES: '같은 시간대 중복 학습', PROGRESS_JUMP: '진도 급증', IP_SHARED: '여러 계정 동일 IP', STUDY_TIME_MISMATCH: '학습시간 불일치', NO_HEARTBEAT: '하트비트 없는 진도', DUPLICATE_LOG: '중복 로그', SESSION_TOO_LONG: '세션 과다',
};
const abnormalCols: Column<AbnormalRow>[] = [
  { key: 'detectDate', header: adm.monitoring.abnormal.cols.date, nowrap: true, sortable: true, render: (r) => r.detectDate ?? r.detectedAt ?? '' },
  { key: 'issueCode', header: adm.monitoring.abnormal.cols.code, sortable: true, render: (r) => <span title={ISSUE_LEGEND[r.issueCode ?? ''] ?? ''} className="mono">{r.issueCode ?? ''}</span> },
  { key: 'severity', header: adm.monitoring.abnormal.cols.severity, align: 'center', render: (r) => <StatusBadge tone={/high|crit/i.test(r.severity ?? '') ? 'danger' : /med|warn/i.test(r.severity ?? '') ? 'warn' : 'neutral'}>{r.severity ?? '-'}</StatusBadge> },
  { key: 'category', header: adm.monitoring.abnormal.cols.category, render: (r) => r.category ?? '' },
  { key: 'id', header: adm.monitoring.abnormal.cols.id, render: (r) => (r.id ? <Link to={`/admin/members/${encodeURIComponent(r.id)}`}>{r.id}</Link> : '') },
  { key: 'name', header: adm.monitoring.abnormal.cols.name, render: (r) => r.name ?? '' },
  { key: 'studySeq', header: adm.monitoring.abnormal.cols.seq, align: 'right', render: (r) => (r.studySeq ? <Link to={`/admin/studies/${r.studySeq}`}>{r.studySeq}</Link> : '') },
  { key: 'lectureCode', header: adm.monitoring.abnormal.cols.lecture, render: (r) => r.lectureCode ?? '' },
  { key: 'status', header: adm.monitoring.abnormal.cols.status, align: 'center', render: (r) => <StatusBadge tone={r.status === 'resolved' || r.status === 'done' ? 'ok' : r.status ? 'info' : 'neutral'}>{r.status ?? '미처리'}</StatusBadge> },
  { key: 'statusNote', header: adm.monitoring.abnormal.cols.note, render: (r) => [r.statusNote, r.statusBy, r.statusAt].filter(Boolean).join(' · ') },
  { key: 'source', header: adm.monitoring.abnormal.cols.source, render: (r) => r.source ?? '' },
];

export function MonitoringAbnormalPage() {
  const [p, setP, reset] = useSearchState({ from: '', to: '', code: '', status: '', page: 1 });
  const [form, setForm] = useState({ from: p.from, to: p.to, code: p.code, status: p.status });
  const [selected, setSelected] = useState<AbnormalRow | null>(null);
  const q = useQuery({ queryKey: ['admin', 'monitoring', 'abnormal', p], queryFn: ({ signal }) => adminApi.monitoringAbnormal({ from: p.from || undefined, to: p.to || undefined, code: p.code || undefined, status: p.status || undefined, page: p.page, size: 20 }, signal), placeholderData: keepPreviousData });
  const m = adm.monitoring.abnormal;
  return (
    <AdminPage title={m.title} lead={m.lead}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ from: '', to: '', code: '', status: '' }); reset(); }}>
        <FilterField label={adm.monitoring.overlap.from} htmlFor="a-from" width={150}><AInput id="a-from" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></FilterField>
        <FilterField label={adm.monitoring.overlap.to} htmlFor="a-to" width={150}><AInput id="a-to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></FilterField>
        <FilterField label={m.code} htmlFor="a-code" width={180}><AInput id="a-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} list="abn-codes" /></FilterField>
        <FilterField label={m.status} htmlFor="a-st" width={120}><AInput id="a-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} /></FilterField>
      </FilterBar>
      <datalist id="abn-codes">{Object.keys(ISSUE_LEGEND).map((k) => <option key={k} value={k} />)}</datalist>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 12 }}>
        <div>
          <DataTable columns={abnormalCols} rows={q.data?.items} rowKey={(r) => r.idx} loading={q.isPending || q.isFetching} error={q.error} onRetry={() => void q.refetch()} page={p.page} size={20} total={q.data?.total} onPageChange={(n) => setP({ page: n })} onRowClick={setSelected} selectedKey={selected?.idx} dense />
          {selected ? <div className="u-mt-8"><h3 style={{ fontSize: 13, margin: '0 0 6px' }}>#{selected.idx} metric · sample</h3><JsonViewer value={{ metric: selected.metric, sample: selected.sample }} maxHeight={260} /></div> : null}
        </div>
        <aside>
          <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{m.legend}</h3>
          <ul style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(q.data?.byCode ?? []).map((b) => <li key={b.code ?? '-'} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><AButton variant="link" size="xs" onClick={() => { setForm({ ...form, code: b.code ?? '' }); setP({ code: b.code ?? '' }, true); }}>{b.code ?? '-'}</AButton><span>{b.count.toLocaleString('ko-KR')}</span></li>)}
          </ul>
          <h3 style={{ fontSize: 13, margin: '14px 0 6px' }}>코드 설명</h3>
          <dl style={{ fontSize: 11, color: 'var(--c-muted)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px' }}>{Object.entries(ISSUE_LEGEND).map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt className="mono">{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>)}</dl>
        </aside>
      </div>
    </AdminPage>
  );
}
