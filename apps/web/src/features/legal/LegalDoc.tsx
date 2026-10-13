import { useLocation } from 'react-router-dom';
import styles from './Legal.module.css';
import { Tabs } from '../../shared/ui/Tabs';
import { legal as copy } from '../../shared/strings/ko';

export interface LegalSection { id: string; title: string; body: string }

/** AR-20 11 약관·정책: tabs, heading with 시행일/인쇄, TOC + body. */
export function LegalDoc({ docKey, title, sections, effectiveDate, extra }: { docKey: 'terms' | 'privacy'; title: string; sections: LegalSection[]; effectiveDate?: string; extra?: React.ReactNode }) {
  const { hash } = useLocation();
  return (
    <article>
      <Tabs items={copy.tabs.map((t) => ({ key: t.key, label: t.label, to: t.to }))} value={docKey} label={copy.crumb} />
      <div className={`band ${styles.heading}`}>
        <div className="crumb">{copy.crumb}</div>
        <h1>{title}</h1>
        <p className={styles.meta}><span>{copy.effective} {effectiveDate ?? '—'}</span><button type="button" onClick={() => window.print()}>{copy.print}</button></p>
      </div>
      <div className={styles.content}>
        <div className={styles.columns}>
          <aside className={styles.toc} aria-label="목차">
            {sections.map((s) => <a key={s.id} href={`#${s.id}`} aria-current={hash === `#${s.id}` ? 'true' : undefined}>{s.title}</a>)}
          </aside>
          <div className={styles.body}>
            {sections.map((s) => <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}><h2 id={`${s.id}-h`}>{s.title}</h2><p>{s.body}</p></section>)}
            {extra}
          </div>
        </div>
      </div>
    </article>
  );
}
