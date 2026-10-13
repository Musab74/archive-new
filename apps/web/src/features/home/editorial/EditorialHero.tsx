import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotionConfig, useScroll, useTransform } from 'framer-motion';
import styles from './EditorialHero.module.css';
import { TypeLabel } from '../../../shared/ui/Pill';
import { Button } from '../../../shared/ui/Button';
import { useLoadIn } from '../../../shared/motion/loadIn';
import { motionTokens } from '../../../shared/motion/tokens';
import { useHeaderOverlay } from '../../../shared/ui/headerChrome';
import { OrbitRing } from './OrbitRing';
import { useOrbitClock } from './useOrbitClock';
import { HeroStats, type StatItem } from './HeroStats';
import { CardDeck, type DeckCard } from './CardDeck';
import type { OrbitBadgeSpec } from './OrbitBadge';

export interface EditorialHeroProps {
  eyebrow: string;
  /** Headline; `\n` splits lines (each line staggers in on its own). */
  title: string;
  lead: string;
  cta: { label: string; to: string };
  secondary?: ReactNode;
  deckLabel: string;
  badges: OrbitBadgeSpec[];
  cards: DeckCard[];
  stats: StatItem[];
  statsLabel: string;
}

/**
 * Editorial SaaS hero (2026-10 brief): paper background, two columns (45/55), a huge taupe ring whose centre sits
 * off-canvas right with icon badges orbiting down its arc, three count-up stats, and a fanned card deck.
 * Plays a ~1.6 s load sequence once, then loops. The sticky header floats transparently over it (useHeaderOverlay).
 */
export function EditorialHero({ eyebrow, title, lead, cta, secondary, deckLabel, badges, cards, stats, statsLabel }: EditorialHeroProps) {
  useHeaderOverlay();
  const reduced = useReducedMotionConfig();
  const id = useId();
  const clock = useOrbitClock();
  const { parent, child } = useLoadIn(0.1);
  const lines = useMemo(() => title.split('\n').filter(Boolean), [title]);
  const [statsStart, setStatsStart] = useState(false);

  useEffect(() => { clock.boost(); }, [clock]);
  useEffect(() => { const t = setTimeout(() => setStatsStart(true), reduced ? 0 : 500); return () => clearTimeout(t); }, [reduced]);

  // gentle parallax: the ring lags behind the copy
  const { scrollY } = useScroll();
  const ringY = useTransform(scrollY, [0, 600], [0, 110]);
  const zero = useMotionValue(0);

  return (
    <section className={`bleed ${styles.hero}`} aria-labelledby={id}>
      <motion.div className={styles.ringLayer} style={{ y: reduced ? zero : ringY }} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, x: 48 }} animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.9, ease: motionTokens.ease }}>
        <OrbitRing badges={badges} clock={clock} />
      </motion.div>
      <div className={`bleed-inner ${styles.inner}`}>
        <motion.div className={styles.copy} {...parent}>
          <motion.div variants={child.variants}><TypeLabel tone="coral-soft" small>{eyebrow}</TypeLabel></motion.div>
          <h1 id={id} className={styles.title}>
            {lines.map((line, i) => <motion.span key={i} className={styles.line} variants={child.variants}>{line}</motion.span>)}
          </h1>
          <motion.p className={styles.lead} variants={child.variants}>{lead}</motion.p>
          <motion.div className={styles.actions} variants={child.variants}>
            <Button variant="accent" size="lg" to={cta.to}>{cta.label}</Button>
            {secondary}
          </motion.div>
          <motion.div className={styles.deckWrap} variants={child.variants}>
            <span className={styles.deckLabel}>{deckLabel}</span>
            <CardDeck cards={cards} label={deckLabel} startDelay={reduced ? 0 : 1.0} />
          </motion.div>
        </motion.div>
        <div className={styles.visual}>
          <HeroStats items={stats} start={statsStart} delay={reduced ? 0 : 500} label={statsLabel} />
        </div>
      </div>
    </section>
  );
}
