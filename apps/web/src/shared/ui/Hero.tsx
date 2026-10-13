import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import styles from './Hero.module.css';
import { cx } from '../utils/format';
import { useReveal, useRevealChild } from '../motion/useReveal';

export interface HeroCard { n: string; title: string; sub: string }
export interface HeroProps { tag: string; title: string; lead: string; actions?: ReactNode; cards?: HeroCard[]; imageUrl?: string | null; imageAlt?: string; variant?: 'split' | 'centered' | 'visual-right'; className?: string }

/** Main hero (AR-01 `.archive-hero`): copy + rotated card stack or a branding image. */
export function Hero({ tag, title, lead, actions, cards = [], imageUrl, imageAlt = '', variant = 'split', className }: HeroProps) {
  const reveal = useReveal();
  const child = useRevealChild();
  return (
    <section className={cx(styles.hero, variant === 'centered' && styles.centered, className)} aria-label={tag}>
      <motion.div className={styles.copy} {...reveal}>
        <motion.div className={styles.tag} {...child} custom={0}>{tag}</motion.div>
        <motion.h1 className={styles.title} {...child} custom={1}>{title}</motion.h1>
        <motion.p className={styles.lead} {...child} custom={2}>{lead}</motion.p>
        {actions ? <motion.div className={styles.actions} {...child} custom={3}>{actions}</motion.div> : null}
      </motion.div>
      <div className={styles.visual} aria-hidden={imageUrl ? undefined : true}>
        {imageUrl ? <img className={styles.image} src={imageUrl} alt={imageAlt} /> : (
          <>
            <div className={styles.orbit} />
            <motion.div className={styles.stack} {...reveal}>
              {cards.map((c, i) => (
                <motion.div key={c.n} className={styles.vcard} {...child} custom={i + 2}>
                  <span>{c.n}</span>
                  <div><b>{c.title}</b><small>{c.sub}</small></div>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
}
