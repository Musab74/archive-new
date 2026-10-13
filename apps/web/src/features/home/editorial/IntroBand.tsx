import { motion } from 'framer-motion';
import styles from './Sections.module.css';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { useReveal, useRevealChild } from '../../../shared/motion/useReveal';

export interface IntroBandProps { label: string; title: string; body: string; cta: { label: string; to: string }; steps: { n: string; title: string; desc: string }[] }

/** Deep-navy full-width band right under the hero (old-site "아카이브란" intro + 3 steps). */
export function IntroBand({ label, title, body, cta, steps }: IntroBandProps) {
  const reveal = useReveal();
  const child = useRevealChild();
  return (
    <section className={`bleed ${styles.intro}`} aria-labelledby="home-intro-h">
      <div className={`bleed-inner ${styles.introInner}`}>
        <div className={styles.introCopy}>
          <span className={styles.bandLabel}>{label}</span>
          <h2 id="home-intro-h" className={styles.introTitle}>{title}</h2>
          <p className={styles.introBody}>{body}</p>
          <div className="action-row"><Button variant="white" to={cta.to} iconRight={<Icon name="arrow" size={15} />}>{cta.label}</Button></div>
        </div>
        <motion.ol className={styles.steps} {...reveal}>
          {steps.map((s, i) => (
            <motion.li key={s.n} className={styles.step} {...child} custom={i}>
              <span className={styles.stepNum}>{s.n}</span>
              <div><strong>{s.title}</strong><span>{s.desc}</span></div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
