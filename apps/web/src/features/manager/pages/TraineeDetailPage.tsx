import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { MANAGER_FILE, downloadManagerFile, managerApi, type Roster, type TraineeProgress } from '../../../shared/api/endpoints/manager';
import type { ChapterProgressRow, DailyRow } from '../../../shared/api/schemas';
import { StateBlock } from '../../../shared/ui/StateBlock';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { AButton, AInput, Bar, Card, DataTable, DescList, FilterBar, FilterField, StatusBadge, type Column } from '../../../shared/ui/admin';
import { useToast } from '../../../app/providers/ToastProvider';
import { formatMinutes } from '../../../shared/utils/format';
import { isAppError } from '../../../shared/api/client';
import { ManagerError } from '../managerUi';
import { mgr } from '../strings';

const t = mgr.trainee;
const secToMin = (s: number | null | undefined) => formatMinutes(Math.round((s ?? 0) / 60));

export const chapterColumns: Column<ChapterProgressRow>[] = [
  { key: 'order', header: t.chapterCols.order, align: 'center', width: 60 },
  { key: 'courseName', header: t.chapterCols.course, render: (r) => r.courseName ?? r.lectureCode ?? '' },
  { key: 'title', header: t.chapterCols.title },
  { key: 'lectureTimeMin', header: t.chapterCols.min, align: 'right', render: (r) => (r.lectureTimeMin != null ? `${r.lectureTimeMin}분` : '—') },
  { key: 'progress', header: t.chapterCols.progress, width: 120, render: (r) => <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Bar value={r.progress ?? 0} tone={(r.progress ?? 0) >= 100 ? 'ok' : undefined} /><span style={{ fontSize: 12, minWidth: 34, textAlign: 'right' }}>{Math.round(r.progress ?? 0)}%</span></div> },
  { key: 'studyTime', header: t.chapterCols.time, align: 'right', render: (r) => secToMin(r.studyTime) },
  { key: 'lastStudiedAt', header: t.chapterCols.last, nowrap: true, render: (r) => r.lastStudiedAt ?? r.lastStudy ?? '—' },
];

export const dailyColumns: Column<DailyRow>[] = [
  { key: 'date', header: t.dailyCols.date, nowrap: true, sortable: true },
  { key: 'seconds', header: t.dailyCols.seconds, align: 'right', sortable: true, render: (r) => secToMin(r.seconds) },
  { key: 'creditedSec', header: t.dailyCols.credited, align: 'right', render: (r) => secToMin(r.creditedSec) },
  { key: 'excessSec', header: t.dailyCols.excess, align: 'right', render: (r) => (r.excessSec ? <span style={{ color: 'var(--c-danger)' }}>{secToMin(r.excessSec)}</span> : '—') },
  { key: 'status', header: t.dailyCols.status, align: 'center', render: (r) => <StatusBadge tone={r.status === 'over' ? 'danger' : r.status === 'cap' ? 'warn' : 'ok'}>{r.statusLabel}</StatusBadge> },
];

type RosterRow = Roster['items'][number];
const rosterColumns: Column<RosterRow>[] = [
  { key: 'gubun', header: t.rosterCols.gubun, align: 'center', render: (r) => r.gubun || '' },
  { key: 'name', header: t.rosterCols.name, render: (r) => <span>{r.name ?? ''}<br /><small className="muted">{r.id}</small></span> },
  { key: 'courseName', header: t.rosterCols.course, render: (r) => r.courseName ?? '' },
  { key: 'progress', header: t.rosterCols.progress, align: 'right', render: (r) => `${r.progress}%` },
  { key: 'studyTime', header: t.rosterCols.time, align: 'right', nowrap: true },
  { key: 'lectureStart', header: t.rosterCols.start, nowrap: true },
  { key: 'lectureEnd', header: t.rosterCols.end, nowrap: true },
];

