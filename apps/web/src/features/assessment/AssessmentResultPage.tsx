import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './Assessment.module.css';
import { isAppError } from '../../shared/api/client';
import type { AssessmentScore } from '../../shared/api/schemas';
import type { ScoreRow } from '../../shared/api/endpoints/assessment';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { AxisPromo } from '../../shared/ui/AxisPromo';
import { TypeLabel } from '../../shared/ui/Pill';
import { assessment as copy, nav } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';
import { scopeFromSearch, scopeSearch, useResult } from './queries';

const CATS: { key: keyof typeof copy.result.categories; pick: (s: AssessmentScore) => number }[] = [
  { key: 'common', pick: (s) => s.common }, { key: 'leader', pick: (s) => s.leader }, { key: 'job', pick: (s) => s.job }, { key: 'total', pick: (s) => s.total },
];

/** Pure CSS category bars (0–100). `compare` renders pre + post side by side. Also used by 학습결과보고서. */
export function ScoreBars({ pre, post, compare }: { pre: AssessmentScore | null; post: AssessmentScore | null; compare: boolean }) {
  return (
    <ul className={styles.bars} aria-label={copy.result.scale}>
      {CATS.map((c) => {
        const p = pre ? c.pick(pre) : null;
        const q = post ? c.pick(post) : null;
        return (
          <li key={c.key} className={cx(styles.barRow, c.key === 'total' && styles.barTotal)}>
            <span className={styles.barLabel}>{copy.result.categories[c.key]}</span>
            <div className={styles.barTracks}>
              <div className={styles.barTrack} role="img" aria-label={`${copy.result.preLabel} ${copy.result.categories[c.key]} ${p === null ? copy.result.noResult : p}`}><span className={styles.barPre} style={{ width: `${Math.min(100, Math.max(0, p ?? 0))}%` }} /><b>{p === null ? '—' : p}</b></div>
              {compare ? <div className={styles.barTrack} role="img" aria-label={`${copy.result.postLabel} ${copy.result.categories[c.key]} ${q === null ? copy.result.noResult : q}`}><span className={styles.barPost} style={{ width: `${Math.min(100, Math.max(0, q ?? 0))}%` }} /><b>{q === null ? '—' : q}</b></div> : null}
            </div>
            {compare && p !== null && q !== null ? <span className={cx(styles.diff, q - p > 0 && styles.diffUp, q - p < 0 && styles.diffDown)} aria-label={`차이 ${(q - p).toFixed(1)}`}>{q - p > 0 ? '+' : ''}{(q - p).toFixed(1)}</span> : <span className={styles.diff} />}
          </li>
        );
      })}
    </ul>
  );
}

/** tab-assessment-panel.php ph-trend-up / ph-trend-down / ph-minus. */
export const growthIcon = (diff: number) => (diff > 0 ? 'trending' : diff < 0 ? 'alert' : 'minus') as 'trending' | 'alert' | 'minus';

/** prev_test_result.html cells: `intval == 0 → "-"`, else round() + "점"; change = "%+d" of round(post − pre) or "-" without a post score. */
export const scoreCell = (v: number | null) => (!v || Math.trunc(v) === 0 ? '-' : `${Math.round(v)}점`);
export const diffCell = (pre: number | null, post: number | null) => {
  if (!post) return '-';
  const d = Math.round(post - (pre ?? 0));
  return d > 0 ? `+${d}` : String(d);
};

