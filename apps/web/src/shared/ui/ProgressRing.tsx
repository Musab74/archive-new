import type { ReactNode } from 'react';
import styles from './ProgressRing.module.css';
import { cx } from '../utils/format';

export interface ProgressRingProps {
  /** 0–100. `null` renders the ring empty with a dash (aggregate unknown — never shown as 0). */
  percent: number | null;
  size?: number;
  stroke?: number;
  /** Text inside the ring (e.g. "9시간 30분"). */
  label?: ReactNode;
  sub?: ReactNode;
  tone?: 'primary' | 'ok' | 'ink';
  /** Accessible name for the progressbar. */
  ariaLabel: string;
  className?: string;
}

/** Circular progress (AR-02/AR-11 15 h ring). Pure SVG, animated with CSS, respects reduced motion. */
export function ProgressRing({ percent, size = 148, stroke = 11, label, sub, tone = 'primary', ariaLabel, className }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  const offset = c - (c * p) / 100;
  return (
    <div className={cx(styles.wrap, styles[tone], className)} style={{ width: size, height: size }} role="progressbar" aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent === null ? undefined : Math.round(p)} aria-valuetext={percent === null ? '집계 미확인' : `${Math.round(p)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className={styles.track} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle className={styles.bar} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className={styles.center}>
        <span className={styles.label}>{label ?? (percent === null ? '—' : `${Math.round(p)}%`)}</span>
        {sub ? <span className={styles.sub}>{sub}</span> : null}
      </div>
    </div>
  );
}
