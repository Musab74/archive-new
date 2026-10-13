import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import styles from './AiZoneStrip.module.css';
import { Button } from './Button';
import { Icon } from './Icon';
import { aiZone as copy } from '../strings/ko';
import { useReveal, useRevealChild } from '../motion/useReveal';

/** Full-width AI ZONE band (AR-01): numbered 4 categories on the left, big copy + ghost CTA on the right. */
export function AiZoneStrip() {
  const navigate = useNavigate();
  const reveal = useReveal();
  const child = useRevealChild();
  return (
    <section className={`band ${styles.zone}`} aria-label={copy.eyebrow}>
      <div className={styles.decor} aria-hidden="true"><span /><span /></div>
      <motion.div className={styles.grid} {...reveal}>
        <div className={styles.list}>
          {copy.categories.map((c, i) => (
            <motion.button key={c.key} type="button" className={styles.row} onClick={() => navigate(`/catalog?competency=ai&field=${encodeURIComponent(c.title)}`)} {...child} custom={i}>
              <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
              <div><b>{c.title}</b><p>{c.desc}</p></div>
            </motion.button>
          ))}
        </div>
        <motion.div className={styles.copy} {...child} custom={1}>
          <span className={styles.mark}>{copy.eyebrow}</span>
          <h2 className={styles.title}>{copy.title}</h2>
          <p className={styles.note}>{copy.note}</p>
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" to="/ai-zone" iconRight={<Icon name="arrow" size={16} />}>{copy.cta}</Button>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
