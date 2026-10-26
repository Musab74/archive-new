import styles from '../assessment/Assessment.module.css';
import { isAppError } from '../../shared/api/client';
import type { Panel, PanelsView } from '../../shared/api/endpoints/assessment';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { assessment as copy, my as myCopy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';
import { scopeSearch, usePanels } from '../assessment/queries';
import { growthIcon } from '../assessment/AssessmentResultPage';

const h = copy.hub;

/** PHP preAssessmentNextUrl / postUrl → SPA links (grant_use=1&grant_study_seq / retro_study_seq / retro_clear=1). */
const preLink = (p: Panel) => `/assessment/pre${p.grants.pre ? scopeSearch(p.studySeq, true) : p.isActive ? '' : scopeSearch(p.studySeq)}`;
const postLink = (p: Panel) => `/assessment/post${p.grants.post ? scopeSearch(p.studySeq, true) : p.isRetro ? scopeSearch(p.studySeq) : ''}`;
const preButton = (p: Panel) => (p.pre.started ? copy.pre.resume : copy.pre.start);

function StateBadge({ state }: { state: string }) {
  return <span className={cx(styles.badge, state === 'complete' && styles.ok, state === 'in_progress' && styles.warn)} title={h.title}>{h.postState[state] ?? state}</span>;
}

/** tab-assessment-panel.php: one enrollment's banners, total circles, growth/CTA and the 세부 역량별 분석. */
function PanelView({ p }: { p: Panel }) {
  const { scores } = p;
  const diff = Math.round((scores.total.post - scores.total.pre) * 10) / 10;
  return (
    <section className={styles.form} aria-label={copy.periodLabel(p.label)}>
      <p className={styles.panelLabel}>{copy.periodLabel(p.label)}{p.isRetro ? <span className={styles.badge}>{h.retroBadge}</span> : null}<StateBadge state={p.post.state} /></p>

      {p.fifteenHours && !p.post.completed && scores.total.pre > 0 ? <div className={styles.banner} role="status"><strong>{h.fifteenBannerTitle}</strong>{h.fifteenBanner}</div> : null}
      {p.grants.pre && !p.pre.completed && p.isRetro ? (
        <div className={cx(styles.banner, styles.warn)} role="status"><strong>{h.grantTitle}</strong>{h.preGrantBanner}<div className="action-row"><Button size="sm" square to={preLink(p)}>{preButton(p)}</Button></div></div>
      ) : null}
      {p.grants.post && !p.post.completed ? <div className={styles.banner} role="status"><strong>{h.grantTitle}</strong>{h.postGrantBanner}</div> : null}
      {p.isRetro && !p.post.completed && !p.grants.pre ? (
        <div className={cx(styles.banner, styles.ok)} role="status">
          <strong>{h.retroTitle}</strong>{h.retroBanner}
          <div className="action-row">
            {p.retroWritable ? <Button size="sm" square to={postLink(p)}>{p.post.started ? h.retroResume : p.grants.post ? h.retroStartGrant : h.retroStart}</Button> : <span className={styles.note}>{h.retroLocked}</span>}
          </div>
        </div>
      ) : null}

      <article className={styles.panelCard} data-study-seq={p.studySeq}>
        <div className={styles.totals}>
          <div className={cx(styles.totalCard, !scores.total.pre && styles.dim)}><span>{h.preScore}</span><b>{scores.total.pre > 0 ? scores.total.pre : h.incomplete}</b>{scores.total.pre > 0 ? <small>{h.point}</small> : null}</div>
          <span className={styles.arrow} aria-hidden="true"><Icon name="arrow" size={22} /></span>
          <div className={cx(styles.totalCard, !scores.total.post && styles.dim)}><span>{h.postScore}</span><b>{scores.total.post > 0 ? scores.total.post : h.incomplete}</b>{scores.total.post > 0 ? <small>{h.point}</small> : null}</div>
        </div>
        {scores.total.pre > 0 && p.post.completed ? (
          <div className={cx(styles.growth, diff > 0 && styles.up, diff < 0 && styles.down)}>
            <Icon name={growthIcon(diff)} size={18} />
            <div>{diff > 0 ? <><b>{h.growthUp(diff)}</b> {h.growthUpBody}</> : diff < 0 ? <><b>{h.growthDown(Math.abs(diff))}</b> {h.growthDownBody}</> : <><b>{h.growthSame}</b> {h.growthSameBody}</>}</div>
          </div>
        ) : p.pre.completed && !p.post.completed && !p.isRetro ? (
          <div className={styles.cta}>{p.fifteenHours ? <Button square to={postLink(p)}>{copy.post.start}</Button> : <p className={styles.note}>{h.need15h}</p>}</div>
        ) : !p.pre.completed && !p.isRetro ? (
          <div className={styles.cta}><Button square to={preLink(p)}>{preButton(p)}</Button></div>
        ) : null}
        <div className="action-row"><Button variant="secondary" size="sm" square to={`/assessment/result${scopeSearch(p.isActive ? null : p.studySeq)}`}>{h.detail}</Button></div>
      </article>

      <article className={styles.panelCard}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{h.categoriesTitle}</h2>
        <div className={styles.cats}>
          {h.categories.map((c) => {
            const s = scores[c.key];
            return (
              <div key={c.key} className={styles.cat}>
                <h3>{c.title}</h3><p>{c.sub}</p>
                {s.pre > 0 || s.post > 0 ? (
                  <div className={styles.catBars}>
                    {(['pre', 'post'] as const).map((k) => (
                      <div key={k} className={styles.barRow}>
                        <span className={styles.barLabel}>{k === 'pre' ? copy.result.preLabel : copy.result.postLabel}</span>
                        <div className={styles.barTrack} role="img" aria-label={`${c.title} ${k === 'pre' ? copy.result.preLabel : copy.result.postLabel} ${s[k] > 0 ? `${s[k]}${h.point}` : h.incomplete}`}><span className={k === 'pre' ? styles.barPre : styles.barPost} style={{ width: `${Math.min(100, s[k])}%` }} /></div>
                        <span className={styles.diff}>{s[k] > 0 ? `${s[k]}${h.point}` : h.incomplete}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className={styles.noData}>{h.noData}</p>}
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

/** `/my/assessment` — AR-08 역량진단 결과 hub: port of public/mypage/tabs/tab-assessment.php (active, 1차 and admin-opened enrollments). */
export default function MyAssessmentHub() {
  const q = usePanels();
  if (q.isError && isAppError(q.error) && q.error.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
  const v: PanelsView | undefined = q.data;
  const active = v?.panels.find((p) => p.isActive) ?? null;
  return (
    <div className={styles.page}>
      <div className={styles.stepHead}>
        <div><span className="eyebrow">{copy.crumbResult}</span><h1>{h.title}</h1><p>{h.lead}</p></div>
        {active ? <StateBadge state={active.post.state} /> : null}
      </div>
      {q.isPending ? <Skeleton height={220} /> : q.isError ? <StateBlock code="ACCESS_ERROR" title={copy.loadFailTitle} body={copy.loadFailBody} onRetry={() => void q.refetch()} /> : v!.mandatoryPre && active ? (
        // tab-assessment.php:62-82 — the 사전 is required before the tab shows results
        <div className={cx(styles.banner, styles.danger)} role="alert">
          <strong>{h.mandatoryTitle}</strong>{h.mandatoryBody}
          <div className="action-row"><Button square to={preLink(active)}>{preButton(active)}</Button></div>
        </div>
      ) : !v!.panels.length ? (
        <StateBlock code="NO_ACCESS" title={copy.noEnrollmentTitle} body={copy.noEnrollmentBody} />
      ) : (
        <>
          {v!.panels.map((p) => <PanelView key={p.studySeq} p={p} />)}
          {active && (active.scores.total.pre > 0 || active.scores.total.post > 0) ? (
            <section className={styles.useBox} aria-label={h.aiTitle}><h2>{h.aiTitle}</h2><p className={styles.note}>{h.aiLine(active.scores.total.pre, active.scores.total.post)}</p></section>
          ) : null}
          <div className="action-row"><Button variant="secondary" square to="/roadmap">{copy.toRoadmap}</Button><Button variant="secondary" square to="/my/surveys">{myCopy.surveys.title}</Button></div>
        </>
      )}
      <p className={styles.note}>{h.note}</p>
    </div>
  );
}
