import { motion, useReducedMotionConfig } from 'framer-motion';
import styles from './EditorialHero.module.css';
import { useCountUp } from '../../../shared/motion/useCountUp';
import { loadInChild, loadInChildReduced } from '../../../shared/motion/loadIn';
import { cx } from '../../../shared/utils/format';

export interface StatItem { key: string; value: number | null; unit?: string; caption: string }

function Stat({ item, start, delay }: { item: StatItem; start: boolean; delay: number }) {
  const reduced = useReducedMotionConfig();
  const target = item.value ?? 0;
  const shown = useCountUp(target, { duration: 1200, enabled: start && item.value !== null, delay });
  const text = item.value === null ? '—' : shown.toLocaleString('ko-KR');
  return (
    <div className={styles.stat} role="group" aria-label={`${item.caption} ${item.value === null ? '' : item.value.toLocaleString('ko-KR') + (item.unit ?? '')}`.trim()}>
      <span className={cx(styles.statNum, item.value === null && styles.statPending)} aria-hidden="true">{text}<small>{item.value === null ? '' : item.unit}</small></span>
      <motion.span className={styles.statCap} variants={reduced ? loadInChildReduced : loadInChild}>{item.caption}</motion.span>
    </div>
  );
}

/** Three large numerals with small captions; count-up starts once (`start`), captions fade in underneath. */
export function HeroStats({ items, start, delay = 500, label, className }: { items: StatItem[]; start: boolean; delay?: number; label: string; className?: string }) {
  return (
    <motion.div className={cx(styles.stats, className)} aria-label={label} role="list" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { delayChildren: delay / 1000, staggerChildren: 0.1 } } }}>
      {items.map((it) => <div role="listitem" key={it.key}><Stat item={it} start={start} delay={delay} /></div>)}
    </motion.div>
  );
}
