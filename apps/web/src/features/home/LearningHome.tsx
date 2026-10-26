import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CourseCard } from '@ainex/contracts';
import styles from './LearningHome.module.css';
import { catalogApi } from '../../shared/api/endpoints/catalog';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { useDesign } from '../../shared/design/useDesign';
import { Section } from '../../shared/ui/Section';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { TypeLabel } from '../../shared/ui/Pill';
import { Tabs } from '../../shared/ui/Tabs';
import { ContentCard, ContentCardSkeleton } from '../../shared/ui/ContentCard';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { AxisPromo } from '../../shared/ui/AxisPromo';
import { ProgressRing } from '../../shared/ui/ProgressRing';
import { learnHome as copy, competencies, common } from '../../shared/strings/ko';
import { fmtDateTime, qk, todayLabel, usageOf, useDashboard, useEnrollments, useMyStatus } from '../my/queries';
import { hm } from '../../shared/player/time';
import { cx } from '../../shared/utils/format';

const COMPLETION_SEC = 54000;
const TABS = [{ key: '1', label: copy.tabOperator }, { key: '3', label: copy.tabNew }];
const BROWSE: { key: keyof typeof competencies; to: string }[] = [{ key: 'common', to: '/catalog?competency=common' }, { key: 'job', to: '/catalog?competency=job' }, { key: 'leadership', to: '/catalog?competency=leadership' }, { key: 'ai', to: '/ai-zone' }];

/** Props for the 15 h usage strip — exported for tests (ring never shows 0 for an unknown aggregate). */
export function ringProps(status: { completionSeconds?: number; percent?: number; achieved?: boolean; completionCriteriaSeconds?: number } | null | undefined, error: boolean): { percent: number | null; label: string; remaining: string | null; achieved: boolean } {
  if (error || !status) return { percent: null, label: copy.aggregateDash, remaining: null, achieved: false };
  const criteria = status.completionCriteriaSeconds || COMPLETION_SEC;
  const sec = Math.max(0, status.completionSeconds ?? 0);
  const percent = typeof status.percent === 'number' ? status.percent : Math.min(100, Math.floor((sec / criteria) * 100));
  const achieved = status.achieved ?? sec >= criteria;
  return { percent, label: hm(sec), remaining: achieved ? null : hm(criteria - sec), achieved };
}

