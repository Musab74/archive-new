import { motion } from 'framer-motion';
import styles from './Sections.module.css';
import { Button } from '../../../shared/ui/Button';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import { useReveal, useRevealChild } from '../../../shared/motion/useReveal';

export interface IntroStep { n: string; icon: IconName; title: string; desc: string }
export interface IntroBandProps { label: string; title: string; body: string; cta: { label: string; to: string }; steps: IntroStep[] }

/** Deep-navy full-width band right under the hero (old-site "아카이브란" intro): heading row, then the steps as feature cards. */
export function IntroBand({ label, title, body, cta, steps }: IntroBandProps) {
  const reveal = useReveal();
  const child = useRevealChild();
  return (
    <section className={`bleed ${styles.intro}`} aria-labelledby="home-intro-h">
      <div className={`bleed-inner ${styles.introInner}`}>
        <div className={styles.introHead}>
          <div>
            <span className={styles.bandLabel}>{label}</span>
            <h2 id="home-intro-h" className={styles.introTitle}>{title}</h2>
          </div>
          <div className={styles.introSide}>
            <p className={styles.introBody}>{body}</p>
            <Button variant="white" to={cta.to} iconRight={<Icon name="arrow" size={15} />}>{cta.label}</Button>
          </div>
        </div>
        <motion.ol className={styles.features} {...reveal}>
          {steps.map((s, i) => (
            <motion.li key={s.n} className={styles.feature} {...child} custom={i}>
              <div className={styles.featureTop}>
                <span className={styles.featureIcon} aria-hidden="true"><Icon name={s.icon} size={22} /></span>
                <span className={styles.featureNum}>{s.n}</span>
              </div>
              <strong>{s.title}</strong>
              <span>{s.desc}</span>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
