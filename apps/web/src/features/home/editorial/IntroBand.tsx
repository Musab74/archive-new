import { motion } from 'framer-motion';
import styles from './Sections.module.css';
import { Button } from '../../../shared/ui/Button';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import { IconTile, type IconTone } from '../../../shared/ui/IconTile';
import { useReveal, useRevealChild } from '../../../shared/motion/useReveal';

export interface IntroStep { n: string; icon: IconName; tone: IconTone; title: string; desc: string }
export interface IntroBandProps { label: string; title: string; body: string; cta: { label: string; to: string }; steps: IntroStep[] }

/** "아카이브란" intro: an editorial statement on the left, the value points as numbered rows on the right. */
export function IntroBand({ label, title, body, cta, steps }: IntroBandProps) {
  const reveal = useReveal();
  const child = useRevealChild();
  return (
    <section className={`bleed ${styles.intro}`} aria-labelledby="home-intro-h">
      <div className={`bleed-inner ${styles.introInner}`}>
        <div className={styles.introHead}>
          <span className="eyebrow">{label}</span>
          <h2 id="home-intro-h" className={styles.introTitle}>{title}</h2>
          <p className={styles.introBody}>{body}</p>
          <Button variant="secondary" to={cta.to} iconRight={<Icon name="arrow" size={15} />}>{cta.label}</Button>
        </div>
        <motion.ol className={styles.values} {...reveal}>
          {steps.map((s, i) => (
            <motion.li key={s.n} className={styles.value} {...child} custom={i}>
              <span className={styles.valueNum}>{s.n}</span>
              <IconTile icon={s.icon} tone={s.tone} size="lg" className={styles.valueTile} />
              <div className={styles.valueText}><strong>{s.title}</strong><span>{s.desc}</span></div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
