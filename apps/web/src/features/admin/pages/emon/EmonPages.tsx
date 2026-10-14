import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi, EMON_TABLES, type EmonJob, type EmonTable } from '../../../../shared/api/endpoints/admin';
import type { EmonDiagnosis, EmonSummary } from '../../../../shared/api/schemas';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AdminPage, AInput, ASelect, Callout, Card, DataTable, DescList, FilterBar, FilterField, JsonViewer, Kpi, StatusBadge, TabStrip, type Column } from '../../../../shared/ui/admin';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { Skeleton } from '../../../../shared/ui/Skeleton';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';

const e = adm.emon;
const NEVER = <Callout tone="warn">{e.never}</Callout>;

// ---------------------------------------------------------------- /admin/emon
type SummaryRow = EmonSummary['tables'][number];
const summaryCols: Column<SummaryRow>[] = [
  { key: 'label', header: e.cols.label, render: (r) => <b>{r.label}</b> },
  { key: 'table', header: e.cols.table, render: (r) => <span className="mono" style={{ fontSize: 11 }}>{r.table}<br /><span className="muted">→ {r.resultTable ?? tr('(RESULT 없음)', '(no RESULT)')}</span></span> },
  { key: 'windowDays', header: e.cols.window, align: 'center', render: (r) => (r.windowDays ? tr(`최근 ${r.windowDays}일`, `Last ${r.windowDays} days`) : tr('전체', 'All time')) },
  { key: 'total', header: e.cols.total, align: 'right', sortable: true, render: (r) => r.total?.toLocaleString('ko-KR') ?? '—' },
  { key: 'sent', header: e.cols.sent, align: 'right', sortable: true, render: (r) => r.sent?.toLocaleString('ko-KR') ?? '—' },
  { key: 'pending', header: e.cols.pending, align: 'right', sortable: true, render: (r) => <span style={{ fontWeight: 700, color: r.pending ? 'var(--c-warn)' : undefined }}>{r.pending?.toLocaleString('ko-KR') ?? '—'}</span> },
  { key: 'pendingStale', header: e.cols.stale, align: 'right', sortable: true, render: (r) => (r.pendingStale ? <StatusBadge tone="danger">{r.pendingStale.toLocaleString('ko-KR')}</StatusBadge> : (r.pendingStale ?? '—')) },
  { key: 'lastRegDate', header: e.cols.last, nowrap: true, render: (r) => r.lastRegDate ?? '—' },
  { key: 'error', header: e.cols.error, render: (r) => (r.error ? <StatusBadge tone="danger">{r.error}</StatusBadge> : '') },
  { key: '_drill', header: '', render: (r) => (r.resultTable ? <Link to={`/admin/emon/pending?table=${r.table}`} onClick={(ev) => ev.stopPropagation()}>{e.drill} →</Link> : '') },
];

