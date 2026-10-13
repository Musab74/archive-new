import styles from './EditorialHero.module.css';
import { useCountUp } from '../../../shared/motion/useCountUp';
import { cx } from '../../../shared/utils/format';

export interface StatItem { key: string; value: number | null; unit?: string; caption: string }

function Stat({ item, start, delay }: { item: StatItem; start: boolean; delay: number }) {
  const target = item.value ?? 0;
  const shown = useCountUp(target, { duration: 1200, enabled: start && item.value !== null, delay });
  const text = item.value === null ? '—' : shown.toLocaleString('ko-KR');
  return (
    <div className={styles.stat} role="group" aria-label={`${item.caption} ${item.value === null ? '' : item.value.toLocaleString('ko-KR') + (item.unit ?? '')}`.trim()}>
      <span className={cx(styles.statNum, item.value === null && styles.statPending)} aria-hidden="true">{text}<small>{item.value === null ? '' : item.unit}</small></span>
      <span className={styles.statCap} aria-hidden="true">{item.caption}</span>
    </div>
  );
}

/** Stats strip: large numerals with a caption underneath, separated by hairlines; count-up starts once (`start`). */
export function HeroStats({ items, start, delay = 400, label, className }: { items: StatItem[]; start: boolean; delay?: number; label: string; className?: string }) {
  return (
    <div className={cx(styles.stats, className)} aria-label={label} role="list">
      {items.map((it) => <div role="listitem" key={it.key}><Stat item={it} start={start} delay={delay} /></div>)}
    </div>
  );
}
