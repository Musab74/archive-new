import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import styles from './My.module.css';
import { myRoomApi } from '../../shared/api/endpoints/myroom';
import { isAppError } from '../../shared/api/client';
import { useSession } from '../../shared/auth/useSession';
import { PillTabs } from '../../shared/ui/Tabs';
import { MetricCard } from '../../shared/ui/MetricCard';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { my as copy } from '../../shared/strings/ko';
import { fmtDate } from './queries';
import { cx } from '../../shared/utils/format';

const c = copy.ranking;

/** `/my/ranking` — 12 badges by category + all/company ranking (TOP10, around me). */
export default function MyRanking() {
  const { user } = useSession();
  const [scope, setScope] = useState<'all' | 'company'>('all');
  const badges = useQuery({ queryKey: ['my', 'badges'], queryFn: ({ signal }) => myRoomApi.badges(signal) });
  const ranking = useQuery({ queryKey: ['my', 'ranking', scope], queryFn: ({ signal }) => myRoomApi.ranking(scope, signal) });
  if ([badges, ranking].some((q) => q.isError && isAppError(q.error) && q.error.isAuth)) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const r = ranking.data;
  const rows = (list: NonNullable<typeof r>['top10']) => list.map((row, i) => (
    <tr key={`${row.id}-${i}`} className={cx(row.id === user?.id && styles.rowMe)}>
      <td className={styles.num}>{row.rank ?? i + 1}</td>
      <td>{row.id === user?.id ? <b>{c.me}</b> : maskId(row.id)}</td>
      <td className={styles.num}>{row.score.toLocaleString('ko-KR')}</td>
      <td className={styles.num}>{row.studyMinutes.toLocaleString('ko-KR')}</td>
      <td className={styles.num}>{row.completedCourses}</td>
      <td className={styles.num}>{Math.round(row.avgProgress)}%</td>
    </tr>
  ));
  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>
      <section className={styles.card} aria-labelledby="bd-h">
        <div className={styles.cardHead}><h2 id="bd-h">{c.badgesTitle}</h2>{badges.data ? <span className={styles.pill}>{c.badgesSummary(badges.data.summary.achieved, badges.data.summary.total)}</span> : null}</div>
        {badges.isPending ? <Skeleton height={160} /> : badges.isError ? <StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void badges.refetch()} /> : (
          <>
            {badges.data.stats ? <div className={styles.grid4} style={{ marginBottom: 16 }}>
              <MetricCard compact title={c.stats.completed} value={String(badges.data.stats.completedCourses)} />
              <MetricCard compact title={c.stats.hours} value={`${badges.data.stats.totalHours}시간`} />
              <MetricCard compact title={c.stats.streak} value={`${badges.data.stats.longestStreak}일`} />
              <MetricCard compact title={c.stats.days} value={`${badges.data.stats.totalStudyDays}일`} />
            </div> : null}
            {badges.data.categories.map((cat) => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, margin: '0 0 8px', color: 'var(--c-muted)' }}>{cat}</h3>
                <div className={styles.badges}>
                  {(badges.data.badgesByCategory[cat] ?? []).map((b) => (
                    <div key={b.id} className={cx(styles.badge, !b.achieved && styles.badgeLocked)} aria-label={`${b.name} · ${b.achieved ? c.achieved : c.locked}`}>
                      <span className={styles.badgeIcon} aria-hidden="true">{b.icon || '🏅'}</span>
                      <b>{b.name}</b>
                      <small>{b.achieved ? (b.achievedDate ? fmtDate(b.achievedDate) : c.achieved) : b.requirement ?? b.description}</small>
                      {!b.achieved ? <div className={styles.badgeBar} aria-hidden="true"><span style={{ width: `${Math.min(100, b.progress)}%` }} /></div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </section>
      <section className={styles.card} aria-labelledby="rk-h">
        <div className={styles.cardHead}><h2 id="rk-h">{c.rankingTitle}</h2><PillTabs small items={[{ key: 'all', label: c.scopeAll }, { key: 'company', label: c.scopeCompany }]} value={scope} onChange={(k) => setScope(k as 'all' | 'company')} label={c.scopeAria} /></div>
        {ranking.isPending ? <Skeleton height={140} /> : ranking.isError ? <StateBlock code="LIST_ERROR" title={c.errorTitle} body={c.errorBody} onRetry={() => void ranking.refetch()} /> : !r || r.totalUsers === 0 ? <StateBlock code="EMPTY" title={c.emptyTitle} body={c.emptyBody} hideActions /> : (
          <>
            <div className={styles.grid3} style={{ marginBottom: 16 }}>
              <MetricCard compact tone="navy" title={scope === 'company' ? `${r.companyName ?? c.scopeCompany}` : r.scopeLabel || c.scopeAll} value={(scope === 'company' ? r.companyRank : r.rank) > 0 ? c.myRank(scope === 'company' ? r.companyRank : r.rank) : c.noRank} caption={c.totalUsers(scope === 'company' ? r.companyTotal : r.totalUsers)} />
              <MetricCard compact title={c.score} value={r.score.toLocaleString('ko-KR')} caption={r.formula ? `${c.formula}: ${r.formula}` : undefined} />
              <MetricCard compact title={c.cols.minutes} value={`${(r.my?.studyMinutes ?? 0).toLocaleString('ko-KR')}분`} caption={`${c.cols.completed} ${r.my?.completedCourses ?? 0} · ${c.cols.progress} ${Math.round(r.my?.avgProgress ?? 0)}%`} />
            </div>
            <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>{c.top10}</h3>
            <table className={styles.table}><thead><tr><th scope="col" className={styles.num}>{c.cols.rank}</th><th scope="col">{c.cols.id}</th><th scope="col" className={styles.num}>{c.cols.score}</th><th scope="col" className={styles.num}>{c.cols.minutes}</th><th scope="col" className={styles.num}>{c.cols.completed}</th><th scope="col" className={styles.num}>{c.cols.progress}</th></tr></thead><tbody>{rows(r.top10)}</tbody></table>
            {r.aroundMe.length && r.rank > 10 ? <><h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>{c.aroundMe}</h3><table className={styles.table}><tbody>{rows(r.aroundMe)}</tbody></table></> : null}
          </>
        )}
      </section>
    </div>
  );
}

/** "test01" → "te***" (other learners' ids are masked). */
export function maskId(id: string): string { return id.length <= 2 ? `${id[0] ?? ''}***` : `${id.slice(0, 2)}${'*'.repeat(Math.min(5, Math.max(3, id.length - 2)))}`; }
