import type { ReactNode } from 'react';
import styles from './admin.module.css';
import { cx } from '../../utils/format';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'ink';

export function StatusBadge({ tone = 'neutral', children, dot, title }: { tone?: BadgeTone; children: ReactNode; dot?: boolean; title?: string }) {
  const cls: Record<BadgeTone, string | undefined> = { neutral: undefined, ok: styles.badgeOk, warn: styles.badgeWarn, danger: styles.badgeDanger, info: styles.badgeInfo, ink: styles.badgeInk };
  return <span className={cx(styles.badge, cls[tone])} title={title}>{dot ? <span className={styles.badgeDot} aria-hidden="true" /> : null}{children}</span>;
}

/** Y/N → 사용/미사용 badge. */
export function YnBadge({ value, yes = '사용', no = '미사용' }: { value: string | boolean | null | undefined; yes?: string; no?: string }) {
  const on = value === true || value === 'Y';
  return <StatusBadge tone={on ? 'ok' : 'neutral'}>{on ? yes : no}</StatusBadge>;
}

export function BoolBadge({ value, yes = '완료', no = '미완료', tone = 'ok' }: { value: boolean | null | undefined; yes?: string; no?: string; tone?: BadgeTone }) {
  return <StatusBadge tone={value ? tone : 'neutral'}>{value ? yes : no}</StatusBadge>;
}
