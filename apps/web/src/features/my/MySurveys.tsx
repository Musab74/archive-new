import { Link, useParams } from 'react-router-dom';
import styles from './My.module.css';
import { Button } from '../../shared/ui/Button';
import { StateBlock } from '../../shared/ui/StateBlock';
import { my as copy } from '../../shared/strings/ko';
import { useDashboard } from './queries';

const c = copy.surveys;

/** AR-17 만족도조사 list. No survey endpoint exists in the API → EMPTY state with the storyboard copy and the 미평점 link. */
export default function MySurveys() {
  const dashboard = useDashboard();
  const unrated = dashboard.data?.unrated ?? [];
  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{copy.crumb}</span><h1>{c.title}</h1><p>{c.lead}</p></div></div>
      <section className={styles.card} aria-labelledby="sv-h">
        <div className={styles.cardHead}><h2 id="sv-h">{c.listTitle}</h2><span className={styles.note}>{c.listLead}</span></div>
        <StateBlock code="EMPTY" symbol="file" title={c.emptyTitle} body={c.emptyBody} actions={<Button variant="secondary" square size="sm" to="/my">{copy.nav.home}</Button>} />
      </section>
      <section className={`${styles.card} ${styles.soft}`}>
        <p className={styles.note} style={{ fontSize: 13 }}>{c.note}</p>
        {unrated.length ? <Link className="text-link" to={`/courses/${encodeURIComponent(unrated[0].lectureCode)}`}>{c.unratedLink}</Link> : null}
      </section>
    </div>
  );
}

/** `/satisfaction/:id` — READ_ONLY state (survey submission is not exposed by the API). */
export function SatisfactionPage() {
  const { id = '' } = useParams();
  return (
    <div className={styles.page}>
      <div className={styles.head}><div><span className="eyebrow">{c.title}</span><h1>{c.detailTitle}</h1><p>{c.lead}</p></div></div>
      <StateBlock code="EMPTY" symbol="info" kicker={`${c.title} · ${id}`} title={c.readOnlyTitle} body={c.readOnlyBody} actions={<><Button square size="sm" to="/my/surveys">{c.back}</Button><Button variant="secondary" square size="sm" to="/my">{copy.nav.home}</Button></>} />
      <p className={styles.note}>{c.note}</p>
    </div>
  );
}
