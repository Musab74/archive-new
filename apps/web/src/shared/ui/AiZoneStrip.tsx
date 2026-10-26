import { Link } from 'react-router-dom';
import { motion, useReducedMotionConfig } from 'framer-motion';
import styles from './AiZoneStrip.module.css';
import { Button } from './Button';
import { Icon } from './Icon';
import { aiZone as copy } from '../strings/ko';
import { useReveal, useRevealChild } from '../motion/useReveal';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * AI ZONE band (home `aiZone` section): copy, actions and the four AI learning directions on the left; on the right a
 * labelled example of the real AI 로드맵 생성기 (goal → recommended order built from the four directions), revealed once.
 */
export function AiZoneStrip() {
  const reveal = useReveal({ amount: 0.25 });
  const child = useRevealChild();
  const reduced = useReducedMotionConfig();
  return (
    <section className={`band ${styles.zone}`} aria-labelledby="home-ai-h">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.grid}>
        <div className={styles.copy}>
          <span className={styles.mark}><Icon name="sparkles" size={15} />{copy.eyebrow}</span>
          <h2 id="home-ai-h" className={styles.title}>{copy.title}</h2>
          <p className={styles.note}>{copy.note}</p>
          <div className={styles.actions}>
            <Button variant="white" to="/catalog?competency=ai" iconRight={<Icon name="arrow" size={16} />}>{copy.viewContents}</Button>
            <Button variant="ghost" to="/ai-zone">{copy.cta}</Button>
          </div>
          <motion.ol className={styles.dirs} {...reveal}>
            {copy.categories.map((c, i) => (
              <motion.li key={c.key} {...child} custom={i}>
                <Link to={`/catalog?competency=ai&field=${encodeURIComponent(c.title)}`} className={styles.dir}>
                  <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
                  <b>{c.title}</b>
                  <Icon name="arrow" size={15} className={styles.dirGo} />
                </Link>
              </motion.li>
            ))}
          </motion.ol>
        </div>

        <motion.figure className={styles.demo} {...reveal}>
          <div className={styles.demoBar}><span className={styles.demoDots} aria-hidden="true"><i /><i /><i /></span><span className={styles.demoLabel}><Icon name="wand" size={14} />{copy.demo.label}</span></div>
          <div className={styles.demoBody}>
            <div className={styles.field}>
              <small>{copy.demo.goal}</small>
              <p>{copy.demo.goalExample}<span className={styles.caret} aria-hidden="true" /></p>
            </div>
            <div className={styles.resultHead}><Icon name="route" size={15} />{copy.demo.result}</div>
            <ol className={styles.steps}>
              {copy.categories.map((c, i) => (
                <motion.li key={c.key} className={styles.step}
                  variants={reduced ? { hidden: { opacity: 0 }, show: { opacity: 1 } } : { hidden: { opacity: 0, x: 14 }, show: { opacity: 1, x: 0, transition: { duration: 0.45, delay: 0.35 + i * 0.14, ease: EASE } } }}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <div><b>{c.title}</b><span>{c.short}</span></div>
                </motion.li>
              ))}
            </ol>
          </div>
          <figcaption className={styles.demoNote}>{copy.demo.note}</figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
