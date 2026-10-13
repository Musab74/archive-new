import type { ReactNode } from 'react';
import styles from './StatCard.module.css';
import { cx } from '../utils/format';
import { useCountUp } from '../motion/useCountUp';

export interface StatCardProps { title: ReactNode; value: number; unit?: string; caption?: ReactNode; progress?: number; tone?: 'ink' | 'navy' | 'mint'; countUp?: boolean; className?: string }

/** Metric tile with optional count-up and progress bar. */
export function StatCard({ title, value, unit, caption, progress, tone = 'ink', countUp = true, className }: StatCardProps) {
  const shown = useCountUp(value, { enabled: countUp });
  return (
    <div className={cx(styles.card, tone !== 'ink' && styles[tone], className)}>
      <span className={styles.title}>{title}</span>
      <span className={styles.number} aria-label={`${value.toLocaleString('ko-KR')}${unit ?? ''}`}>{shown.toLocaleString('ko-KR')}{unit ? <small>{unit}</small> : null}</span>
      {progress !== undefined ? (
        <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>
      ) : null}
      {caption ? <span className={styles.caption}>{caption}</span> : null}
    </div>
  );
}
