import type { ReactNode } from 'react';
import styles from './MetricCard.module.css';
import { cx } from '../utils/format';

export interface MetricCardProps { title: ReactNode; value: ReactNode; caption?: ReactNode; tone?: 'ink' | 'navy' | 'mint' | 'muted'; progress?: number | null; className?: string; compact?: boolean }

/**
 * Metric tile for pre-formatted values ("15시간 00분", "—"). Unlike StatCard it never counts up or formats numbers:
 * aggregates come from the server and are shown as-is (AR-06/AR-11 "집계 조회 실패는 —").
 */
export function MetricCard({ title, value, caption, tone = 'ink', progress, className, compact }: MetricCardProps) {
  return (
    <div className={cx(styles.card, tone !== 'ink' && styles[tone], compact && styles.compact, className)}>
      <span className={styles.title}>{title}</span>
      <span className={styles.value}>{value}</span>
      {progress !== undefined ? (
        <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress === null ? undefined : Math.round(Math.min(100, Math.max(0, progress)))} aria-valuetext={progress === null ? '집계 미확인' : undefined}>
          <span style={{ width: `${progress === null ? 0 : Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      ) : null}
      {caption ? <span className={styles.caption}>{caption}</span> : null}
    </div>
  );
}
