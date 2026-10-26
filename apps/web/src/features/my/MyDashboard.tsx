import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { useToast } from '../../app/providers/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { ProgressRing } from '../../shared/ui/ProgressRing';
import { MetricCard } from '../../shared/ui/MetricCard';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { AxisPromo } from '../../shared/ui/AxisPromo';
import { TypeLabel } from '../../shared/ui/Pill';
import { my as copy, learnHome, contentType } from '../../shared/strings/ko';
import { fmtDateTime, todayLabel, usageOf, useDashboard, useEnrollments, useMyStatus } from './queries';
import MyCourseTables from './MyCourseTables';
import { hm } from '../../shared/player/time';
import { ringProps } from '../home/LearningHome';
import { cx } from '../../shared/utils/format';

/** tab-status.php $formatMinutes: "{h}시간 {m}분", hours dropped when 0. */
const minutesLabel = (m: number) => `${Math.floor(m / 60) > 0 ? `${Math.floor(m / 60)}시간 ` : ''}${m % 60}분`;
/** study_time_utils.php carry-over format "%02d시간 %02d분". */
const hhmm = (sec: number) => `${String(Math.floor(sec / 3600)).padStart(2, '0')}시간 ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}분`;

/**
 * AR-11 나의 학습실 홈 (no AI ZONE block — 00_적용안내.md §2): status ring, 상태(수료/수료증), 학습 리마인더, 학습 코멘트, 진단 카드,
 * 학습한 콘텐츠 수, 진행중 과정(최근 학습), 미평점, shortcuts, 학습시간 재계산 안내 popup, AXIS.
 */
