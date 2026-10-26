import { Link, useSearchParams } from 'react-router-dom';
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
import { resumeLink, useAssessmentResult } from './queries';
import { ScoreBars } from '../assessment/AssessmentResultPage';
import { hm } from '../../shared/player/time';
import { cx } from '../../shared/utils/format';

const c = copy.report;

/**
 * AR-14 학습결과보고서: one of the learner's own enrollments (selector, `?studySeq=`) — 이용정보, 학습 요약 + 이수상태, 최근 학습기록 4건
 * (that enrollment), 사전·사후 진단(/assessment/result?studySeq=), 기존 "AI 학습 리포트" 지표(tab-report.php), AI 설명 미연결 안내.
 * The print view is the same page (window.print) with navigation and AXIS hidden.
 */
export default function MyReport() {
  const { user } = useSession();
  const [sp, setSp] = useSearchParams();
  const seqParam = Number(sp.get('studySeq') ?? '') || undefined;
  const report = useQuery({ queryKey: ['my', 'report', seqParam ?? 'current'], queryFn: ({ signal }) => myRoomApi.report(seqParam, signal), retry: false });
  const d = report.data;
  const seq = d?.selected ?? null;
  const result = useAssessmentResult(seq, seq !== null);
  if (report.isError && isAppError(report.error) && report.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const refund = d?.subject.mode !== 'NON_REFUND';
  const sum = d?.summary;
  const act = d?.activity;
  const maxH = Math.max(0.01, ...(act?.daily28.map((x) => x.hours) ?? [0.01]));

  return (
    <div className={styles.page}>
      <div className={cx(styles.head)}>
        <div><span className="eyebrow">{copy.crumb}</span><h1>{c.title(d?.subject.name ?? user?.name ?? '')}</h1><p>{c.lead}</p></div>
        <div className={cx(styles.headAside, styles.noPrint)}>
          {d?.enrollments.length ? (
            <label className={styles.check}>{c.enrollment}
              <select className={styles.select} aria-label={c.enrollmentAria} value={seq ?? ''} onChange={(e) => { const n = new URLSearchParams(sp); n.set('studySeq', e.target.value); setSp(n); }}>
                {d.enrollments.map((e) => <option key={e.studySeq} value={e.studySeq}>{e.courseName} · {e.period.label}</option>)}
              </select>
            </label>
          ) : null}
          <Button square size="sm" onClick={() => window.print()} disabled={!sum}>{c.print}</Button>
        </div>
      </div>

      {report.isPending ? <Skeleton height={200} /> : report.isError ? (
        <StateBlock code={isAppError(report.error) && report.error.status === 404 ? 'NOT_FOUND' : 'ACCESS_ERROR'} title={c.errorTitle} body={c.errorBody} onRetry={() => void report.refetch()} />
      ) : !sum || !d ? (
        <StateBlock code="NO_ACCESS" title={c.noEnrollmentTitle} body={c.noEnrollmentBody} />
      ) : (
        <>
          <section className={styles.card} aria-labelledby="rep-sub">
            <div className={styles.cardHead}><h2 id="rep-sub">{c.subjectTitle}</h2><TypeLabel tone={refund ? 'navy' : 'mint'} small>{refund ? c.modeRefund : c.modeGeneral}</TypeLabel></div>
            <dl className={styles.kv}>
              <div><dt>{c.subject.name}</dt><dd>{d.subject.name}</dd></div>
              <div><dt>{c.subject.company}</dt><dd>{d.subject.companyName || '—'}</dd></div>
              <div><dt>{c.subject.course}</dt><dd>{d.subject.courseName} <span className={styles.note}>#{d.selected}</span></dd></div>
              <div><dt>{c.subject.period}</dt><dd>{d.subject.period?.label ?? '—'}</dd></div>
              <div><dt>{c.subject.state}</dt><dd>{c.state[d.subject.state ?? ''] ?? d.subject.state}</dd></div>
              <div><dt>{c.subject.checkedAt}</dt><dd>{d.checkedAt}</dd></div>
            </dl>
          </section>

          <section className={styles.card} aria-labelledby="rep-sum">
            <div className={styles.cardHead}><h2 id="rep-sum">01 {c.summaryTitle}</h2><span className={cx(styles.pill, sum.passOk ? styles.pillOk : styles.pillInfo)}>{sum.completion.label}</span></div>
            <div className={styles.grid4}>
              <MetricCard compact title={c.total} value={hm(sum.totalSeconds)} caption={c.totalNote} />
              {refund ? <MetricCard compact tone="navy" title={c.recognized} value={hm(sum.completionSeconds)} caption={c.recognizedNote} progress={sum.percent ?? 0} /> : <MetricCard compact tone="mint" title={learnHome.general} value={d.subject.period?.end ?? '—'} caption={c.generalNote} />}
              {refund ? <MetricCard compact title={c.remaining} value={sum.achieved ? copy.home.achieved : hm(Math.max(0, 54000 - sum.completionSeconds))} caption={c.remainingNote} /> : null}
              <MetricCard compact title={c.contents} value={c.contentsCount(sum.contentCount, sum.completedContents)} caption={c.contentsNote} />
            </div>
            {sum.completion.note ? <p className={styles.note} style={{ marginTop: 12 }}>{sum.completion.note}</p> : null}
            <p className={styles.note} style={{ marginTop: 6 }}>{c.summaryLead}</p>
          </section>

          <section className={styles.card} aria-labelledby="rep-recent">
            <div className={styles.cardHead}><h2 id="rep-recent">02 {c.recentTitle}</h2><Link className={cx('text-link', styles.noPrint)} to={`/my/records?studySeq=${d.selected}`}>{c.recentAll}</Link></div>
            <p className={styles.note}>{c.recentLead}</p>
            {d.recent.length === 0 ? <p className={styles.note}>{c.recentEmpty}</p> : (
              <table className={styles.table} style={{ marginTop: 10 }}>
                <thead><tr><th scope="col">{copy.records.courses.cols.content}</th><th scope="col">{copy.records.courses.cols.date}</th><th scope="col" className={styles.num}>{copy.records.courses.cols.time}</th><th scope="col" className={styles.num}>{copy.records.courses.cols.progress}</th><th scope="col" className={styles.noPrint} /></tr></thead>
                <tbody>{d.recent.map((r) => <tr key={`${r.lectureCode}-${r.studySeq}`}><td><span className={styles.title}>{r.name ?? r.lectureCode}</span><span className={styles.sub}>{r.serviceTypeName} · {r.statusText}</span></td><td>{r.lastStudyDate ?? '-'}</td><td className={styles.num}>{r.formatted}</td><td className={styles.num}>{r.progress}%</td><td className={styles.noPrint}><Link className="text-link" to={resumeLink(r)}>{r.completed ? copy.records.courses.review : copy.records.courses.resume}</Link></td></tr>)}</tbody>
              </table>
            )}
          </section>

          <section className={styles.card} aria-labelledby="rep-ass">
            <div className={styles.cardHead}><h2 id="rep-ass">03 {c.assessmentTitle}</h2>{result.data?.comparable ? <TypeLabel tone="mint" small>{assessmentCopy.result.compare}</TypeLabel> : null}</div>
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

          <section className={styles.card} aria-labelledby="rep-ai">
            <h2 id="rep-ai">04 {c.aiTitle}</h2>
            <p className={styles.note}>{c.aiBody}</p>
          </section>

          {act ? (
            <section className={styles.card} aria-labelledby="rep-act">
              <div className={styles.cardHead}><h2 id="rep-act">{c.activityTitle}</h2><span className={styles.note}>{c.activityLead}</span></div>
              <div className={styles.grid4}>
                <MetricCard compact title={c.activity.week} value={act.week.formatted} caption={c.activity.weekNote(act.week.rangeLabel)} />
                <MetricCard compact title={c.activity.avg} value={`${act.avgCourseProgress}%`} />
                <MetricCard compact title={c.activity.rate} value={`${act.completionRate}%`} caption={c.activity.rateNote(act.completedCourses, act.coursesStudied)} />
                {refund && sum.percent !== null ? <MetricCard compact title={c.activity.goal} value={`${sum.percent}%`} caption={c.remainingNote} progress={sum.percent} /> : <MetricCard compact title={c.activity.days} value={`${act.studyDays}일`} />}
              </div>
              <div className={styles.grid2} style={{ marginTop: 18 }}>
                <div>
                  <h3 style={{ fontSize: 15 }}>{c.top5Title}</h3>
                  {act.top5.length === 0 ? <p className={styles.note}>{c.recentEmpty}</p> : act.top5.map((t) => <div key={t.lectureCode} className={styles.bar}><span>{t.name ?? t.lectureCode}</span><span className={styles.note}>{c.top5Row(t.minutes, t.progress)}</span></div>)}
                </div>
                <div>
                  <h3 style={{ fontSize: 15 }}>{c.doneWeekTitle}</h3>
                  {act.completedThisWeek.length === 0 ? <p className={styles.note}>{c.doneWeekEmpty}</p> : act.completedThisWeek.map((t) => <div key={t.lectureCode} className={styles.bar}><span>{t.name ?? t.lectureCode}</span></div>)}
                  <h3 style={{ fontSize: 15, marginTop: 14 }}>{c.donutTitle}</h3>
                  <p className={styles.note}>{act.donut.total ? c.donut(act.donut.total, act.donut.completed, act.donut.incomplete) : c.donutEmpty}</p>
                </div>
              </div>
              <h3 style={{ fontSize: 15, marginTop: 18 }}>{c.dailyTitle}</h3>
              {act.daily28.length === 0 ? <p className={styles.note}>{c.dailyEmpty}</p> : (
                <div className={styles.chart28} role="img" aria-label={c.dailyAria}>
                  {act.daily28.map((x) => <span key={x.date} style={{ height: `${Math.max(2, (x.hours / maxH) * 100)}%` }} title={`${x.date} ${hm(x.seconds)}`} />)}
                </div>
              )}
            </section>
          ) : null}

          <section className={cx(styles.card, styles.soft, styles.noPrint)}><h2>05 {c.nextTitle}</h2><p className={styles.note}>{c.nextLead}</p><div className="action-row"><Button square size="sm" to="/roadmap">{c.toRoadmap}</Button><Button variant="secondary" square size="sm" to="/catalog">{learnHome.browse}</Button></div></section>
          <p className={styles.note}>{d.notice}</p>
          <p className={styles.note}>{c.basis}</p>
        </>
      )}
      <div className={styles.noPrint}><AxisPromo variant="banner" banner="report" /></div>
    </div>
  );
}