export function EmonPage() {
  const q = useQuery({ queryKey: ['admin', 'emon', 'summary'], queryFn: ({ signal }) => adminApi.emonSummary(signal), refetchInterval: 120_000 });
  const d = q.data;
  const stale = d?.tables.reduce((a, b) => a + (b.pendingStale ?? 0), 0) ?? 0;
  return (
    <AdminPage title={e.title} lead={e.lead} actions={<><AButton to="/admin/emon/diagnosis">{e.diagnosis.title}</AButton><AButton to="/admin/emon/preview/attend">{e.preview.title}</AButton><AButton onClick={() => void q.refetch()} loading={q.isFetching && !q.isPending}>{adm.common.refresh}</AButton></>}>
      {NEVER}
      {d ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, margin: '12px 0' }}><Kpi label={e.cols.pending} value={d.pendingTotal} unit={tr('건', '')} tone={d.pendingTotal ? 'warn' : 'ok'} /><Kpi label={e.cols.stale} value={stale} unit={tr('건', '')} tone={stale ? 'warn' : 'ok'} hint={tr(`${d.staleSeconds / 3600}시간 기준`, `${d.staleSeconds / 3600} h threshold`)} /><Kpi label={tr('규칙', 'Rule')} value={null} hint={d.rule} /></div> : null}
      <div className="u-mt-8"><DataTable columns={summaryCols} rows={d?.tables} rowKey={(r) => r.table} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense /></div>
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/emon/pending?table=
export function EmonPendingPage() {
  const [p, setP] = useSearchState({ table: 'TB_ATTEND_HIST_V2', page: 1 });
  const table = (EMON_TABLES as readonly string[]).includes(p.table) ? (p.table as EmonTable) : 'TB_ATTEND_HIST_V2';
  const q = useQuery({ queryKey: ['admin', 'emon', 'pending', table, p.page], queryFn: ({ signal }) => adminApi.emonPending(table, p.page, 20, signal), placeholderData: keepPreviousData });
  const keys = useMemo(() => { const first = q.data?.items[0]; return first ? Object.keys(first).slice(0, 14) : []; }, [q.data]);
  const columns: Column<Record<string, unknown>>[] = keys.map((k) => ({ key: k, header: k, nowrap: true, render: (r) => <span className="mono" style={{ fontSize: 11 }}>{r[k] === null || r[k] === undefined ? '' : String(r[k])}</span> }));
  return (
    <AdminPage title={`${e.pending.title} · ${table}`} lead={e.pending.lead} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: e.title, to: '/admin/emon' }, { label: table }]} actions={<AButton to="/admin/emon">{adm.common.back}</AButton>}>
      <FilterBar onSubmit={() => undefined}>
        <FilterField label={e.cols.table} htmlFor="ep-table" width={260}><ASelect id="ep-table" value={table} onChange={(ev) => setP({ table: ev.target.value, page: 1 })} options={EMON_TABLES.map((t) => ({ value: t, label: t }))} /></FilterField>
      </FilterBar>
      {q.data ? <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>RESULT: {q.data.resultTable ?? '—'} · {q.data.windowDays ? tr(`최근 ${q.data.windowDays}일`, `Last ${q.data.windowDays} days`) : tr('전체', 'All time')} · {adm.common.total(q.data.total)}</p> : null}
      <DataTable columns={columns.length ? columns : [{ key: '_', header: '' }]} rows={q.data?.items} rowKey={(r, i) => String(r.SEQ ?? r.Seq ?? r.seq ?? i)} loading={q.isPending || q.isFetching} error={q.error} onRetry={() => void q.refetch()} page={p.page} size={20} total={q.data?.total} onPageChange={(n) => setP({ page: n })} dense emptyTitle={tr('미전송 행이 없습니다.', 'No unsent rows.')} emptyBody=" " />
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/emon/diagnosis?id&course
type Study = EmonDiagnosis['studies'][number];
const studyCols: Column<Study>[] = [
  { key: 'studySeq', header: 'Seq', align: 'right', render: (r) => <Link to={`/admin/studies/${r.studySeq}`}>{r.studySeq}</Link> },
  { key: 'classPk', header: 'CLASS_AGENT_PK', render: (r) => <span className="mono">{r.classPk}</span> },
  { key: 'period', header: tr('기간', 'Period'), nowrap: true, render: (r) => `${r.period.start} ~ ${r.period.end}` },
  { key: 'studyEnd', header: tr('마감', 'Closed'), align: 'center', render: (r) => r.studyEnd ?? '' },
  { key: 'passOk', header: 'Study.PassOK', align: 'center', render: (r) => <StatusBadge tone={r.passOk === 'Y' ? 'ok' : 'neutral'}>{r.passOk ?? '-'}</StatusBadge> },
  { key: 'hours', header: tr('학습시간(h)', 'Study time (h)'), align: 'right', render: (r) => tr(`${r.hours} (${r.seconds.toLocaleString('ko-KR')}초)`, `${r.hours} (${r.seconds.toLocaleString('ko-KR')} s)`) },
  { key: 'computed', header: tr('attend 계산', 'attend computed'), render: (r) => <span>progressRate {r.computed.progressRate} · passFlag <StatusBadge tone={r.computed.passFlag === 1 ? 'ok' : 'neutral'}>{r.computed.passFlag}</StatusBadge></span> },
  { key: '_mm', header: tr('일치', 'Match'), align: 'center', render: (r) => { const mismatch = r.studyEnd === 'Y' && (r.passOk === 'Y') !== (r.computed.passFlag === 1); return <StatusBadge tone={mismatch ? 'danger' : 'ok'}>{mismatch ? tr('불일치', 'Mismatch') : tr('일치', 'Match')}</StatusBadge>; } },
];
type AttendRow = EmonDiagnosis['attend']['rows'][number];
const attendCols: Column<AttendRow>[] = [
  { key: 'seq', header: 'SEQ', align: 'right' },
  { key: 'changeState', header: 'CHANGE_STATE', align: 'center', render: (r) => r.changeState ?? '' },
  { key: 'progressRate', header: 'PROGRESS_RATE', align: 'right', render: (r) => String(r.progressRate ?? '') },
  { key: 'passFlag', header: 'PASS_FLAG', align: 'center', render: (r) => <StatusBadge tone={r.passFlag === 1 ? 'ok' : 'neutral'}>{r.passFlag}</StatusBadge> },
  { key: 'attendValidFlag', header: 'VALID', align: 'center' },
  { key: 'regDate', header: 'REG_DATE', nowrap: true, render: (r) => r.regDate ?? '' },
  { key: 'sent', header: tr('전송', 'Send'), align: 'center', render: (r) => <StatusBadge tone={r.sent ? 'ok' : 'warn'}>{r.sent ? tr('완료', 'Sent') : tr('미전송', 'Unsent')}</StatusBadge> },
];
const sentBadge = (s: { total: number; sent: number; pending?: number } | null | undefined) => (s ? <span>{tr('전체', 'Total')} {s.total} · {tr('전송', 'Sent')} {s.sent} · <b style={{ color: s.pending ? 'var(--c-warn)' : undefined }}>{tr('미전송', 'Unsent')} {s.pending ?? s.total - s.sent}</b></span> : <span className="muted">—</span>);

