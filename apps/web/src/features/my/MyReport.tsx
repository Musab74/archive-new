import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { Button } from '../../shared/ui/Button';
import { MetricCard } from '../../shared/ui/MetricCard';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { AxisPromo } from '../../shared/ui/AxisPromo';
import { TypeLabel } from '../../shared/ui/Pill';
import { my as copy, learnHome, assessment as assessmentCopy } from '../../shared/strings/ko';
import { fmtDateTime, todayLabel, usageOf, useAssessmentResult, useCurrentEnrollment, useEnrollments, useMyStatus } from './queries';
import { ScoreBars } from '../assessment/AssessmentResultPage';
import { hm } from '../../shared/player/time';
import { cx } from '../../shared/utils/format';

const c = copy.report;
const DAY: Record<string, string> = { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' };

/** AR-14 학습결과보고서: status summary + assessment bars + weekly CSS chart + recent records; print view hides AXIS. */
export default function MyReport() {
  const { user } = useSession();
  const status = useMyStatus();
  const enrollments = useEnrollments();
  const current = useCurrentEnrollment();
  const result = useAssessmentResult(current.data?.studySeq ?? null, current.isSuccess && current.data.studySeq !== null);
  const weekly = useQuery({ queryKey: ['my', 'weekly'], queryFn: ({ signal }) => myRoomApi.weekly(signal) });
  const recent = useQuery({ queryKey: ['my', 'history', 'records', { page: 1, size: 4 }], queryFn: ({ signal }) => myRoomApi.historyRecords({ page: 1, size: 4 }, signal) });
  const usage = useMemo(() => usageOf(status.data, enrollments.data?.items), [status.data, enrollments.data]);
  const refund = usage.mode === 'refund';
  const s = status.data;
  if ([status, weekly].some((q) => q.isError && isAppError(q.error) && q.error.isAuth)) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const maxMin = Math.max(1, ...(weekly.data?.chartData.map((d) => d.minutes) ?? [1]));
  const dash = status.isError;

  return (
    <div className={styles.page}>
      <div className={cx(styles.head)}>
        <div><span className="eyebrow">{copy.crumb}</span><h1>{c.title(user?.name ?? '')}</h1><p>{c.lead}</p></div>
        <div className={cx(styles.headAside, styles.noPrint)}><span className={styles.note}>{c.asOf(todayLabel())}</span><Button square size="sm" onClick={() => window.print()}>{c.print}</Button></div>
      </div>
      <section className={styles.card} aria-labelledby="rep-sum">
        <div className={styles.cardHead}><h2 id="rep-sum">{c.summaryTitle}</h2><span className={styles.note}>{s?.period?.label ? `${c.period} ${s.period.label}` : ''} {dash ? '' : ''}</span></div>
        {status.isPending ? <Skeleton height={90} /> : status.isError ? <StateBlock code="ACCESS_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void status.refetch()} /> : (
          <div className={styles.grid4}>
            <MetricCard compact title={c.total} value={hm(s?.totalSeconds ?? 0)} caption={c.totalNote} />
            {refund ? <MetricCard compact tone="navy" title={c.recognized} value={hm(s?.completionSeconds ?? 0)} caption={c.recognizedNote} progress={s?.percent ?? 0} /> : <MetricCard compact tone="mint" title={learnHome.general} value={s?.period?.daysLeft != null ? learnHome.daysLeft(s.period.daysLeft) : '—'} caption={c.generalNote} />}
            {refund ? <MetricCard compact title={c.remaining} value={s?.achieved ? copy.home.achieved : hm(Math.max(0, (s?.completionCriteriaSeconds ?? 54000) - (s?.completionSeconds ?? 0)))} caption={c.remainingNote} /> : null}
            <MetricCard compact title={c.contents} value={String(weekly.data?.thisWeek.coursesStudied ?? recent.data?.total ?? '—')} caption={c.contentsNote} />
          </div>
        )}
        <p className={styles.note} style={{ marginTop: 12 }}>{c.summaryLead}</p>
      </section>

      <section className={styles.card} aria-labelledby="rep-ass">
        <div className={styles.cardHead}><h2 id="rep-ass">{c.assessmentTitle}</h2>{result.data?.comparable ? <TypeLabel tone="mint" small>{assessmentCopy.result.compare}</TypeLabel> : null}</div>
        {result.isPending && result.fetchStatus !== 'idle' ? <Skeleton lines={4} /> : result.isError || !result.data || (!result.data.pre.submitted && !result.data.post.submitted) ? (
          <StateBlock code="EMPTY" title={c.noDiagnosis} body={c.noDiagnosisBody} actions={<Button variant="secondary" square size="sm" to="/assessment/pre">{assessmentCopy.crumbPre}</Button>} />
        ) : (
          <>
            <ScoreBars pre={result.data.pre.submitted ? result.data.pre : null} post={result.data.post.submitted ? result.data.post : null} compare={result.data.comparable} />
            {!result.data.comparable && result.data.post.submitted ? <p className={styles.note}>{assessmentCopy.result.notComparableBody}</p> : null}
            <div className={cx('action-row', styles.noPrint)}><Link className="text-link" to="/assessment/result">{assessmentCopy.crumbResult} →</Link></div>
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="rep-week">
        <div className={styles.cardHead}><h2 id="rep-week">{c.weeklyTitle}</h2>{weekly.data ? <span className={styles.note}>{c.weeklyGoal(weekly.data.goal.progressRate)} · {c.weeklyStreak(weekly.data.streak)} · {c.weeklyDays(weekly.data.thisWeek.studyDays)}</span> : null}</div>
        {weekly.isPending ? <Skeleton height={160} /> : weekly.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void weekly.refetch()} /> : (
          <>
            <div className={styles.grid3} style={{ marginBottom: 16 }}>
              <MetricCard compact title={c.weeklyThis} value={weekly.data.thisWeek.formatted || hm(weekly.data.thisWeek.seconds)} />
              <MetricCard compact title={c.weeklyLast} value={hm(weekly.data.lastWeek.seconds)} caption={`${weekly.data.comparison.wowDelta >= 0 ? '+' : ''}${weekly.data.comparison.wowDelta}분 · ${weekly.data.comparison.trend}`} />
              <MetricCard compact title={copy.ranking.stats.streak} value={`${weekly.data.streak}일`} />
            </div>
            <div className={styles.chart} role="img" aria-label={c.chartAria}>
              {weekly.data.chartData.map((d) => <div key={d.date} className={styles.chartBar}><b>{d.minutes ? `${d.minutes}` : ''}</b><span style={{ height: `${Math.max(2, (d.minutes / maxMin) * 100)}%` }} title={`${d.date} ${d.minutes}분`} /></div>)}
            </div>
            <div className={styles.chartLabels} aria-hidden="true">{weekly.data.chartData.map((d) => <span key={d.date}>{DAY[d.dayOfWeek] ?? d.dayOfWeek}<br />{d.date.slice(5)}</span>)}</div>
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="rep-recent">
        <div className={styles.cardHead}><h2 id="rep-recent">{c.recentTitle}</h2><Link className={cx('text-link', styles.noPrint)} to="/my/records">{c.recentAll}</Link></div>
        <p className={styles.note}>{c.recentLead}</p>
        {recent.isPending ? <Skeleton lines={3} /> : recent.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void recent.refetch()} /> : recent.data.items.length === 0 ? <p className={styles.note}>{c.recentEmpty}</p> : (
          <table className={styles.table} style={{ marginTop: 10 }}>
            <thead><tr><th scope="col">{copy.records.cols.date}</th><th scope="col">{copy.records.cols.content}</th><th scope="col" className={styles.num}>{copy.records.cols.time}</th><th scope="col" className={styles.num}>{copy.records.cols.progress}</th></tr></thead>
            <tbody>{recent.data.items.map((r) => <tr key={`${r.lectureCode}-${r.contentsIdx ?? ''}`}><td>{fmtDateTime(r.lastAt)}</td><td><span className={styles.title}>{r.title}</span><span className={styles.sub}>{r.courseName}</span></td><td className={styles.num}>{r.formatted || hm(r.studyTime)}</td><td className={styles.num}>{Math.round(r.progress)}%</td></tr>)}</tbody>
          </table>
        )}
      </section>

      <section className={cx(styles.card, styles.soft, styles.noPrint)}><h2>{c.nextTitle}</h2><p className={styles.note}>{c.nextLead}</p><div className="action-row"><Button square size="sm" to="/roadmap">{c.toRoadmap}</Button><Button variant="secondary" square size="sm" to="/catalog">{learnHome.browse}</Button></div></section>
      <p className={styles.note}>{c.basis}</p>
      <div className={styles.noPrint}><AxisPromo variant="banner" banner="report" /></div>
    </div>
  );
}
