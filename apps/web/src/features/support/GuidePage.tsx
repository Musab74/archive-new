import styles from './Support.module.css';
import { TypeLabel } from '../../shared/ui/Pill';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { support as copy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';

/** 이용안내: 환급형/비환급형 cards, 4 steps, session rules. */
export default function GuidePage() {
  const g = copy.guide;
  return (
    <section aria-labelledby="guide-h">
      <h2 id="guide-h" className={styles.h2} style={{ marginTop: 0 }}>{g.title}</h2>
      <p style={{ marginBottom: 20 }}>{g.lead}</p>
      <div className={styles.cards}>
        <article id="refund" className={styles.card}>
          <TypeLabel>{g.refund.label}</TypeLabel>
          <h3>{g.refund.title}</h3>
          <p>{g.refund.body}</p>
          <Button variant="text" size="sm" to="/my/records" className={styles.link} iconRight={<Icon name="arrow" size={15} />}>{g.refund.link}</Button>
        </article>
        <article id="general" className={cx(styles.card, styles.mint)}>
          <TypeLabel tone="mint">{g.general.label}</TypeLabel>
          <h3>{g.general.title}</h3>
          <p>{g.general.body}</p>
          <Button variant="text" size="sm" to="/catalog" className={styles.link} iconRight={<Icon name="arrow" size={15} />}>{g.general.link}</Button>
        </article>
      </div>
      <div className={styles.steps}>
        {g.steps.map((s) => <div key={s.n}><b>{s.n}</b><strong>{s.title}</strong><span>{s.desc}</span></div>)}
      </div>
      <h3 className={styles.h2}>{g.sessionTitle}</h3>
      <ul className={styles.list}>{g.sessionItems.map((s) => <li key={s}>{s}</li>)}</ul>
      <div className="action-row"><Button variant="secondary" square size="sm" to="/support/faq" iconRight={<Icon name="arrow" size={15} />}>{g.faqLink}</Button></div>
      <h3 className={styles.h2}>{g.moreTitle}</h3>
      <div className="action-row">{g.more.map((m) => <Button key={m.to} variant="text" size="sm" to={m.to} iconRight={<Icon name="arrow" size={15} />}>{m.label}</Button>)}</div>
    </section>
  );
}