export function EmonDiagnosisPage() {
  const [p, setP] = useSearchState({ id: '', course: 'ARC2026', termeIdx: 0 });
  const [form, setForm] = useState({ id: p.id, course: p.course, termeIdx: p.termeIdx ? String(p.termeIdx) : '' });
  const q = useQuery({ queryKey: ['admin', 'emon', 'diagnosis', p], queryFn: ({ signal }) => adminApi.emonDiagnosis({ id: p.id, course: p.course || undefined, termeIdx: p.termeIdx || undefined }, signal), enabled: !!p.id });
  const d = q.data;
  const g = e.diagnosis;
  return (
    <AdminPage title={g.title} lead={g.lead} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: e.title, to: '/admin/emon' }, { label: g.title }]} actions={<AButton to="/admin/emon">{adm.common.back}</AButton>}>
      <FilterBar onSubmit={() => setP({ id: form.id.trim(), course: form.course.trim() || 'ARC2026', termeIdx: Number(form.termeIdx) || 0 })} submitLabel={g.run}>
        <FilterField label={g.id} htmlFor="dg-id" width={180}><AInput id="dg-id" value={form.id} onChange={(ev) => setForm({ ...form, id: ev.target.value })} required /></FilterField>
        <FilterField label={g.course} htmlFor="dg-course" width={140}><AInput id="dg-course" value={form.course} onChange={(ev) => setForm({ ...form, course: ev.target.value })} /></FilterField>
        <FilterField label={tr('회차(termeIdx)', 'Term (termeIdx)')} htmlFor="dg-terme" width={120}><AInput id="dg-terme" type="number" min={1} value={form.termeIdx} onChange={(ev) => setForm({ ...form, termeIdx: ev.target.value })} /></FilterField>
      </FilterBar>
      {NEVER}
      {!p.id ? null : q.isError ? <div className="u-mt-8"><StateBlock code={(q.error as { status?: number }).status === 404 ? 'NOT_FOUND' : 'LIST_ERROR'} center onRetry={() => void q.refetch()} /></div> : q.isPending || !d ? <div className="u-mt-8"><Skeleton lines={8} /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
            <Kpi label={g.verdict} value={d.verdict} tone={d.verdict === 'GO' ? 'ok' : 'warn'} hint={d.verdict === 'GO' ? g.none : tr(`${d.mismatches.length}건`, `${d.mismatches.length} mismatches`)} />
            <Kpi label={tr('학습자', 'Learner')} value={`${d.learner.name ?? ''} (${d.learner.id})`} hint={<span>{d.learner.active ? <StatusBadge tone="ok">{tr('활성', 'Active')}</StatusBadge> : <StatusBadge tone="danger">{tr('비활성', 'Inactive')}</StatusBadge>} {d.learner.companyCode}</span>} />
            <Kpi label={tr('과정 · 회차 PK', 'Course · term PK')} value={d.classPk ?? '—'} hint={d.course} />
            <Kpi label={tr('attend 계산 시간', 'attend computed hours')} value={d.attend.computedHours} unit="h" hint={tr(`성적 시간 합 ${d.attend.scoreSumSeconds.toLocaleString('ko-KR')}초 · 기대 PASS_FLAG ${d.attend.expectedPassFlag}`, `Score time total ${d.attend.scoreSumSeconds.toLocaleString('ko-KR')} s · expected PASS_FLAG ${d.attend.expectedPassFlag}`)} tone={d.attend.expectedPassFlag ? 'ok' : undefined} />
          </div>
          <Card title={`${g.mismatches} (${d.mismatches.length})`}>
            {d.mismatches.length ? <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>{d.mismatches.map((m, i) => <li key={`${m.code}${i}`}><StatusBadge tone="danger">{m.code}</StatusBadge> {m.message}{m.detail !== undefined ? <details style={{ marginTop: 4 }}><summary style={{ fontSize: 12, cursor: 'pointer' }}>{tr('상세', 'Details')}</summary><JsonViewer value={m.detail} maxHeight={200} /></details> : null}</li>)}</ul> : <Callout tone="ok">{g.none}</Callout>}
          </Card>
          <Card title={`${g.studies} (${d.studies.length})${d.chosenStudySeq ? tr(` · 선택 Seq ${d.chosenStudySeq}`, ` · selected Seq ${d.chosenStudySeq}`) : ''}`}><DataTable columns={studyCols} rows={d.studies} rowKey={(r) => r.studySeq} dense emptyTitle={tr('Study 행이 없습니다.', 'No Study rows.')} emptyBody=" " /></Card>
          <Card title={`${g.attend} (${d.attend.rows.length})`}><DataTable columns={attendCols} rows={d.attend.rows} rowKey={(r) => r.seq} dense emptyTitle={tr('TB_ATTEND_HIST_V2 행이 없습니다.', 'No TB_ATTEND_HIST_V2 rows.')} emptyBody=" " /></Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card title={g.sections.score}><DescList items={[[tr('전송', 'Send status'), sentBadge(d.score)], [tr('콘텐츠 수', 'Contents'), d.score?.contents], [tr('첫 제출', 'First submitted'), d.score?.first], [tr('최근 등록', 'Last added'), d.score?.last], [tr('중복', 'Duplicates'), d.score?.duplicates]]} /></Card>
            <Card title={g.sections.cse}><DescList items={[[tr('전송', 'Send status'), sentBadge(d.cse)], ['CONTENTS_PK = COURSE_PK', d.cse?.badContentPk]]} /></Card>
            <Card title={g.sections.contents}><DescList items={[[tr('전송', 'Send status'), sentBadge(d.contentsHist)], [tr('RMTN_TCMT_SEQ 비어 있음', 'RMTN_TCMT_SEQ empty'), d.contentsHist.emptyRmtnTcmtSeq]]} /></Card>
            <Card title={g.sections.terminal}><DescList items={[[tr('전체 / install / 성공', 'Total / install / success'), `${d.terminal.total} / ${d.terminal.install} / ${d.terminal.success}`], [tr('최근', 'Latest'), d.terminal.last], [tr('유형별', 'By type'), d.terminal.byType.map((t) => `${t.type ?? '-'} ${t.count}`).join(' · ')]]} /></Card>
            <Card title={g.sections.identity}><DescList items={[[tr('회원정보이력', 'Member info history'), <span key="u">{sentBadge(d.identity.userHist)} · {d.identity.userHist.last ?? ''}</span>], [tr('로그인이력', 'Login history'), <span key="l">{sentBadge(d.identity.loginHist)} · {d.identity.loginHist.last ?? ''}</span>]]} /></Card>
            <Card title={`${g.sections.course} / ${g.sections.class}`}>
              <ul style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {d.courseHist.map((c) => <li key={`c${c.seq}`}>{tr('과정', 'Course')} SEQ {c.seq} · {c.name ?? ''} · {c.changeState ?? ''} · {c.regDate ?? ''} {c.sent ? <StatusBadge tone="ok">{tr('전송', 'Sent')}</StatusBadge> : <StatusBadge tone="warn">{tr('미전송', 'Unsent')}</StatusBadge>}</li>)}
                {d.classHist.map((c) => <li key={`k${c.seq}`}>{tr('회차', 'Term')} SEQ {c.seq} · {c.start ?? ''} ~ {c.end ?? ''} · {c.changeState ?? ''} {c.sent ? <StatusBadge tone="ok">{tr('전송', 'Sent')}</StatusBadge> : <StatusBadge tone="warn">{tr('미전송', 'Unsent')}</StatusBadge>}</li>)}
                {!d.courseHist.length && !d.classHist.length ? <li className="muted">{tr('행 없음', 'No rows')}</li> : null}
              </ul>
            </Card>
          </div>
          <details><summary style={{ fontSize: 13, cursor: 'pointer' }}>{tr('원본 JSON', 'Raw JSON')}</summary><div className="u-mt-8"><JsonViewer value={d} /></div></details>
        </div>
      )}
    </AdminPage>
  );
}

