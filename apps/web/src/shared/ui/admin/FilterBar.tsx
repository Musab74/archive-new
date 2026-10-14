import type { FormEvent, ReactNode } from 'react';
import styles from './admin.module.css';
import { cx } from '../../utils/format';
import { useT } from '../../i18n/adminLang';
import { Icon } from '../Icon';

export interface FilterBarProps {
  children: ReactNode;
  onSubmit?: () => void;
  onReset?: () => void;
  submitLabel?: string;
  resetLabel?: string;
  /** Extra controls on the right (e.g. export button). */
  extra?: ReactNode;
  className?: string;
  label?: string;
}

/** Filter form: a responsive grid of fields, then 검색/초기화 (Search/Reset) on their own row. Submits on Enter. */
export function FilterBar({ children, onSubmit, onReset, submitLabel, resetLabel, extra, className, label }: FilterBarProps) {
  const t = useT();
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit?.(); };
  return (
    <form className={cx(styles.filter, className)} role="search" aria-label={label ?? t('검색 조건', 'Search filters')} onSubmit={submit}>
      {children}
      <div className={styles.filterActions}>
        {extra}
        {onReset ? <button type="button" className={styles.btn} onClick={onReset}><Icon name="reset" size={16} />{resetLabel ?? t('초기화', 'Reset')}</button> : null}
        {onSubmit ? <button type="submit" className={cx(styles.btn, styles.btnPrimary)}><Icon name="search" size={16} />{submitLabel ?? t('검색', 'Search')}</button> : null}
      </div>
    </form>
  );
}

export interface FilterFieldProps {
  label: ReactNode; htmlFor?: string; children: ReactNode;
  /** Size hint from the old flex layout: ≥ 220 (or `wide`) spans two grid tracks; smaller values take one. */
  width?: number | string; wide?: boolean; className?: string;
}
export function FilterField({ label, htmlFor, children, width, wide, className }: FilterFieldProps) {
  const span2 = wide ?? (typeof width === 'number' && width >= 220);
  return <label className={cx(styles.field, span2 && styles.fieldWide, className)} htmlFor={htmlFor}><span>{label}</span>{children}</label>;
}
