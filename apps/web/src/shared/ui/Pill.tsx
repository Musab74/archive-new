import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import styles from './Pill.module.css';
import { cx } from '../utils/format';
import { catalog as catalogCopy } from '../strings/ko';

export type TypeLabelTone = 'navy' | 'mint' | 'warm' | 'ink' | 'gray' | 'coral' | 'coral-soft';

/** 환급형 / 비환급형 / 유형 badge (storyboard `.type-label`). */
export function TypeLabel({ tone = 'navy', small, className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: TypeLabelTone; small?: boolean; children: ReactNode }) {
  return <span className={cx(styles.typeLabel, tone !== 'navy' && styles[tone === 'coral-soft' ? 'coralSoft' : tone], small && styles.small, className)} {...rest}>{children}</span>;
}

export function Tag({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return <span className={cx(styles.tag, className)} {...rest}>{children}</span>;
}

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> { pressed?: boolean; soft?: boolean; small?: boolean }
/** Toggle pill button (segment / filter). Exposes aria-pressed. */
export function Pill({ pressed = false, soft, small, className, children, type, ...rest }: PillProps) {
  return (
    <button type={type ?? 'button'} aria-pressed={pressed} className={cx(styles.pill, soft && styles.pillSoft, small && styles.pillSm, className)} {...rest}>
      {children}
    </button>
  );
}

/** Removable selected-filter chip. */
export function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className={styles.chip} onClick={onRemove} aria-label={catalogCopy.remove(label)}>
      <span>{label}</span>
      <span aria-hidden="true">×</span>
    </button>
  );
}
