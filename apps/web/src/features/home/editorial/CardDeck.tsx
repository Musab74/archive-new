import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotionConfig } from 'framer-motion';
import styles from './CardDeck.module.css';
import { motionTokens } from '../../../shared/motion/tokens';
import { cx } from '../../../shared/utils/format';

export interface DeckCard { key: string; name: string; desc: string; chips: string[]; to: string }

/** Slot 0 = front (straight); the rest fan out behind it at fixed, deliberately uneven angles. */
const SLOTS = [
  { rotate: 0, x: 0, y: 0, scale: 1 },
  { rotate: -18, x: -26, y: -10, scale: 0.96 },
  { rotate: 22, x: 30, y: -6, scale: 0.94 },
  { rotate: -8, x: -10, y: -18, scale: 0.92 },
  { rotate: 12, x: 14, y: -22, scale: 0.9 },
  { rotate: -14, x: 4, y: -26, scale: 0.88 },
];
const CYCLE_MS = 4000;

export interface CardDeckProps { cards: DeckCard[]; label: string; startDelay?: number; maxBack?: number; className?: string }

/**
 * Fanned hand of cards. Every 4 s the front card lifts, tilts and slides to the back while the next card
 * straightens into focus. Hover / focus pause the cycle; reduced motion shows a static fan.
 */
export function CardDeck({ cards, label, startDelay = 1.0, maxBack = 5, className }: CardDeckProps) {
  const reduced = useReducedMotionConfig();
  const n = cards.length;
  const [front, setFront] = useState(0);
  const [prevFront, setPrevFront] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), (startDelay + 0.6) * 1000);
    return () => clearTimeout(t);
  }, [startDelay]);

  useEffect(() => {
    if (reduced || paused || n < 2 || !introDone) return;
    let hidden = typeof document !== 'undefined' && document.hidden;
    const onVis = () => { hidden = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(() => { if (hidden) return; setFront((f) => { setPrevFront(f); return (f + 1) % n; }); }, CYCLE_MS);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [reduced, paused, n, introDone]);

  return (
    <div className={cx(styles.deck, className)} aria-label={label} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}>
      {cards.map((card, i) => {
        const slot = (i - front + n) % n;
        const cfg = SLOTS[Math.min(slot, SLOTS.length - 1)]!;
        const visible = slot <= maxBack;
        const isFront = slot === 0;
        const departing = prevFront === i && slot !== 0;
        const target = departing && !reduced
          ? { opacity: visible ? [1, 0.55, 1] : 0, y: [0, -28, cfg.y], rotate: [0, 6, cfg.rotate], x: cfg.x, scale: cfg.scale }
          : { opacity: visible ? 1 : 0, x: cfg.x, y: cfg.y, rotate: cfg.rotate, scale: cfg.scale };
        return (
          <motion.div
            key={card.key}
            className={cx(styles.card, isFront && styles.front)}
            style={{ zIndex: n - slot }}
            initial={{ opacity: 0, y: 16, scale: 0.9, rotate: 0 }}
            animate={target}
            transition={introDone ? { duration: 0.7, ease: motionTokens.ease } : { delay: startDelay + slot * 0.07, duration: 0.55, ease: motionTokens.ease }}
            aria-hidden={isFront ? undefined : true}
            data-slot={slot}
          >
            <Link to={card.to} className={styles.cardLink} tabIndex={isFront ? 0 : -1}>
              <b className={styles.name}>{card.name}</b>
              <span className={styles.desc}>{card.desc}</span>
              <span className={styles.chips}>{card.chips.map((c) => <span key={c} className={styles.chip}>{c}</span>)}</span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
