import type { ReactNode } from 'react';
import styles from './admin.module.css';
import { cx } from '../../utils/format';
import { useT } from '../../i18n/adminLang';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'ink';

export function StatusBadge({ tone = 'neutral', children, dot, title }: { tone?: BadgeTone; children: ReactNode; dot?: boolean; title?: string }) {
  const cls: Record<BadgeTone, string | undefined> = { neutral: undefined, ok: styles.badgeOk, warn: styles.badgeWarn, danger: styles.badgeDanger, info: styles.badgeInfo, ink: styles.badgeInk };
  return <span className={cx(styles.badge, cls[tone])} title={title}>{dot ? <span className={styles.badgeDot} aria-hidden="true" /> : null}{children}</span>;
}

/** Y/N → 사용/미사용 (Active/Inactive) badge. */
export function YnBadge({ value, yes, no }: { value: string | boolean | null | undefined; yes?: string; no?: string }) {
  const t = useT();
  const on = value === true || value === 'Y';
  return <StatusBadge tone={on ? 'ok' : 'neutral'}>{on ? yes ?? t('사용', 'Active') : no ?? t('미사용', 'Inactive')}</StatusBadge>;
}

export function BoolBadge({ value, yes, no, tone = 'ok' }: { value: boolean | null | undefined; yes?: string; no?: string; tone?: BadgeTone }) {
  const t = useT();
  return <StatusBadge tone={value ? tone : 'neutral'}>{value ? yes ?? t('완료', 'Done') : no ?? t('미완료', 'Not done')}</StatusBadge>;
}
