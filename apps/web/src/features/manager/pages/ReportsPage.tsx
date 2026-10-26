import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi, type CohortCard, type TraineeRow } from '../../../shared/api/endpoints/manager';
import { useManager } from '../ManagerContext';
import { useSearchState } from '../../../shared/utils/useSearchState';
import { AButton, AInput, Callout, DataTable, FilterBar, FilterField, StatusBadge, type Column } from '../../../shared/ui/admin';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { formatDate, formatMinutes } from '../../../shared/utils/format';
import { ManagerError } from '../managerUi';
import { assessmentReportHref } from './TraineesPage';
import { educationReportHref } from './CompletionPage';
import { mgr } from '../strings';

const DEFAULTS = { q: '', page: 1 };
const r = mgr.reports;

const cohortColumns: Column<CohortCard>[] = [
  { key: 'title', header: '운영단위', render: (x) => <span><b>{x.title}</b><br /><small className="muted">{x.period.label}</small></span> },
  { key: 'state', header: '상태', align: 'center', render: (x) => <StatusBadge tone={x.confirmed ? 'ok' : 'neutral'}>{x.confirmed ? mgr.completion.confirmed : mgr.completion.unconfirmed}</StatusBadge> },
  { key: 'reportDeadline', header: '제공기한', nowrap: true },
  { key: 'totalCount', header: '인원', align: 'right' },
  { key: '_open', header: '', render: (x) => <div className="u-flex u-gap-8">
    {x.reportAllowed ? <AButton size="xs" variant="primary" to={educationReportHref(x)}>{r.education}</AButton> : <AButton size="xs" disabled title={mgr.completion.reportDenied}>{r.education}</AButton>}
    {x.serviceType === 'A' ? <AButton size="xs" to={assessmentReportHref(x)}>{r.assessment}</AButton> : null}
  </div> },
];

/** /manager/reports — 기업별 교육결과보고서 (education_results_report.php) · 역량진단 보고서 (manager_test_result.php) · 학습자별 요약. */
export default function ReportsPage() {
  const { companyCode } = useManager();
  const [params, setParams, reset] = useSearchState(DEFAULTS);
  const [q, setQ] = useState(params.q);
  const navigate = useNavigate();
  const cohorts = useQuery({ queryKey: ['manager', 'completion', companyCode, ''], queryFn: ({ signal }) => managerApi.completion({ companyCode: companyCode || undefined }, signal), retry: false });
  const query = useMemo(() => ({ companyCode: companyCode || undefined, q: params.q || undefined, page: params.page, size: 20 }), [companyCode, params]);
  const list = useQuery({ queryKey: ['manager', 'trainees', query], queryFn: ({ signal }) => managerApi.trainees(query, signal), placeholderData: keepPreviousData, retry: false });
  const open = (t: TraineeRow) => navigate(`/manager/reports/${encodeURIComponent(t.id)}?studySeq=${t.studySeq}`);
  const columns: Column<TraineeRow>[] = [
    { key: 'name', header: mgr.trainees.cols.name, render: (t) => <b>{t.name ?? '—'}</b> },
    { key: 'id', header: mgr.trainees.cols.id, nowrap: true },
    { key: 'courseName', header: '과정' },
    { key: 'period', header: mgr.trainees.cols.period, nowrap: true, render: (t) => `${t.period.start} ~ ${t.period.end}` },
    { key: 'timeLabel', header: mgr.trainees.cols.time, align: 'right', nowrap: true },
    { key: 'percent', header: mgr.trainees.cols.percent, align: 'right', render: (t) => `${t.percent}%` },
    { key: 'passOk', header: mgr.trainees.cols.pass, align: 'center', render: (t) => (t.passOk ? mgr.trainees.passed : mgr.trainees.notPassed) },
    { key: '_open', header: '', render: (t) => <AButton size="xs" variant="primary" onClick={(e) => { e.stopPropagation(); open(t); }}>{r.open}</AButton> },
  ];
  return (
    <div>
      <div className={styles.head}><div><h1>{r.title}</h1><p>{r.lead}</p></div></div>
      <section className={styles.section}>
        <h2>{r.cohorts}</h2>
        {cohorts.isError ? <ManagerError error={cohorts.error} onRetry={() => void cohorts.refetch()} /> : (
          <DataTable columns={cohortColumns} rows={cohorts.data?.items} rowKey={(x) => `${x.companyCode}|${x.lectureCode}|${x.serviceType}|${x.period.start}|${x.period.end}`} loading={cohorts.isPending} size={10} dense emptyTitle={r.noCohort} emptyBody=" " />
        )}
        <Callout>{r.blocked}</Callout>
      </section>
      <section className={styles.section}>
        <h2>{r.learners}</h2>
        <FilterBar onSubmit={() => setParams({ q: q.trim() }, true)} onReset={() => { setQ(''); reset(); }}>
          <FilterField label={mgr.trainees.search} htmlFor="rp-q" width={220}><AInput id="rp-q" value={q} onChange={(e) => setQ(e.target.value)} /></FilterField>
        </FilterBar>
        <DataTable columns={columns} rows={list.data?.items} rowKey={(t) => t.studySeq} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} page={params.page} size={20} total={list.data?.total} onPageChange={(p) => setParams({ page: p })} onRowClick={open} />
      </section>
    </div>
  );
}

