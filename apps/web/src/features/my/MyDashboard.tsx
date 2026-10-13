import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { ProgressRing } from '../../shared/ui/ProgressRing';
import { MetricCard } from '../../shared/ui/MetricCard';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { AxisPromo } from '../../shared/ui/AxisPromo';
import { TypeLabel } from '../../shared/ui/Pill';
import { my as copy, learnHome, contentType } from '../../shared/strings/ko';
import { fmtDateTime, qk, todayLabel, usageOf, useDashboard, useEnrollments, useMyStatus } from './queries';
import { hm } from '../../shared/player/time';
import { ringProps } from '../home/LearningHome';
import { cx } from '../../shared/utils/format';

/** AR-11 나의 학습실 홈: status ring, 상태 카드, 과정현황, 최근 학습, 미평점, shortcuts, 보정 안내, AXIS. */
export default function MyDashboard() {
  const { user } = useSession();
  const qc = useQueryClient();
  const status = useMyStatus();
  const dashboard = useDashboard();
  const enrollments = useEnrollments();
  const notices = useQuery({ queryKey: qk.notices, queryFn: ({ signal }) => myRoomApi.notices(signal) });
  const ack = useMutation({ mutationFn: () => myRoomApi.ackNotices(), onSuccess: () => void qc.invalidateQueries({ queryKey: qk.notices }) });
  const usage = useMemo(() => usageOf(status.data, enrollments.data?.items), [status.data, enrollments.data]);
  const ring = ringProps(status.data, status.isError);
  const s = status.data;
  const refund = usage.mode === 'refund';
  const c = copy.home;
  const sessionLost = [status, dashboard].some((q) => q.isError && isAppError(q.error) && q.error.isAuth);
  if (sessionLost) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const pendingNotice = notices.data?.items.find((n) => !n.acknowledged) ?? null;
  const counts = dashboard.data?.countsByType ?? {};
  const countKeys = Object.keys(counts);
  const recent = dashboard.data?.recent ?? [];
  const unrated = dashboard.data?.unrated ?? [];
  const asOf = status.dataUpdatedAt ? fmtDateTime(new Date(status.dataUpdatedAt).toISOString().replace('T', ' ')) : todayLabel();

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div><span className="eyebrow">{copy.crumb}</span><h1>{c.title(user?.name ?? '')}</h1><p>{c.lead}</p></div>
        <div className={styles.headAside}><span className={styles.note}>{c.asOf(asOf)}</span><Button variant="secondary" size="xs" square onClick={() => { void status.refetch(); void dashboard.refetch(); }}>{c.recheck}</Button></div>
      </div>

      {pendingNotice ? (
        <div className={styles.alert} role="status">
          <Icon name="info" size={18} />
          <div><b>{c.noticeTitle}</b> {c.noticeBody(pendingNotice.formatted || hm(pendingNotice.totalDeltaSec))} <Link to="/my/notices">{c.noticeDetail}</Link></div>
          <Button size="xs" square onClick={() => ack.mutate()} loading={ack.isPending}>{c.noticeAck}</Button>
        </div>
      ) : null}

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
            <div><dt>{usage.state === 'ENDED' ? c.ended : usage.state === 'BEFORE' ? c.before : c.period}</dt><dd>{s?.period?.daysLeft != null ? c.daysLeft(s.period.daysLeft) : usage.state === 'ENDED' ? c.ended : usage.state === 'BEFORE' ? c.before : '—'}</dd></div>
            <div><dt>{c.totalRecord}</dt><dd>{status.isError ? learnHome.aggregateDash : hm(s?.totalSeconds ?? 0)}</dd></div>
            {refund ? <div><dt>{c.recognized}</dt><dd>{status.isError ? learnHome.aggregateDash : hm(s?.completionSeconds ?? 0)}</dd></div> : null}
            {s?.carryoverSeconds ? <div><dt>{c.carryover}</dt><dd>{hm(s.carryoverSeconds)}{s.carryoverPeriodLabel ? ` (${s.carryoverPeriodLabel})` : ''}</dd></div> : null}
          </dl>
          <div className="action-row"><Button variant="secondary" square size="sm" to="/my/profile">{learnHome.profileLink}</Button><Button variant="secondary" square size="sm" to="/my/records">{learnHome.recordsLink}</Button></div>
        </section>
      </div>

      <div className={styles.grid4}>
        <div className={styles.hubCard}><h3>{c.cards.pre.title}</h3><p>{s?.preAssessment?.submitted ? c.cards.pre.done : c.cards.pre.todo}</p><Button variant="secondary" square size="sm" to={s?.preAssessment?.submitted ? '/assessment/result' : '/assessment/pre'}>{s?.preAssessment?.submitted ? c.cards.pre.cta : c.cards.pre.ctaTodo}</Button></div>
        <div className={styles.hubCard}><h3>{c.cards.roadmap.title}</h3><p>{c.cards.roadmap.body}</p><Button variant="secondary" square size="sm" to="/roadmap">{c.cards.roadmap.cta}</Button></div>
        <div className={styles.hubCard}><h3>{c.cards.post.title}</h3><p>{s?.postAssessment?.submitted ? c.cards.post.done : c.cards.post.todo}</p><Button variant="secondary" square size="sm" to={s?.postAssessment?.submitted ? '/assessment/result' : '/assessment/post'}>{c.cards.post.cta}</Button></div>
        <div className={styles.hubCard}><h3>{c.cards.report.title}</h3><p>{c.cards.report.body}</p><Button variant="secondary" square size="sm" to="/my/report">{c.cards.report.cta}</Button></div>
      </div>

      <section className={styles.card} aria-labelledby="counts-h">
        <h2 id="counts-h">{c.counts.title}</h2>
        {dashboard.isPending ? <Skeleton height={80} /> : dashboard.isError ? <StateBlock code="LIST_ERROR" onRetry={() => void dashboard.refetch()} /> : countKeys.length === 0 ? <p className={styles.note}>{c.recentEmptyBody}</p> : (
          <div className={styles.grid3}>
            {countKeys.map((k) => <MetricCard key={k} compact title={contentType[k] ?? k} value={<>{counts[k].enrolled}<small style={{ fontSize: 13, marginLeft: 4, color: 'var(--c-muted)' }}>{c.counts.enrolled}</small></>} caption={`${c.counts.inProgress} ${counts[k].inProgress} · ${c.counts.completed} ${counts[k].completed} · ${c.counts.notStarted} ${counts[k].notStarted}`} />)}
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="recent-h">
        <div className={styles.cardHead}><h2 id="recent-h">{c.recentTitle}</h2><Link className="text-link" to="/my/records">{c.recentAll}</Link></div>
        {dashboard.isPending ? <Skeleton lines={3} /> : dashboard.isError ? <StateBlock code="LIST_ERROR" title={c.recentFail} body={c.recentFailBody} onRetry={() => void dashboard.refetch()} /> : recent.length === 0 ? (
          <StateBlock code="EMPTY" symbol="spark" title={c.recentEmptyTitle} body={c.recentEmptyBody} actions={<Button square size="sm" to="/catalog">{learnHome.browse}</Button>} />
        ) : (
          <ul className={styles.list}>
            {recent.map((r) => (
              <li key={`${r.studySeq}-${r.chapterSeq}-${r.progressIdx ?? ''}`} className={styles.item}>
                <div className={styles.itemCopy}><span className={styles.cat}>{r.courseName}</span><span className={styles.itemTitle}>{r.title}</span><span className={styles.itemMeta}>{fmtDateTime(r.studiedAt)} · {Math.round(r.progress)}% · {hm(r.studyTime)}</span></div>
                <Button variant={r.progress >= 100 ? 'secondary' : 'primary'} square size="sm" to={`/learn/${r.studySeq}/${r.chapterSeq}?lectureCode=${encodeURIComponent(r.lectureCode)}`}>{r.progress >= 100 ? c.relearn : c.continueCta}</Button>
              </li>
            ))}
          </ul>
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
