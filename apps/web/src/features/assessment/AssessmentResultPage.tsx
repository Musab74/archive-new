import { Link } from 'react-router-dom';
import styles from './Assessment.module.css';
import { isAppError } from '../../shared/api/client';
import type { AssessmentScore } from '../../shared/api/schemas';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { StateBlock } from '../../shared/ui/StateBlock';
import { Skeleton } from '../../shared/ui/Skeleton';
import { AxisPromo } from '../../shared/ui/AxisPromo';
import { TypeLabel } from '../../shared/ui/Pill';
import { assessment as copy, nav } from '../../shared/strings/ko';
import { useAssessmentResult, useCurrentEnrollment } from '../my/queries';
import { cx } from '../../shared/utils/format';

const CATS: { key: keyof typeof copy.result.categories; pick: (s: AssessmentScore) => number }[] = [
  { key: 'common', pick: (s) => s.common }, { key: 'leader', pick: (s) => s.leader }, { key: 'job', pick: (s) => s.job }, { key: 'total', pick: (s) => s.total },
];

/** Pure CSS category bars (0–100). `compare` renders pre + post side by side; never computes growth rates. */
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

/** AR-08 역량진단 결과: 사전/사후 category bars, comparison only when `comparable`, NO_RESULT / RESULT_PREPARING states. */
export default function AssessmentResultPage() {
  const current = useCurrentEnrollment();
  const result = useAssessmentResult(current.data?.studySeq ?? null, current.isSuccess && current.data.studySeq !== null);
  const crumbs = [{ label: nav.myRoom, to: '/my' }, { label: '역량진단', to: '/my/assessment' }, { label: copy.crumbResult }];
  const r = copy.result;

  if (current.isPending || (result.isPending && result.fetchStatus !== 'idle')) return <div className={styles.page} aria-busy="true"><Skeleton height={28} width="40%" /><Skeleton lines={6} /></div>;
  if (current.isError || result.isError) {
    const err = current.error ?? result.error;
    const code = isAppError(err) && err.isAuth ? 'SESSION_EXPIRED' : 'ACCESS_ERROR';
    return <div className={styles.page}><Breadcrumb items={crumbs} /><StateBlock code={code} title={r.errorTitle} body={r.errorBody} onRetry={() => { void current.refetch(); void result.refetch(); }} /></div>;
  }
  if (current.data.studySeq === null || !result.data) return <div className={styles.page}><Breadcrumb items={crumbs} /><StateBlock code="NO_ACCESS" title={copy.noEnrollmentTitle} body={copy.noEnrollmentBody} /></div>;

  const { pre, post, comparable } = result.data;
  if (!pre.submitted && !post.submitted) {
    return <div className={styles.page}><Breadcrumb items={crumbs} /><StateBlock code="EMPTY" center kicker={r.eyebrow} title={r.noResultTitle} body={r.noResultBody} actions={<><Button square size="sm" to="/assessment/pre">{r.toPre}</Button><Button variant="secondary" square size="sm" to="/catalog">{nav.archive}</Button></>} /></div>;
  }
  const preparing = pre.submitted && pre.total === 0 && pre.common === 0 && pre.leader === 0 && pre.job === 0;

  return (
    <div className={styles.page}>
      <Breadcrumb items={crumbs} />
      <div className={styles.stepHead}>
        <div><span className="eyebrow">{r.eyebrow}</span><h1>{r.title}</h1><p>{r.lead}</p></div>
        <div className={styles.labels}>{pre.col1 ? <TypeLabel tone="gray" small>{r.jobTrack(pre.col1)}</TypeLabel> : null}<TypeLabel small>{r.scale}</TypeLabel></div>
      </div>

      {preparing ? <StateBlock code="EMPTY" symbol="clock" title={r.preparingTitle} body={r.preparingBody} hideActions /> : null}

      <div className={styles.resultGrid}>
        <section className={styles.resultCard} aria-labelledby="res-pre">
          <h2 id="res-pre">{comparable ? r.compare : r.pre}</h2>
          <div className={styles.legend} aria-hidden="true"><span><i className={styles.swPre} />{r.preLabel}</span>{comparable ? <span><i className={styles.swPost} />{r.postLabel}</span> : null}</div>
          <ScoreBars pre={pre.submitted ? pre : null} post={post.submitted ? post : null} compare={comparable} />
          {comparable ? <p className={styles.note}>{r.diffNote}</p> : null}
        </section>
        <section className={styles.resultCard} aria-labelledby="res-post">
          <h2 id="res-post">{r.post}</h2>
          {post.submitted && !comparable ? (
            <><p className={styles.note}>{r.notComparableTitle} {r.notComparableBody}</p><ScoreBars pre={null} post={post} compare={false} /></>
          ) : post.submitted ? <p className={styles.note}>{r.postLabel} {post.total}</p> : (
            <StateBlock code="EMPTY" symbol="calendar" kicker={r.post} title={r.postPending} body={copy.post.note} actions={<Button square size="sm" to="/assessment/post">{r.toPost}</Button>} />
          )}
        </section>
      </div>

      <section className={styles.useBox} aria-label={r.useTitle}>
        <h2>{r.useTitle}</h2>
        <div className={styles.useGrid}>{r.useItems.map((u) => <div key={u.title}><b>{u.title}</b><p>{u.body}</p></div>)}</div>
        <div className="action-row">
          <Button square to="/roadmap">{copy.toRoadmap}</Button>
          <Button variant="secondary" square to="/my/report">{r.toReport}</Button>
          <Link className="text-link" to="/home">{copy.backToLearning}</Link>
        </div>
      </section>
      <AxisPromo variant="banner" banner="result" />
    </div>
  );
}