/** /manager/reports/:id — print-friendly summary for one enrollment (개인 진단 답변·AI 대화 제외). */
export function TraineeReportPage() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const studySeq = Number(sp.get('studySeq')) || undefined;
  const q = useQuery({ queryKey: ['manager', 'trainee', id, studySeq], queryFn: ({ signal }) => managerApi.traineeProgress(id, studySeq, signal), enabled: !!id, retry: false });
  const d = q.data;
  const today = formatDate(new Date().toISOString());
  return (
    <div>
      <div className={`${styles.head} ${styles.noPrint}`}>
        <div><h1>{r.summary}</h1><p>{r.personalNote}</p></div>
        <div className={styles.headActions}><AButton to="/manager/reports">{r.back}</AButton><AButton variant="primary" icon="file" onClick={() => window.print()} disabled={!d}>{r.print}</AButton></div>
      </div>
      {q.isError ? <ManagerError error={q.error} onRetry={() => void q.refetch()} /> : q.isPending ? <Skeleton lines={8} /> : d ? (
        <article className={styles.report}>
          <h1>{r.summary} · {d.trainee.name ?? d.trainee.id}</h1>
          <p className={styles.meta}>{d.courseName} ({d.lectureCode}) · {d.period.start} ~ {d.period.end} · {r.generated(today)}</p>
          <table>
            <tbody>
              <tr><th style={{ width: 140 }}>아이디</th><td>{d.trainee.id}</td><th style={{ width: 140 }}>사업장</th><td>{d.companyName ?? d.companyCode}</td></tr>
              <tr><th>총 학습시간</th><td>{d.timeLabel} ({d.seconds.toLocaleString('ko-KR')}초)</td><th>진도율</th><td>{d.percent}% (15시간 기준)</td></tr>
              <tr><th>수료여부</th><td>{d.passOk ? mgr.trainees.passed : mgr.trainees.notPassed}{d.incomplete ? ` (${d.incomplete.label})` : ''}</td><th>사후진단</th><td>{d.post.label}</td></tr>
            </tbody>
          </table>
          <h2>{mgr.trainee.chapters}</h2>
          <table>
            <thead><tr><th>순서</th><th>콘텐츠</th><th>차시</th><th>강의시간</th><th>진도</th><th>학습시간</th><th>최근 학습</th></tr></thead>
            <tbody>{d.chapters.map((ch) => <tr key={ch.chapterSeq}><td>{ch.order ?? ''}</td><td className={styles.left}>{ch.courseName ?? ch.lectureCode}</td><td className={styles.left}>{ch.title}</td><td>{ch.lectureTimeMin != null ? `${ch.lectureTimeMin}분` : '—'}</td><td>{Math.round(ch.progress ?? 0)}%</td><td>{formatMinutes(Math.round((ch.studyTime ?? 0) / 60))}</td><td>{ch.lastStudiedAt ?? ch.lastStudy ?? '—'}</td></tr>)}</tbody>
          </table>
          <h2>{mgr.trainee.daily}</h2>
          {d.daily.length ? (
            <table>
              <thead><tr><th>날짜</th><th>학습</th><th>인정</th><th>초과</th><th>상태</th></tr></thead>
              <tbody>{d.daily.map((x) => <tr key={x.date}><td>{x.date}</td><td>{formatMinutes(Math.round(x.seconds / 60))}</td><td>{formatMinutes(Math.round(x.creditedSec / 60))}</td><td>{x.excessSec ? formatMinutes(Math.round(x.excessSec / 60)) : '—'}</td><td>{x.statusLabel}</td></tr>)}</tbody>
            </table>
          ) : <p className="muted" style={{ fontSize: 13 }}>{mgr.trainee.noDaily}</p>}
          <p className="muted" style={{ fontSize: 11, marginTop: 18 }}>{r.personalNote}</p>
        </article>
      ) : null}
    </div>
  );
}
