import { Link } from 'react-router-dom';
import styles from './Sections.module.css';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';

export interface CtaBandProps { title: string; apply: { label: string; to: string }; phone: { label: string; href: string }; columns: { title: string; links: { label: string; to: string }[] }[] }

/** Old-site footer CTA: headline, 수강신청 + phone, and two link columns (안내정책 / 소통지원). */
export function CtaBand({ title, apply, phone, columns }: CtaBandProps) {
  return (
    <section className={`bleed ${styles.cta}`} aria-labelledby="home-cta-h">
      <div className={`bleed-inner ${styles.ctaInner}`}>
        <div>
          <h2 id="home-cta-h" className={styles.ctaTitle}>{title}</h2>
          <div className={styles.ctaActions}>
            <Button variant="accent" size="lg" to={apply.to}>{apply.label}</Button>
            <Button variant="secondary" size="lg" href={phone.href} external={false} icon={<Icon name="phone" size={18} />}>{phone.label}</Button>
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
    </section>
  );
}
