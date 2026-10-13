import { useDesign } from '../design/useDesign';
import styles from './AxisPromo.module.css';
import { axis as copy, common } from '../strings/ko';
import { cx } from '../utils/format';

export type AxisBannerKey = keyof typeof copy.banner;
export interface AxisPromoProps { variant?: 'main' | 'banner'; banner?: AxisBannerKey; className?: string }

/**
 * AXIS marketing section (02_AXIS 적용기준): graphite main band or dark navy sub banner.
 * Hidden entirely when design.links.axisUrl is empty; the CTA opens the approved URL in a new tab (noopener).
 */
export function AxisPromo({ variant = 'main', banner = 'home', className }: AxisPromoProps) {
  const { config } = useDesign();
  const url = config.links.axisUrl;
  if (!url) return null;
  const cta = (
    <a className={styles.button} href={url} target="_blank" rel="noopener noreferrer" aria-label={copy.ctaAria}>
      {copy.cta} <span aria-hidden="true">↗</span><span className="sr-only"> ({common.external})</span>
    </a>
  );
  if (variant === 'banner') {
    const b = copy.banner[banner];
    return (
      <div className={cx(styles.slot, className)}>
        <section className={cx(styles.promo, styles.sub)} aria-label={copy.mark}>
          <div className={styles.copy}>
            <h2 className={styles.title}>{b.title}</h2>
            <p className={styles.desc}>{b.desc}</p>
          </div>
          {cta}
        </section>
      </div>
    );
  }
  return (
    <section className={cx(styles.promo, styles.main, className)} aria-label={copy.mark}>
      <span className={styles.decor} aria-hidden="true" />
      <div className={styles.grid}>
        <div className={styles.list}>
          {copy.main.rows.map((r) => (
            <div key={r.n} className={styles.row}><span>{r.n}</span><div><b>{r.title}</b><p>{r.desc}</p></div></div>
          ))}
        </div>
        <div className={styles.copy}>
          <span className={styles.mark}>{copy.mark}</span>
          <h2 className={styles.title}>{copy.main.title}</h2>
          <p className={styles.desc}>{copy.main.desc}</p>
          {cta}
          <p className={styles.note}>{copy.main.note}</p>
        </div>
      </div>
    </section>
  );
}
