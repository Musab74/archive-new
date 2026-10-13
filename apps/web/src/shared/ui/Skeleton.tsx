import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';
import { cx } from '../utils/format';
import { common } from '../strings/ko';

export interface SkeletonProps { width?: number | string; height?: number | string; circle?: boolean; className?: string; style?: CSSProperties; lines?: number }

/** Shimmer placeholder. `lines` renders stacked text rows; announced once as loading. */
export function Skeleton({ width, height, circle, className, style, lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div role="status" aria-label={common.loading} className={className}>
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className={cx(styles.sk, styles.text)} style={{ width: i === lines - 1 ? '60%' : '100%' }} aria-hidden="true" />
        ))}
      </div>
    );
  }
  return <span role="status" aria-label={common.loading} className={cx(styles.sk, circle && styles.circle, className)} style={{ width: width ?? '100%', height: height ?? 16, ...style }} />;
}