export default function MyDashboard() {
  const { user } = useSession();
  const { toast } = useToast();
  const status = useMyStatus();
  const dashboard = useDashboard();
  const enrollments = useEnrollments();
  const [tablesOpen, setTablesOpen] = useState(false);
  const usage = useMemo(() => usageOf(status.data, enrollments.data?.items), [status.data, enrollments.data]);
  const ring = ringProps(status.data, status.isError);
  const s = status.data;
  const refund = usage.mode === 'refund';
  const c = copy.home;
  const sessionLost = [status, dashboard].some((q) => q.isError && isAppError(q.error) && q.error.isAuth);
  if (sessionLost) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const counts = dashboard.data?.contentCounts;
  const typeCounts = dashboard.data?.countsByType ?? {};
  const inProgress = dashboard.data?.inProgress ?? [];
  const unrated = dashboard.data?.unrated ?? [];
  const asOf = status.dataUpdatedAt ? fmtDateTime(new Date(status.dataUpdatedAt).toISOString().replace('T', ' ')) : todayLabel();
  const printCertificate = async () => {
    const seq = s?.certificate?.studySeq;
    if (!seq) return;
    const win = window.open('', '_blank');
    try { await myRoomApi.certificatePdf(seq, win); } catch (e) { toast(isAppError(e) ? e.message : copy.certificates.pdfFail, { tone: 'danger' }); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div><span className="eyebrow">{copy.crumb}</span><h1>{c.title(user?.name ?? '')}</h1><p>{c.lead}</p></div>
        <div className={styles.headAside}><span className={styles.note}>{c.asOf(asOf)}</span><Button variant="secondary" size="xs" square onClick={() => { void status.refetch(); void dashboard.refetch(); }}>{c.recheck}</Button></div>
      </div>


      <div className={styles.statusRow}>
        <section className={cx(styles.card)} aria-label={refund ? c.statusRefund : c.statusGeneral}>
          {status.isPending ? <Skeleton height={150} /> : usage.state === 'NONE' && !status.isError ? (
            <StateBlock code="NO_ACCESS" title={learnHome.noEnrollmentTitle} body={learnHome.noEnrollmentBody} />
          ) : (
            <div className={styles.ringRow}>
              {refund ? <ProgressRing percent={ring.percent} label={ring.label} sub={c.statusGoal} ariaLabel={c.statusRefund} tone={ring.achieved ? 'ok' : 'primary'} /> : null}
              <div className={styles.ringCopy}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><TypeLabel tone={refund ? 'navy' : 'mint'} small>{refund ? learnHome.refund : learnHome.general}</TypeLabel><span className={styles.ringTitle}>{refund ? c.statusRefund : c.statusGeneral}</span></div>
                {status.isError ? (
                  <><strong className={styles.ringBig}>{learnHome.aggregateDash}</strong><p className={styles.ringNote}>{c.aggregateFailBody}</p><div><Button size="xs" square variant="secondary" onClick={() => void status.refetch()}>{c.recheck}</Button></div></>
                ) : refund ? (
                  <>
                    <strong className={styles.ringBig}>{ring.achieved ? c.achieved : c.remaining(ring.remaining ?? '')}</strong>
                    <p className={styles.ringNote}>{ring.achieved ? c.achievedNote : usage.state === 'ENDED' ? c.endedNote : usage.state === 'BEFORE' ? c.beforeNote : learnHome.totalNote(hm(s?.totalSeconds ?? 0))}</p>
                    {s?.currentMinutes !== undefined ? (
                      <p className={styles.ringNote} title={s.carryoverSeconds ? c.carryTitle : undefined}>
                        <b>{c.newTime}</b> {c.newTimeValue(minutesLabel(s.currentMinutes))}
                        {s.carryoverSeconds ? <><br />{c.carryLine(s.carryoverPeriodLabel || '1차 수강', hhmm(s.carryoverSeconds))}<br />{c.newLine(s.latestPeriod ? `${s.latestPeriod.start} ~ ${s.latestPeriod.end}` : '-', minutesLabel(s.currentMinutes))}</> : null}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <><strong className={styles.ringBig}>{hm(s?.totalSeconds ?? 0)}</strong><p className={styles.ringNote}>{c.statusGeneralLead}</p></>
                )}
              </div>
            </div>
          )}
        </section>
        <section className={styles.card} aria-label={c.period}>
          <dl className={styles.kv}>
            <div><dt>{c.period}</dt><dd>{s?.period?.label ?? (usage.enrollment ? `${usage.enrollment.lectureStart ?? ''} ~ ${usage.enrollment.lectureEnd ?? ''}` : '—')}</dd></div>
            <div><dt>{usage.state === 'ENDED' ? c.ended : usage.state === 'BEFORE' ? c.before : c.period}</dt><dd>{usage.state === 'ENDED' ? c.ended : usage.state === 'BEFORE' ? c.before : s?.period?.daysLeft != null && s.period.daysLeft >= 0 ? c.daysLeft(s.period.daysLeft) : '—'}</dd></div>
            <div><dt>{c.totalRecord}</dt><dd>{status.isError ? learnHome.aggregateDash : hm(s?.totalSeconds ?? 0)}</dd></div>
            {refund ? <div><dt>{c.recognized}</dt><dd>{status.isError ? learnHome.aggregateDash : hm(s?.completionSeconds ?? 0)}</dd></div> : null}
            {s?.carryoverSeconds ? <div><dt>{c.carryover}</dt><dd>{hm(s.carryoverSeconds)}{s.carryoverPeriodLabel ? ` (${s.carryoverPeriodLabel})` : ''}</dd></div> : null}
            {refund && s?.pass ? (
              <div><dt>{c.passTitle}</dt><dd style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={cx(styles.pill, s.pass.passed ? styles.pillOk : styles.pillWarn)} title={s.pass.hint || undefined}>{s.pass.passed ? c.passed(s.pass.label) : c.notPassed(s.pass.label)}</span>
                {s.pass.passed && s.certificate?.waiting && s.certificate.availableFrom ? <span className={cx(styles.pill, styles.pillWarn)} title={s.certificate.waitTitle ?? undefined}>{c.certWait(s.certificate.availableFrom)}</span> : null}
                {s.pass.passed && s.certificate?.printable ? <Button size="xs" square onClick={() => void printCertificate()}>{c.certPrint}</Button> : null}
              </dd></div>
            ) : null}
            {s?.dDay ? <div><dt>{c.reminderTitle}</dt><dd><span className={cx(styles.pill, s.dDay.tone === 'danger' ? styles.pillDanger : s.dDay.tone === 'warning' ? styles.pillWarn : styles.pillInfo)}>{s.dDay.label}</span></dd></div> : null}
          </dl>
          <div className="action-row"><Button variant="secondary" square size="sm" to="/my/profile">{learnHome.profileLink}</Button><Button variant="secondary" square size="sm" to="/my/records">{learnHome.recordsLink}</Button></div>
        </section>
      </div>

      {refund && s?.coachComment && !status.isError ? (
        <section className={cx(styles.card, styles.soft)} aria-label={c.coachTitle}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Icon name="spark" size={18} /><p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{s.coachComment}</p></div>
        </section>
      ) : null}

      <div className={styles.grid4}>
        <div className={styles.hubCard}><h3>{c.cards.pre.title}</h3><p>{s?.preAssessment?.submitted ? c.cards.pre.done : c.cards.pre.todo}</p><Button variant="secondary" square size="sm" to={s?.preAssessment?.submitted ? '/assessment/result' : '/assessment/pre'}>{s?.preAssessment?.submitted ? c.cards.pre.cta : c.cards.pre.ctaTodo}</Button></div>
        <div className={styles.hubCard}><h3>{c.cards.roadmap.title}</h3><p>{c.cards.roadmap.body}</p><Button variant="secondary" square size="sm" to="/roadmap">{c.cards.roadmap.cta}</Button></div>
        <div className={styles.hubCard}><h3>{c.cards.post.title}</h3><p>{s?.postAssessment?.submitted ? c.cards.post.done : c.cards.post.todo}</p><Button variant="secondary" square size="sm" to={s?.postAssessment?.submitted ? '/assessment/result' : '/assessment/post'}>{c.cards.post.cta}</Button></div>
        <div className={styles.hubCard}><h3>{c.cards.report.title}</h3><p>{c.cards.report.body}</p><Button variant="secondary" square size="sm" to="/my/report">{c.cards.report.cta}</Button></div>
      </div>

      <section className={styles.card} aria-labelledby="counts-h">
        <div className={styles.cardHead}><h2 id="counts-h">{c.contentCounts}</h2><div className={styles.segRow}>{counts ? <span className={styles.pill}>{c.contentCountsTotal(counts.heroTotal)}</span> : null}<Button variant="secondary" size="xs" square onClick={() => setTablesOpen((v) => !v)} aria-expanded={tablesOpen}>{tablesOpen ? c.tablesClose : c.tablesOpen}</Button></div></div>
        {dashboard.isPending ? <Skeleton height={80} /> : dashboard.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void dashboard.refetch()} /> : counts ? (
          <div className={styles.grid3}>
            {(['X', 'Y', 'Z'] as const).map((k) => <MetricCard key={k} compact title={contentType[k] ?? k} value={c.countUnit(counts[k])} caption={typeCounts[k] ? `${c.counts.inProgress} ${typeCounts[k].inProgress} · ${c.counts.completed} ${typeCounts[k].completed}` : undefined} />)}
          </div>
        ) : <p className={styles.note}>{c.recentEmptyBody}</p>}
        {tablesOpen ? <div style={{ marginTop: 18 }}><MyCourseTables /></div> : null}
      </section>

      <section className={styles.card} aria-labelledby="recent-h">
        <div className={styles.cardHead}><h2 id="recent-h">{c.recentTitle}</h2><Link className="text-link" to="/my/records">{c.recentAll}</Link></div>
        {dashboard.isPending ? <Skeleton lines={3} /> : dashboard.isError ? <StateBlock code="LIST_ERROR" title={c.recentFail} body={c.recentFailBody} onRetry={() => void dashboard.refetch()} /> : inProgress.length ? (
          <ul className={styles.list}>
            {inProgress.map((r) => {
              const done = r.calculatedProgress >= 100;
              const to = r.resumeChapterSeq ? `/learn/${r.studySeq}/${r.resumeChapterSeq}?lectureCode=${encodeURIComponent(r.lectureCode)}` : `/courses/${encodeURIComponent(r.lectureCode)}`;
              return (
                <li key={`${r.studySeq}-${r.lectureCode}`} className={styles.course}>
                  <span className={styles.courseThumb} style={r.thumbnailUrl ? { backgroundImage: `url('${r.thumbnailUrl}')` } : undefined} aria-hidden="true" />
                  <div className={styles.itemCopy}>
                    <span className={styles.cat}>{done ? copy.saved.learning.DONE : copy.saved.learning.LEARNING}</span>
                    <span className={styles.itemTitle}>{r.name}</span>
                    {r.eduGoal ? <span className={styles.itemMeta}>{r.eduGoal}</span> : null}
                    <span className={styles.itemMeta}>{r.typeLabel} · {c.recentAt(r.recentDate ?? '-')}{r.chapter != null ? ` · ${c.chapters(r.chapter)}` : ''} · {r.contentsTime}</span>
                    <div className={styles.progressBar} aria-label={`${r.progress}%`}><span style={{ width: `${Math.max(0, Math.min(100, r.progress))}%` }} /></div>
                    <span className={styles.itemMeta}><b>{r.progress}%</b> ({r.formatted}) · {r.comment}</span>
                  </div>
                  <Button variant={done ? 'secondary' : 'primary'} square size="sm" to={to}>{done ? c.relearn : c.continueCta}</Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <StateBlock code="EMPTY" symbol="spark" title={c.inProgressEmpty} body={c.recentEmptyBody} actions={<Button square size="sm" to="/catalog">{learnHome.browse}</Button>} />
        )}
        {unrated.length ? <div className={styles.alert} role="status" style={{ marginTop: 14 }}><Icon name="star" size={18} /><div><b>{c.unrated(unrated.length)}</b> {c.unratedBody}</div><Button variant="secondary" square size="xs" to={`/courses/${encodeURIComponent(unrated[0].lectureCode)}`}>{c.unratedCta}</Button></div> : null}
      </section>

      <section aria-labelledby="sc-h">
        <h2 id="sc-h" style={{ fontSize: 17, margin: '0 0 12px' }}>{c.shortcutsTitle}</h2>
        <div className={styles.grid4}>{c.shortcuts.map((sc) => <Link key={sc.to} to={sc.to} className={styles.shortcut}><b>{sc.title}</b><span>{sc.body}</span><Icon name="chevron-right" size={16} /></Link>)}</div>
        <p className={styles.note} style={{ marginTop: 10 }}>{c.footNote}</p>
      </section>
      <AxisPromo variant="banner" banner="my" />
    </div>
  );
}
