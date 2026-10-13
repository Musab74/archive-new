import type { FormEvent, ReactNode } from 'react';
import styles from './admin.module.css';
import { cx } from '../../utils/format';

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

/** Horizontal filter form: fields + 검색/초기화. Submits on Enter. */
export function FilterBar({ children, onSubmit, onReset, submitLabel = '검색', resetLabel = '초기화', extra, className, label = '검색 조건' }: FilterBarProps) {
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit?.(); };
  return (
    <form className={cx(styles.filter, className)} role="search" aria-label={label} onSubmit={submit}>
      {children}
      <div className={styles.filterActions}>
        {extra}
        {onReset ? <button type="button" className={styles.btn} onClick={onReset}>{resetLabel}</button> : null}
        {onSubmit ? <button type="submit" className={cx(styles.btn, styles.btnPrimary)}>{submitLabel}</button> : null}
      </div>
    </form>
  );
}

export interface FilterFieldProps { label: ReactNode; htmlFor?: string; children: ReactNode; width?: number | string; className?: string }
export function FilterField({ label, htmlFor, children, width, className }: FilterFieldProps) {
  return <label className={cx(styles.field, className)} htmlFor={htmlFor} style={{ width }}><span>{label}</span>{children}</label>;
}