/** AR-02 학습 홈: 이용건 strip, 이어학습, 미평점, 운영자 추천/신규, 맞춤 추천, 역량·분야, 라이브, 찜/기업교육, AXIS. */
export default function LearningHome() {
  const { user } = useSession();
  const { config } = useDesign();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useMyStatus();
  const dashboard = useDashboard();
  const enrollments = useEnrollments();
  const [tab, setTab] = useState('1');
  const list = useQuery({ queryKey: ['catalog', 'list', tab], queryFn: ({ signal }) => catalogApi.list(Number(tab), signal) });
  const recs = useQuery({ queryKey: ['catalog', 'recommendations'], queryFn: ({ signal }) => catalogApi.recommendations(signal), staleTime: 5 * 60_000 });

  const sessionLost = [status, dashboard, enrollments].some((q) => q.isError && isAppError(q.error) && q.error.isAuth);
  const usage = useMemo(() => usageOf(status.data, enrollments.data?.items), [status.data, enrollments.data]);
  const ring = ringProps(status.data, status.isError);
  const name = user?.name ?? '';
  const recent = dashboard.data?.recent?.[0] ?? null;
  const next = dashboard.data?.nextChapters ?? [];
  const unrated = dashboard.data?.unrated ?? [];
  const firstLearning = dashboard.isSuccess && !recent;
  const asOf = status.dataUpdatedAt ? fmtDateTime(new Date(status.dataUpdatedAt).toISOString().replace('T', ' ')) : todayLabel();
  const refetchStatus = () => { void qc.invalidateQueries({ queryKey: qk.status }); void qc.invalidateQueries({ queryKey: qk.dashboard }); };

  if (sessionLost) return <div className={styles.stateWrap}><StateBlock code="SESSION_EXPIRED" title={copy.sessionTitle} body={copy.sessionBody} /></div>;

  const strip = () => {
    if ((status.isPending && !status.isError) || (enrollments.isPending && !enrollments.isError)) return <div className={styles.strip} aria-busy="true"><Skeleton height={160} /><Skeleton height={160} /></div>;
    if (usage.state === 'BEFORE') return <StateBlock code="BEFORE" title={copy.beforeTitle} body={copy.beforeBody} />;
    if (usage.state === 'ENDED') return <StateBlock code="ENDED" title={copy.endedTitle} body={copy.endedBody} />;
    if (usage.state === 'NONE' && !status.isError) return <StateBlock code="NO_ACCESS" title={copy.noEnrollmentTitle} body={copy.noEnrollmentBody} />;
    const s = status.data;
    const period = s?.period ? { label: s.period.label, daysLeft: s.period.daysLeft ?? null } : usage.enrollment ? { label: `${usage.enrollment.lectureStart ?? ''} ~ ${usage.enrollment.lectureEnd ?? ''}`, daysLeft: null } : null;
    const refund = usage.mode === 'refund';
    return (
      <div className={styles.strip}>
        <div className={cx(styles.usage, status.isError && styles.usageError)}>
          <div className={styles.usageHead}>
            <TypeLabel tone={refund ? 'navy' : 'mint'}>{refund ? copy.refund : copy.general}</TypeLabel>
            <span>{copy.periodLabel} {period?.label ?? '—'}</span>
          </div>
          {refund ? (
            <div className={styles.ringRow}>
              <ProgressRing percent={ring.percent} label={ring.label} sub={copy.of15} ariaLabel={copy.recognizedTitle} tone={ring.achieved ? 'ok' : 'primary'} />
              <div className={styles.ringCopy}>
                <span className={styles.ringTitle}>{copy.recognizedTitle}</span>
                {status.isError ? (
                  <>
                    <strong className={styles.ringBig}>{copy.aggregateDash}</strong>
                    <p className={styles.ringNote}>{copy.aggregateErrorBody}</p>
                  </>
                ) : ring.achieved ? (
                  <>
                    <strong className={styles.ringBig}>{copy.achievedTitle}</strong>
                    <p className={styles.ringNote}>{copy.achievedBody}</p>
                  </>
                ) : (
                  <>
                    <strong className={styles.ringBig}>{copy.remaining(ring.remaining ?? '')} <em>{copy.learning}</em></strong>
                    <p className={styles.ringNote}>{copy.totalNote(hm(s?.totalSeconds ?? 0))}</p>
                    {s && s.carryoverSeconds > 0 ? <p className={styles.ringNote}>{copy.carryover(s.carryoverPeriodLabel ?? '', hm(s.carryoverSeconds))}</p> : null}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.generalBox}>
              <strong className={styles.generalTitle}>{copy.generalTitle}</strong>
              <span className={styles.generalDays}>{period?.daysLeft != null ? <>{copy.daysLeftShort(period.daysLeft)}<small>남음</small></> : '—'}</span>
              <p className={styles.ringNote}>{copy.generalLead}</p>
            </div>
          )}
        </div>
        <div className={styles.period}>
          {refund ? (
            <>
              <span className={styles.periodLabel}>{copy.periodLabel}</span>
              <strong className={styles.periodBig}>{period?.daysLeft != null ? copy.daysLeft(period.daysLeft) : '—'}</strong>
              <span className={styles.periodRange}>{period?.label ?? ''}</span>
              <Button variant="secondary" square size="sm" to="/my" iconRight={<Icon name="arrow" size={14} />}>{copy.myRoom}</Button>
            </>
          ) : (
            <>
              <span className={styles.periodLabel}>{copy.cumulative}</span>
              <strong className={styles.periodBig}>{status.isError ? copy.aggregateDash : hm(s?.totalSeconds ?? 0)}</strong>
              <span className={styles.periodRange}>{period?.label ?? ''}</span>
              <Button variant="secondary" square size="sm" to="/my/records" iconRight={<Icon name="arrow" size={14} />}>{copy.recordsLink}</Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <section className={`band ${styles.hero}`} aria-label={copy.crumb}>
        <div className={styles.heroHead}>
          <div>
            <h1>{copy.greeting(name)}</h1>
            <p>{copy.greetingLead}</p>
          </div>
          <Button variant="text" size="sm" to="/my/profile" iconRight={<Icon name="chevron-right" size={14} />}>{copy.profileLink}</Button>
        </div>
        {strip()}
        <p className={styles.asOf}>{copy.asOf(asOf)} · <button type="button" className="text-link" onClick={refetchStatus}>{copy.recheck}</button></p>
      </section>

      <Section num={copy.continueNum} title={copy.continueTitle} lead={copy.continueLead} aside={<Button variant="text" size="sm" to="/my/records" iconRight={<Icon name="arrow" size={14} />}>{copy.recordsLink}</Button>}>
        {dashboard.isPending ? <Skeleton height={140} /> : dashboard.isError ? (
          <StateBlock code="LIST_ERROR" title={copy.aggregateErrorTitle} body={copy.aggregateErrorBody} onRetry={() => void dashboard.refetch()} />
        ) : firstLearning ? (
          <StateBlock code="EMPTY" symbol="spark" kicker={copy.continueTitle} title={copy.firstTitle} body={copy.firstBody} actions={<><Button square size="sm" to="/catalog">{copy.browse}</Button><Button variant="secondary" square size="sm" to="/assessment/pre">{copy.preAssessment}</Button></>} />
        ) : recent ? (
          <article className={styles.continue}>
            <div className={styles.continueThumb} aria-hidden="true"><small>CONTINUE</small><strong>{recent.courseName}</strong></div>
            <div className={styles.continueCopy}>
              <span className={styles.continueCat}>{recent.courseName}</span>
              <h3>{recent.title}</h3>
              <p>{copy.lastProgress(Math.round(recent.progress), hm(recent.studyTime))}</p>
              <small>{copy.recentAt(fmtDateTime(recent.studiedAt))}</small>
              <div className="action-row">
                <Button square onClick={() => navigate(`/learn/${recent.studySeq}/${recent.chapterSeq}?lectureCode=${encodeURIComponent(recent.lectureCode)}`)} iconRight={<Icon name="arrow" size={14} />}>{copy.continueCta}</Button>
                <Button variant="secondary" square to={`/courses/${encodeURIComponent(recent.lectureCode)}`}>{common.more}</Button>
              </div>
            </div>
          </article>
        ) : null}
        {unrated.length ? (
          <div className={styles.alert} role="status">
            <Icon name="star" size={18} />
            <div><b>{copy.unratedTitle(unrated.length)}</b> {copy.unratedBody}</div>
            <Button variant="secondary" square size="sm" to={`/courses/${encodeURIComponent(unrated[0].lectureCode)}`}>{copy.unratedCta}</Button>
          </div>
        ) : null}
      </Section>

      <Section num={copy.pickNum} title={copy.pickTitle} lead={copy.pickLead} soft aside={<Button variant="text" size="sm" to="/catalog" iconRight={<Icon name="arrow" size={14} />}>{copy.allContents}</Button>}>
        <Tabs items={TABS} value={tab} onChange={setTab} label={copy.tabsAria} />
        <div className={styles.grid}>
          {list.isPending ? Array.from({ length: 4 }).map((_, i) => <ContentCardSkeleton key={i} />) : list.isError ? (
            <div className={styles.gridState}><StateBlock code="LIST_ERROR" onRetry={() => void list.refetch()} /></div>
          ) : list.data.items.length === 0 ? (
            <div className={styles.gridState}><StateBlock code="EMPTY" hideActions /></div>
          ) : list.data.items.slice(0, 4).map((c: CourseCard) => <ContentCard key={c.lectureCode} course={c} />)}
        </div>
      </Section>

      <Section num={copy.nextNum} title={copy.nextTitle} lead={copy.nextLead}>
        <div className={styles.nextHead}>
          <p>{copy.nextNote}</p>
          <div className="action-row" style={{ marginTop: 0 }}>
            <Button square size="sm" to="/roadmap">{copy.roadmap}</Button>
            <Button variant="secondary" square size="sm" to="/assessment/pre">{copy.preAssessment}</Button>
          </div>
        </div>
        <div className={styles.basis} aria-hidden="true"><span>{copy.basisAssessment}</span><span>{copy.basisSearch}</span><span>{copy.basisHistory}</span></div>
        {recs.data?.items.length ? (
          <div className={styles.grid}>
            {recs.data.items.slice(0, 3).map((c) => (
              <div key={c.lectureCode} className={styles.recCard}>
                <ContentCard course={c} />
                <span className={styles.reason}><Icon name="spark" size={12} /> {c.reason}</span>
              </div>
            ))}
          </div>
        ) : dashboard.isPending || recs.isPending ? <Skeleton height={120} /> : dashboard.isError && recs.isError ? (
          <StateBlock code="LIST_ERROR" title={copy.recommendFailTitle} body={copy.recommendFailBody} actions={<><Button square size="sm" to="/catalog">{copy.browse}</Button><Button variant="secondary" square size="sm" onClick={() => void dashboard.refetch()}>{copy.recommendRetry}</Button></>} />
        ) : next.length === 0 ? (
          <StateBlock code="EMPTY" title={copy.recommendFailTitle} body={copy.recommendFailBody} actions={<><Button square size="sm" to="/catalog">{copy.browse}</Button><Button variant="secondary" square size="sm" to="/roadmap">{copy.roadmap}</Button></>} />
        ) : (
          <ul className={styles.nextList}>
            {next.slice(0, 3).map((n) => (
              <li key={`${n.lectureCode}-${n.chapterSeq}`} className={styles.nextItem}>
                <span className={styles.nextOrder}>{String(n.order).padStart(2, '0')}</span>
                <div className={styles.nextCopy}>
                  <span className={styles.continueCat}>{n.courseName}</span>
                  <Link to={`/courses/${encodeURIComponent(n.lectureCode)}`} className={styles.nextTitle}>{n.title}</Link>
                  <span className={styles.reason}><Icon name="spark" size={12} /> {copy.reasonDefault}</span>
                </div>
                <Button variant="secondary" square size="sm" onClick={() => navigate(`/learn/${status.data?.studySeq ?? recent?.studySeq ?? ''}/${n.chapterSeq}?lectureCode=${encodeURIComponent(n.lectureCode)}`)} disabled={!(status.data?.studySeq ?? recent?.studySeq)}>{copy.continueCta}</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section num={copy.browseNum} title={copy.browseTitle} lead={copy.browseLead} soft>
        <div className={styles.browse}>
          {BROWSE.map((b) => <Link key={b.key} to={b.to} className={cx(styles.browseCard, styles[b.key])}><b>{competencies[b.key].label}</b><span>{competencies[b.key].desc}</span><Icon name="arrow" size={16} /></Link>)}
        </div>
      </Section>

      <Section num={copy.liveNum} title={copy.liveTitle} lead={copy.liveLead} aside={<Button variant="text" size="sm" to="/live" iconRight={<Icon name="arrow" size={14} />}>{copy.liveAll}</Button>}>
        <div className={styles.liveRow}>
          <div className={styles.liveEmpty}><Icon name="calendar" size={22} /><p>{copy.liveEmpty}</p><Button variant="secondary" square size="sm" to="/live">{copy.liveCta}</Button></div>
          <div className={styles.tiles}>
            <Link to="/my/saved" className={styles.tile}><Icon name="heart" size={20} /><b>{copy.savedTile}</b><Icon name="chevron-right" size={16} /></Link>
            <Link to="/my/company-training" className={styles.tile}><Icon name="briefcase" size={20} /><b>{copy.companyTile}</b><Icon name="chevron-right" size={16} /></Link>
            <p className={styles.tileNote}>{copy.companyNote}</p>
          </div>
        </div>
      </Section>

      {config.links.axisUrl ? <AxisPromo variant="banner" banner="home" /> : null}
    </div>
  );
}
