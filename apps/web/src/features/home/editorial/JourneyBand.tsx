import { motion, useReducedMotionConfig } from 'framer-motion';
import styles from './Sections.module.css';
import { Button } from '../../../shared/ui/Button';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import { IconTile, type IconTone } from '../../../shared/ui/IconTile';
import { useReveal, useRevealChild } from '../../../shared/motion/useReveal';

export interface JourneyStep { n: string; icon: IconName; tone: IconTone; title: string; desc: string }
export interface JourneyBandProps { label: string; title: string; lead: string; cta: { label: string; to: string }; steps: JourneyStep[] }

/** Learning journey (진단 → 로드맵 → 학습 → 사후진단·보고서): a horizontal timeline whose rail draws in on reveal. */
export function JourneyBand({ label, title, lead, cta, steps }: JourneyBandProps) {
  const reveal = useReveal({ amount: 0.3 });
  const child = useRevealChild();
  const reduced = useReducedMotionConfig();
  return (
    <section className={`bleed ${styles.journey}`} aria-labelledby="home-journey-h">
      <div className={`bleed-inner ${styles.journeyInner}`}>
        <div className={styles.journeyHead}>
          <div>
            <span className="eyebrow">{label}</span>
            <h2 id="home-journey-h" className={styles.sectionTitle}>{title}</h2>
          </div>
          <div className={styles.journeySide}>
            <p className={styles.sectionLead}>{lead}</p>
            <Button variant="text" to={cta.to} iconRight={<Icon name="arrow" size={15} />}>{cta.label}</Button>
          </div>
        </div>
        <motion.div className={styles.timeline} {...reveal}>
          <motion.span className={styles.rail} aria-hidden="true" variants={reduced ? { hidden: { opacity: 0 }, show: { opacity: 1 } } : { hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } } }} />
          <ol className={styles.stops}>
          {steps.map((s, i) => (
            <motion.li key={s.n} className={styles.stop} {...child} custom={i + 1}>
              <div className={styles.stopHead}><IconTile icon={s.icon} tone={s.tone} size="lg" solid /><span className={styles.stopNum}>STEP {s.n}</span></div>
              <strong>{s.title}</strong>
              <span>{s.desc}</span>
            </motion.li>
          ))}
          </ol>
        </motion.div>
      </div>
    </section>
  );
}
