import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../../shared/api/endpoints/admin';
import type { AbnormalRow, DailyMonitor, OverlapMonitor } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, DataTable, DateField, FilterBar, FilterField, JsonViewer, Kpi, StatusBadge, TabStrip, toIsoDate, type Column } from '../../../../shared/ui/admin';
import { StudyTimePage } from './studies-parity-daily';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm, studyTime } from '../../strings';

/** Local calendar day (toISOString would give yesterday's date before 09:00 KST). */
const today = () => toIsoDate(new Date());
const secToMin = (s: number) => studyTime(s);

// ---------------------------------------------------------------- /admin/monitoring/daily
type DailyItem = DailyMonitor['items'][number];
const dailyCols: Column<DailyItem>[] = [
  { key: 'id', header: tr('아이디', 'User ID'), sortable: true, render: (r) => <Link to={`/admin/members/${encodeURIComponent(r.id)}`}>{r.id}</Link> },
  { key: 'name', header: tr('이름', 'Name'), sortable: true, render: (r) => r.name ?? '' },
  { key: 'companyName', header: tr('기업', 'Company'), render: (r) => r.companyName ?? r.companyCode ?? '' },
  { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <Link to={`/admin/studies/${r.studySeq}`}>{r.studySeq}</Link> },
  { key: 'lectureCode', header: tr('과정', 'Course'), render: (r) => r.lectureCode ?? '' },
  { key: 'seconds', header: tr('학습', 'Studied'), align: 'right', sortable: true, render: (r) => tr(`${r.formatted} (${r.seconds.toLocaleString('ko-KR')}초)`, `${studyTime(r.seconds)} (${r.seconds.toLocaleString('en-US')} s)`) },
  { key: 'creditedSec', header: tr('인정', 'Credited'), align: 'right', render: (r) => secToMin(r.creditedSec) },
  { key: 'excessSec', header: tr('초과', 'Excess'), align: 'right', sortable: true, render: (r) => (r.excessSec ? <span style={{ color: 'var(--c-danger)' }}>{secToMin(r.excessSec)}</span> : '—') },
  { key: 'status', header: tr('상태', 'Status'), align: 'center', render: (r) => <StatusBadge tone={r.status === 'over' ? 'danger' : r.status === 'cap' ? 'warn' : 'ok'}>{adm.monitoring.daily.statuses.find((s) => s.value === r.status)?.label ?? r.statusLabel}</StatusBadge> },
];

/**
 * /admin/monitoring/daily — 일자별 학습시간 관리. Tab 1 = the study_time.php screen (B3, GET /admin/studies/daily-time);
 * tab 2 = the earlier one-day 8 h check (player chapter-gain rule, GET /admin/monitoring/daily).
 */
export function MonitoringDailyPage() {
  const [tab, setTab] = useState<'time' | 'cap'>(() => (new URLSearchParams(window.location.search).get('view') === 'cap' ? 'cap' : 'time'));
  return (
    <AdminPage title={tr('일자별 학습시간 관리', 'Daily study time')} lead={tab === 'time' ? tr('사업주 수강생의 날짜별 학습시간(차시 창, 하루 8시간 인정)과 15시간 충족·수료(공단 전송값)를 봅니다.', 'Per-day study time of a company’s learners (chapter windows, 8 h/day credited), 15 h and the reported pass flag.') : adm.monitoring.daily.lead}>
      <TabStrip label={tr('보기', 'View')} value={tab} onChange={(k) => setTab(k as 'time' | 'cap')} items={[{ key: 'time', label: tr('일자별 학습시간 관리', 'Daily study time') }, { key: 'cap', label: tr('하루 8시간 점검 (차시 증가분)', 'One-day 8 h check') }]} />
      <div className="u-mt-8">{tab === 'time' ? <StudyTimePage /> : <DailyCapMonitor />}</div>
    </AdminPage>
  );
}