/** 공통/리더십/직무 역량 진단 상세 보기: two rows first, then 더 보기 / 접기 (prev_test_result.html:142-188). */
function DetailTable({ title, rows, avg }: { title: string; rows: ScoreRow[]; avg: { pre: number; post: number } }) {
  const [open, setOpen] = useState(false);
  const c = copy.result;
  const shown = open ? rows : rows.slice(0, 2);
  return (
    <section className={styles.resultCard} aria-label={title}>
      <h2>{title}</h2>
      <table className={styles.detailTable}>
        <thead><tr><th scope="col">{c.cols.name}</th><th scope="col">{c.cols.pre}</th><th scope="col">{c.cols.post}</th><th scope="col">{c.cols.diff}</th></tr></thead>
        <tbody>
          {shown.map((r) => <tr key={r.question}><td><strong>{r.question}</strong>{r.detail ? <small>{r.detail}</small> : null}</td><td><b>{scoreCell(r.pre)}</b></td><td><b>{scoreCell(r.post)}</b></td><td><b>{diffCell(r.pre, r.post)}</b></td></tr>)}
          {rows.length > 2 ? <tr className={cx(styles.moreRow, styles.noPrint)}><td colSpan={4}><button type="button" className="text-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? c.less : c.more} <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} /></button></td></tr> : null}
          <tr className={styles.avg}><td>{c.average}</td><td>{avg.pre ? `${Math.round(avg.pre)}점` : '-'}</td><td>{avg.post ? `${Math.round(avg.post)}점` : '-'}</td><td>{diffCell(avg.pre, avg.post)}</td></tr>
        </tbody>
      </table>
    </section>
  );
}

/** AR-08 역량진단 결과 — public/mypage/assessment_report.html + the detail tables of prev_test_result.html, for one of the learner's enrollments. */
export default function AssessmentResultPage() {
  const [params] = useSearchParams();
  const { studySeq } = scopeFromSearch(params);
  const result = useResult(studySeq);
  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: copy.crumbResult, to: '/my/assessment' }, { label: copy.result.title }];
  const r = copy.result;

  if (result.isPending) return <div className={styles.page} aria-busy="true"><Skeleton height={28} width="40%" /><Skeleton lines={6} /></div>;
  if (result.isError) {
    const err = result.error;
    if (isAppError(err) && err.isAuth) return <div className={styles.page}><StateBlock code="SESSION_EXPIRED" /></div>;
    if (isAppError(err) && (err.code === 'NO_ACCESS' || err.code === 'NOT_FOUND')) return <div className={styles.page}><Breadcrumb items={crumbs} /><StateBlock code="NO_ACCESS" title={copy.noEnrollmentTitle} body={copy.noEnrollmentBody} /></div>;
    return <div className={styles.page}><Breadcrumb items={crumbs} /><StateBlock code="ACCESS_ERROR" title={r.errorTitle} body={r.errorBody} onRetry={() => void result.refetch()} /></div>;
  }
  const d = result.data;
  const scores = d.scores ?? { common: { pre: d.pre.common, post: d.post.common }, leader: { pre: d.pre.leader, post: d.post.leader }, job: { pre: d.pre.job, post: d.post.job }, total: { pre: d.pre.total, post: d.post.total } };
  if (!d.pre.submitted && !d.post.submitted && !d.pre.started) {
    return <div className={styles.page}><Breadcrumb items={crumbs} /><StateBlock code="EMPTY" center kicker={r.eyebrow} title={r.noResultTitle} body={r.noResultBody} actions={<><Button square size="sm" to={`/assessment/pre${scopeSearch(d.isActive ? null : d.studySeq)}`}>{r.toPre}</Button><Button variant="secondary" square size="sm" to="/catalog">{nav.archive}</Button></>} /></div>;
  }
  const improvement = d.improvement;

  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <div className={styles.stepHead}>
        <div><span className="eyebrow">{r.eyebrow}</span><h1>{r.title}</h1><p>{r.lead}</p></div>
        <div className={cx(styles.labels, styles.noPrint)}>{d.roleLabel ? <TypeLabel tone="gray" small>{r.jobTrack(d.roleLabel)}</TypeLabel> : null}<TypeLabel small>{r.scale}</TypeLabel><Button variant="secondary" size="sm" square onClick={() => window.print()} icon={<Icon name="file" size={14} />}>{r.print}</Button></div>
      </div>

      <dl className={styles.infoGrid}>
        <div><dt>{r.info.name}</dt><dd>{d.learner.name || '-'}</dd></div>
        <div><dt>{r.info.company}</dt><dd>{d.learner.companyName || '-'}</dd></div>
        <div><dt>{r.info.period}</dt><dd>{d.period.start ? `${d.period.start} ~ ${d.period.end}` : '-'}</dd></div>
        <div><dt>{r.info.preDate}</dt><dd>{d.pre.completedAt || '-'}</dd></div>
        <div><dt>{r.info.postDate}</dt><dd>{d.post.completedAt || '-'}</dd></div>
        <div><dt>{r.info.track}</dt><dd>{d.roleLabel || '-'}</dd></div>
      </dl>

      <section className={styles.panelCard} aria-label={copy.hub.preScore}>
        <div className={styles.totals}>
          <div className={cx(styles.totalCard, !scores.total.pre && styles.dim)}><span>{copy.hub.preScore}</span><b>{scores.total.pre > 0 ? scores.total.pre : copy.hub.incomplete}</b><small>{r.totalLabel}</small></div>
          <span className={styles.arrow} aria-hidden="true"><Icon name="arrow" size={22} /></span>
          <div className={cx(styles.totalCard, !scores.total.post && styles.dim)}><span>{copy.hub.postScore}</span><b>{scores.total.post > 0 ? scores.total.post : copy.hub.incomplete}</b><small>{r.totalLabel}</small></div>
        </div>
        {improvement !== null ? <div className={cx(styles.growth, improvement > 0 && styles.up, improvement < 0 && styles.down)}><Icon name={growthIcon(improvement)} size={18} /><div><b>{r.improvementTitle(r.improvement(improvement))}</b> {r.improvementBody(improvement)}</div></div> : null}
      </section>

      <div className={styles.resultGrid}>
        <section className={styles.resultCard} aria-labelledby="res-cat">
          <h2 id="res-cat">{d.comparable ? r.compare : r.pre}</h2>
          <div className={styles.legend} aria-hidden="true"><span><i className={styles.swPre} />{r.preLabel}</span>{d.post.submitted ? <span><i className={styles.swPost} />{r.postLabel}</span> : null}</div>
          <ScoreBars pre={d.pre.submitted || d.pre.started ? d.pre : null} post={d.post.submitted ? d.post : null} compare={d.post.submitted} />
          <p className={styles.note}>{d.post.submitted ? r.diffNote : r.notComparableBody}</p>
        </section>
        <section className={styles.resultCard} aria-labelledby="res-reco">
          <h2 id="res-reco">{r.recommendationsTitle}</h2>
          {d.recommendations.length ? <ul className={styles.recos}>{d.recommendations.map((k) => <li key={k}>{r.recommendations[k] ?? k}</li>)}</ul> : <p className={styles.note}>-</p>}
          {!d.post.submitted ? <div className={cx('action-row', styles.noPrint)}><Button square size="sm" to={`/assessment/post${scopeSearch(d.isActive ? null : d.studySeq)}`}>{r.toPost}</Button></div>
            : d.satisfaction && d.satisfaction.required > 0 && !d.satisfaction.submitted ? <div className={cx('action-row', styles.noPrint)}><Button square size="sm" to={`/satisfaction/${d.studySeq}`}>{r.toSatisfaction}</Button></div> : null}
        </section>
      </div>

      <DetailTable title={r.detailTitle.common} rows={d.rows.common} avg={scores.common} />
      <DetailTable title={r.detailTitle.leader} rows={d.rows.leader} avg={scores.leader} />
      {d.col1 ? <DetailTable title={r.detailTitle.job(d.roleLabel)} rows={d.rows.job} avg={scores.job} /> : null}

      <section className={cx(styles.useBox, styles.noPrint)} aria-label={copy.toRoadmap}>
        <div className="action-row">
          <Button square to="/roadmap">{copy.toRoadmap}</Button>
          <Button variant="secondary" square to="/my/report">{r.toReport}</Button>
          <Link className="text-link" to="/my/assessment">{copy.toHub}</Link>
        </div>
      </section>
      <div className={styles.noPrint}><AxisPromo variant="banner" banner="result" /></div>
    </div>
  );
}
