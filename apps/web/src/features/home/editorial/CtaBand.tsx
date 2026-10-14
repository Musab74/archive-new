import { Link } from 'react-router-dom';
import styles from './Sections.module.css';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';

export interface CtaBandProps { label: string; title: string; lead: string; apply: { label: string; to: string }; phone: { label: string; href: string }; columns: { title: string; links: { label: string; to: string }[] }[] }

/** Old-site footer CTA as a contained navy panel: headline, 수강신청 + phone, and two link columns (안내정책 / 소통지원). */
export function CtaBand({ label, title, lead, apply, phone, columns }: CtaBandProps) {
  return (
    <section className={`bleed ${styles.cta}`} aria-labelledby="home-cta-h">
      <div className={`bleed-inner ${styles.ctaInner}`}>
        <div className={styles.ctaPanel}>
          <div className={styles.ctaMain}>
            <span className={styles.ctaLabel}>{label}</span>
            <h2 id="home-cta-h" className={styles.ctaTitle}>{title}</h2>
            <p className={styles.ctaLead}>{lead}</p>
            <div className={styles.ctaActions}>
              <Button variant="white" size="lg" to={apply.to} iconRight={<Icon name="arrow" size={17} />}>{apply.label}</Button>
              <Button variant="ghost" size="lg" href={phone.href} external={false} icon={<Icon name="phone" size={18} />}>{phone.label}</Button>
            </div>
          </div>
          <div className={styles.ctaCols}>
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title} className={styles.ctaCol}>
                <h3>{col.title}</h3>
                {col.links.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
              </nav>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