function DailyCapMonitor() {
  const [p, setP, reset] = useSearchState({ date: '', companyCode: '', status: 'all' });
  const [form, setForm] = useState({ date: p.date || today(), companyCode: p.companyCode, status: p.status });
  const q = useQuery({ queryKey: ['admin', 'monitoring', 'daily', p], queryFn: ({ signal }) => adminApi.monitoringDaily({ date: p.date || undefined, companyCode: p.companyCode || undefined, status: p.status }, signal), placeholderData: keepPreviousData });
  const m = adm.monitoring.daily;
  const d = q.data;
  return (
    <>
      <FilterBar onSubmit={() => setP(form)} onReset={() => { setForm({ date: today(), companyCode: '', status: 'all' }); reset(); }}>
        <FilterField label={m.date} htmlFor="d-date"><DateField id="d-date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></FilterField>
        <FilterField label={adm.studies.filters.companyCode} htmlFor="d-cc"><AInput id="d-cc" value={form.companyCode} onChange={(e) => setForm({ ...form, companyCode: e.target.value })} /></FilterField>
        <FilterField label={m.status} htmlFor="d-st"><ASelect id="d-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={m.statuses} /></FilterField>
      </FilterBar>
      {d ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 10, marginBottom: 12 }}>
          <Kpi label={m.stats.learners} value={d.stats.learners} unit={tr('명', '')} hint={d.date} />
          <Kpi label={m.stats.rows} value={d.stats.rows} unit={tr('행', '')} />
          <Kpi label={m.stats.total} value={Math.round(d.stats.totalSeconds / 3600)} unit={tr('시간', 'h')} hint={tr(`${d.stats.totalSeconds.toLocaleString('ko-KR')}초`, `${d.stats.totalSeconds.toLocaleString('en-US')} s`)} />
          <Kpi label={m.stats.over} value={d.stats.over} unit={tr('건', '')} tone={d.stats.over ? 'warn' : undefined} hint={tr(`${d.stats.capSeconds.toLocaleString('ko-KR')}초 초과`, `${d.stats.capSeconds.toLocaleString('en-US')} s over`)} />
          <Kpi label={m.stats.cap} value={d.stats.cap} unit={tr('건', '')} />
        </div>
      ) : null}
      <DataTable columns={dailyCols} rows={d?.items} rowKey={(r) => `${r.id}-${r.studySeq}-${r.lectureCode}`} loading={q.isPending || q.isFetching} error={q.error} onRetry={() => void q.refetch()} size={50} dense />
    </>
  );
}

// ---------------------------------------------------------------- /admin/monitoring/overlap
type OverlapItem = OverlapMonitor['items'][number];
function heat(minutes: number): string { const a = Math.min(1, minutes / 60); return `rgba(180,35,24,${0.08 + a * 0.5})`; }
const overlapCols: Column<OverlapItem>[] = [
  { key: 'sharedMinutes', header: adm.monitoring.overlap.cols.minutes, align: 'right', sortable: true, render: (r) => <span style={{ display: 'inline-block', minWidth: 48, padding: '2px 8px', borderRadius: 4, background: heat(r.sharedMinutes), fontWeight: 700 }}>{tr(`${r.sharedMinutes}분`, `${r.sharedMinutes} min`)}</span> },
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
        <FilterField label={m.from} htmlFor="o-from"><DateField id="o-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} /></FilterField>
        <FilterField label={m.to} htmlFor="o-to"><DateField id="o-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} min={form.from || undefined} /></FilterField>
      </FilterBar>
      {q.data ? <Callout className="u-mb-8">{q.data.from} ~ {q.data.to} · {q.data.rule}</Callout> : null}
      <DataTable columns={overlapCols} rows={q.isPending ? undefined : rows} rowKey={(r) => `${r.id}-${r.studySeq}`} loading={q.isPending || q.isFetching} error={q.error} onRetry={() => void q.refetch()} size={50} dense emptyTitle={tr('중복 학습이 감지되지 않았습니다.', 'No overlapping study detected.')} emptyBody=" " />
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/monitoring/abnormal
const ISSUE_LEGEND: Record<string, string> = {
  DAILY_OVER_CAP: tr('하루 8시간 초과 학습', 'More than 8 h in a day'), OVERLAP_MINUTES: tr('같은 시간대 중복 학습', 'Overlapping study in the same minute'), PROGRESS_JUMP: tr('진도 급증', 'Progress jump'), IP_SHARED: tr('여러 계정 동일 IP', 'Same IP on several accounts'),
  STUDY_TIME_MISMATCH: tr('학습시간 불일치', 'Study time mismatch'), NO_HEARTBEAT: tr('하트비트 없는 진도', 'Progress without heartbeat'), DUPLICATE_LOG: tr('중복 로그', 'Duplicate log'), SESSION_TOO_LONG: tr('세션 과다', 'Session too long'),
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
  { key: 'status', header: adm.monitoring.abnormal.cols.status, align: 'center', render: (r) => <StatusBadge tone={r.status === 'resolved' || r.status === 'done' ? 'ok' : r.status ? 'info' : 'neutral'}>{r.status ?? tr('미처리', 'Open')}</StatusBadge> },
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
        <FilterField label={adm.monitoring.overlap.from} htmlFor="a-from"><DateField id="a-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} /></FilterField>
        <FilterField label={adm.monitoring.overlap.to} htmlFor="a-to"><DateField id="a-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} min={form.from || undefined} /></FilterField>
        <FilterField label={m.code} htmlFor="a-code"><AInput id="a-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} list="abn-codes" /></FilterField>
        <FilterField label={m.status} htmlFor="a-st"><AInput id="a-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} /></FilterField>
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
          <h3 style={{ fontSize: 13, margin: '14px 0 6px' }}>{tr('코드 설명', 'Code reference')}</h3>
          <dl style={{ fontSize: 11, color: 'var(--c-muted)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px' }}>{Object.entries(ISSUE_LEGEND).map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt className="mono">{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>)}</dl>
        </aside>
      </div>
    </AdminPage>
  );
}