// ---------------------------------------------------------------- /admin/emon/preview/:job
export function EmonPreviewPage() {
  const { job = 'attend' } = useParams();
  const j = (['attend', 'score', 'cse', 'contents'] as const).includes(job as EmonJob) ? (job as EmonJob) : 'attend';
  const [p, setP] = useSearchState({ n: 10, id: '', course: '' });
  const [form, setForm] = useState({ n: String(p.n), id: p.id, course: p.course });
  const q = useQuery({ queryKey: ['admin', 'emon', 'preview', j, p], queryFn: ({ signal }) => adminApi.emonPreview(j, { n: p.n, id: p.id || undefined, course: p.course || undefined }, signal) });
  const d = q.data;
  return (
    <AdminPage title={`${e.preview.title} · ${j}`} lead={e.preview.lead} crumbs={[{ label: adm.top.home, to: '/admin' }, { label: e.title, to: '/admin/emon' }, { label: `preview/${j}` }]} actions={<AButton to="/admin/emon">{adm.common.back}</AButton>}>
      <TabStrip label="job" items={e.preview.jobs.map((x) => ({ key: x.value, label: x.label, to: `/admin/emon/preview/${x.value}` }))} value={j} />
      <FilterBar onSubmit={() => setP({ n: Math.min(50, Math.max(1, Number(form.n) || 10)), id: form.id.trim(), course: form.course.trim() })} submitLabel={e.preview.run}>
        <FilterField label={e.preview.n} htmlFor="pv-n" width={90}><AInput id="pv-n" type="number" min={1} max={50} value={form.n} onChange={(ev) => setForm({ ...form, n: ev.target.value })} /></FilterField>
        <FilterField label={e.diagnosis.id} htmlFor="pv-id" width={160}><AInput id="pv-id" value={form.id} onChange={(ev) => setForm({ ...form, id: ev.target.value })} /></FilterField>
        <FilterField label={e.diagnosis.course} htmlFor="pv-course" width={140}><AInput id="pv-course" value={form.course} onChange={(ev) => setForm({ ...form, course: ev.target.value })} /></FilterField>
      </FilterBar>
      {NEVER}
      {q.isError ? <div className="u-mt-8"><StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /></div> : q.isPending || !d ? <div className="u-mt-8"><Skeleton lines={6} /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>{tr(`요청 ${d.requested}건 · 생성 ${d.count}건 · 제외 ${d.skipped.length}건`, `Requested ${d.requested} · built ${d.count} · skipped ${d.skipped.length}`)} · {d.note}</p>
          <Card title={`dataList (${d.count})`}><JsonViewer value={d.dataList} maxHeight={600} /></Card>
          {d.skipped.length ? <Card title={`${e.preview.skipped} (${d.skipped.length})`}><ul style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>{d.skipped.map((s) => <li key={s.seq}><span className="mono">SEQ {s.seq}</span> · {s.reason}</li>)}</ul></Card> : null}
        </div>
      )}
    </AdminPage>
  );
}
