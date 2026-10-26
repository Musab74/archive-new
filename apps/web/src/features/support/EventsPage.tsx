import { StateBlock } from '../../shared/ui/StateBlock';
import { Button } from '../../shared/ui/Button';
import { support as copy } from '../../shared/strings/ko';
import styles from './Support.module.css';

/**
 * public/support/event.html was a static mock-up (sample cards, no table) and its menu entry was switched off on the old
 * site (support_header.html: "사용하지않아서 제외처리"). Kept as a plain page for old links; no API call.
 */
export default function EventsPage() {
  const c = copy.events;
  return (
    <section aria-labelledby="ev-h">
      <h2 id="ev-h" className={styles.h2} style={{ marginTop: 0 }}>{c.title}</h2>
      <p style={{ marginBottom: 16 }}>{c.lead}</p>
      <StateBlock code="EMPTY" center symbol="calendar" title={c.empty} body={c.emptyBody} actions={<Button square size="sm" to="/live">{c.live}</Button>} />
    </section>
  );
}