/** 역량진단 보기: 영역 점수만 (competency_assessment_report.html without the item answers). */
function AssessmentCard({ id, studySeq }: { id: string; studySeq: number }) {
  const q = useQuery({ queryKey: ['manager', 'trainee-assessment', id, studySeq], queryFn: ({ signal }) => managerApi.traineeAssessment(id, studySeq, signal), retry: false });
  const d = q.data;
  const cell = (v: number, ok: boolean) => (ok || v > 0 ? `${v.toFixed(1)}점` : '—');
  return (
    <Card title={<span id="assessment">{t.assessment}</span>}>
      {q.isError ? <ManagerError error={q.error} onRetry={() => void q.refetch()} /> : q.isPending ? <Skeleton lines={3} /> : d ? (
        <>
          <table className="table" style={{ width: '100%', fontSize: 13 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>{t.assessmentCols.area}</th><th>{t.assessmentCols.pre}{d.pre.submitted ? '' : ` (${t.notSubmitted})`}</th><th>{t.assessmentCols.post}{d.post.submitted ? '' : ` (${t.notSubmitted})`}</th></tr></thead>
            <tbody>
              <tr><td>{mgr.overview.areas.common}</td><td style={{ textAlign: 'center' }}>{cell(d.pre.common, d.pre.submitted)}</td><td style={{ textAlign: 'center' }}>{cell(d.post.common, d.post.submitted)}</td></tr>
              <tr><td>{mgr.overview.areas.leadership}</td><td style={{ textAlign: 'center' }}>{cell(d.pre.leader, d.pre.submitted)}</td><td style={{ textAlign: 'center' }}>{cell(d.post.leader, d.post.submitted)}</td></tr>
              <tr><td>{mgr.overview.areas.job}</td><td style={{ textAlign: 'center' }}>{cell(d.pre.job, d.pre.submitted)}</td><td style={{ textAlign: 'center' }}>{cell(d.post.job, d.post.submitted)}</td></tr>
              <tr><th style={{ textAlign: 'left' }}>{t.total}</th><td style={{ textAlign: 'center' }}><b>{cell(d.pre.total, d.pre.submitted)}</b></td><td style={{ textAlign: 'center' }}><b>{cell(d.post.total, d.post.submitted)}</b></td></tr>
            </tbody>
          </table>
          <p className={styles.note}>{t.assessmentNote}</p>
        </>
      ) : null}
    </Card>
  );
}

/** manager_trainee_list.php 수강현황: same company · 과정 · 수강기간, 과정명 search, 검색항목 엑셀출력. */
function RosterCard({ d }: { d: TraineeProgress }) {
  const { toast } = useToast();
  const [sw, setSw] = useState('');
  const [applied, setApplied] = useState('');
  const query = { companyCode: d.companyCode, lectureCode: d.lectureCode, lectureStart: d.period.start, lectureEnd: d.period.end, sw: applied || undefined };
  const q = useQuery({ queryKey: ['manager', 'roster', query], queryFn: ({ signal }) => managerApi.roster(query, signal), placeholderData: keepPreviousData, retry: false });
  const [busy, setBusy] = useState(false);
  const excel = async () => {
    setBusy(true);
    try { await downloadManagerFile(MANAGER_FILE.traineesXlsx, { companyCode: d.companyCode, lectureCode: d.lectureCode, lectureStart: d.period.start, lectureEnd: d.period.end }, '수강생리스트.xlsx'); toast(mgr.trainees.excelDone, { tone: 'ok' }); }
    catch (e) { toast(e instanceof Error && e.message ? e.message : mgr.trainees.excelFail, { tone: 'danger' }); } finally { setBusy(false); }
  };
  const r = q.data;
  return (
    <Card title={t.roster} aside={<AButton size="sm" icon="download" onClick={() => void excel()} loading={busy}>{t.rosterExcel}</AButton>}>
      {r ? <p className={styles.note} style={{ margin: '0 0 8px' }}>{r.period.label} · {r.courseName ?? r.lectureCode} · 수료 {r.passed}명 / 미수료 {r.notPassed}명</p> : null}
      <FilterBar onSubmit={() => setApplied(sw.trim())} onReset={() => { setSw(''); setApplied(''); }}>
        <FilterField label={t.rosterSearch} htmlFor="roster-sw" width={220}><AInput id="roster-sw" value={sw} onChange={(e) => setSw(e.target.value)} placeholder="검색어 입력" /></FilterField>
      </FilterBar>
      <DataTable columns={rosterColumns} rows={r?.items} rowKey={(x) => x.studySeq} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense emptyTitle={t.rosterEmpty} emptyBody={t.rosterOnlyRefund} />
    </Card>
  );
}

/** AR-21 학습자 상세 + 역량진단 보기 + 수강현황 (manager_trainee_list.php). */
export default function TraineeDetailPage() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const location = useLocation();
  const studySeq = Number(sp.get('studySeq')) || undefined;
  const q = useQuery({ queryKey: ['manager', 'trainee', id, studySeq], queryFn: ({ signal }) => managerApi.traineeProgress(id, studySeq, signal), enabled: !!id, retry: false });
  const d = q.data;
  useEffect(() => { if (d && location.hash === '#assessment') document.getElementById('assessment')?.scrollIntoView({ block: 'start' }); }, [d, location.hash]);
  return (
    <div>
      <div className={styles.head}>
        <div><h1>{t.title}{d ? ` · ${d.trainee.name ?? d.trainee.id}` : ''}</h1><p>{d ? `${d.courseName} · ${d.period.start} ~ ${d.period.end}` : ''}</p></div>
        <div className={styles.headActions}><AButton to="/manager/trainees">{t.back}</AButton>{d ? <AButton variant="primary" to={`/manager/reports/${encodeURIComponent(d.trainee.id)}?studySeq=${d.studySeq}`}>{t.report}</AButton> : null}</div>
      </div>
      {q.isError ? (isAppError(q.error) && q.error.status === 404 ? <StateBlock code="NOT_FOUND" center body={q.error.message} /> : <ManagerError error={q.error} onRetry={() => void q.refetch()} />) : q.isPending ? <Skeleton lines={6} /> : d ? (
        <div className="stack">
          <Card>
            <DescList cols={2} items={[
              [t.facts.id, d.trainee.id], [t.facts.name, d.trainee.name],
              [t.facts.depart, [d.trainee.depart, d.trainee.position].filter(Boolean).join(' · ') || '—'], [t.facts.company, d.companyName ?? d.companyCode],
              [t.facts.course, <span key="c">{d.courseName} <span className="muted">({d.lectureCode} · {d.sectionTitle}{d.isPackage ? ` · 패키지 ${d.codes.join(', ')}` : ''})</span></span>], [t.facts.period, `${d.period.start} ~ ${d.period.end}${d.studyEnd ? ` · ${mgr.trainees.ended}` : ''}`],
              [t.facts.time, <span key="t">{d.timeLabel} <span className="muted">({d.seconds.toLocaleString('ko-KR')}초)</span></span>], [t.facts.percent, <div key="p" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bar value={d.percent} tone={d.fifteenMet ? 'ok' : undefined} /><b>{d.percent}%</b></div>],
              [t.facts.pass, <span key="po">{d.passOk ? <StatusBadge tone="ok">{mgr.trainees.passed}</StatusBadge> : <StatusBadge tone="warn">{mgr.trainees.notPassed}</StatusBadge>}{d.incomplete ? <small className="muted"> {d.incomplete.label}</small> : null}</span>],
              [t.facts.post, <StatusBadge key="ps" tone={d.post.state === 'done' ? 'ok' : d.post.state === 'progress' ? 'warn' : 'neutral'}>{d.post.label}</StatusBadge>],
              [t.facts.pre, d.preLabel === 'Y' ? '완료' : d.preLabel === 'N' ? '미시작' : d.preLabel],
            ]} />
          </Card>
          <AssessmentCard id={d.trainee.id} studySeq={d.studySeq} />
          <Card title={t.chapters}><DataTable columns={chapterColumns} rows={d.chapters} rowKey={(r) => r.chapterSeq} dense /></Card>
          <Card title={t.daily}><DataTable columns={dailyColumns} rows={d.daily} rowKey={(r) => r.date} dense size={31} emptyTitle={t.noDaily} emptyBody=" " /></Card>
          <RosterCard d={d} />
          <p className="muted" style={{ fontSize: 12 }}><Link to="/manager/trainees">{t.back}</Link></p>
        </div>
      ) : null}
    </div>
  );
}
