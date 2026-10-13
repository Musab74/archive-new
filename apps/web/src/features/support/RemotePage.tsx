import styles from './Support.module.css';
import { Button } from '../../shared/ui/Button';
import { support as copy } from '../../shared/strings/ko';

const REMOTE_URL = (import.meta.env?.VITE_REMOTE_SUPPORT_URL as string | undefined) ?? '';

export default function RemotePage() {
  const r = copy.remote;
  return (
    <section aria-labelledby="rm-h">
      <h2 id="rm-h" className={styles.h2} style={{ marginTop: 0 }}>{r.title}</h2>
      <p>{r.lead}</p>
      <ol className={styles.remoteSteps}>{r.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      {REMOTE_URL ? <Button square href={REMOTE_URL}>{r.cta}</Button> : <div className={styles.note}>{r.noUrl}</div>}
      <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>{r.privacy}</p>
    </section>
  );
}
