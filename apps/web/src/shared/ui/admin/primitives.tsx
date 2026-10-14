import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import styles from './admin.module.css';
import { AppSelect, type AppSelectProps } from '../AppSelect';
import { cx } from '../../utils/format';

export interface Crumb { label: string; to?: string }

/** Page frame: breadcrumb, title, lead, actions on the right. */
export function AdminPage({ title, lead, crumbs, actions, children, className }: { title: ReactNode; lead?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cx(styles.page, className)}>
      <div className={styles.pageHead}>
        <div>
          {crumbs?.length ? (
            <nav className={styles.crumb} aria-label="현재 위치">
              {crumbs.map((c, i) => <span key={`${c.label}${i}`}>{i > 0 ? <span aria-hidden="true"> › </span> : null}{c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <b aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</b>}</span>)}
            </nav>
          ) : null}
          <h1>{title}</h1>
          {lead ? <p className={styles.pageLead}>{lead}</p> : null}
        </div>
        {actions ? <div className={styles.pageActions}>{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, aside, children, className }: { title?: ReactNode; aside?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={cx(styles.card, className)}>
      {title || aside ? <div className={styles.cardTitle}><h2>{title}</h2>{aside}</div> : null}
      {children}
    </section>
  );
}

export function Kpi({ label, value, unit, hint, tone }: { label: ReactNode; value: number | string | null | undefined; unit?: string; hint?: ReactNode; tone?: 'warn' | 'ok' | 'navy' }) {
  const shown = value === null || value === undefined ? '—' : typeof value === 'number' ? value.toLocaleString('ko-KR') : value;
  return (
    <div className={cx(styles.kpi, tone === 'warn' && styles.kpiWarn, tone === 'ok' && styles.kpiOk, tone === 'navy' && styles.kpiNavy)}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{shown}{unit && value !== null && value !== undefined ? <small>{unit}</small> : null}</span>
      {hint ? <span className={styles.kpiHint}>{hint}</span> : null}
    </div>
  );
}

/** Two-column description list: items = [label, value][] ; `cols=2` renders 4 columns on wide screens. */
export function DescList({ items, cols = 1, className }: { items: [ReactNode, ReactNode][]; cols?: 1 | 2; className?: string }) {
  return (
    <dl className={cx(styles.dl, cols === 2 && styles.dl2, className)}>
      {items.map(([k, v], i) => <div key={i} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v === null || v === undefined || v === '' ? <span className={styles.muted}>—</span> : v}</dd></div>)}
    </dl>
  );
}

export function Callout({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode; className?: string }) {
  return <div className={cx(styles.callout, tone === 'warn' && styles.calloutWarn, tone === 'ok' && styles.calloutOk, className)} role={tone === 'warn' ? 'alert' : undefined}>{children}</div>;
}

export interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'link'; size?: 'md' | 'sm' | 'xs'; loading?: boolean; to?: string }
/** Compact admin button (34 px). `to` renders a router link. */
export const AButton = forwardRef<HTMLButtonElement, AdminButtonProps>(function AButton({ variant = 'default', size = 'md', loading, className, type, children, disabled, to, ...rest }, ref) {
  const cls = cx(styles.btn, variant === 'primary' && styles.btnPrimary, variant === 'danger' && styles.btnDanger, variant === 'ghost' && styles.btnGhost, variant === 'link' && styles.btnLink, size === 'sm' && styles.btnSm, size === 'xs' && styles.btnXs, className);
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <button ref={ref} type={type ?? 'button'} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>{loading ? '처리 중…' : children}</button>;
});

export interface AInputProps extends InputHTMLAttributes<HTMLInputElement> { invalid?: boolean }
export const AInput = forwardRef<HTMLInputElement, AInputProps>(function AInput({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={cx(styles.input, className)} aria-invalid={invalid || undefined} {...rest} />;
});
export interface ATextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { invalid?: boolean }
export const ATextarea = forwardRef<HTMLTextAreaElement, ATextareaProps>(function ATextarea({ invalid, className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(styles.input, styles.textarea, className)} aria-invalid={invalid || undefined} {...rest} />;
});
export interface ASelectProps extends Omit<AppSelectProps, 'options' | 'onValueChange' | 'size'> {
  options: { value: string; label: string }[];
  /** Change-event shape kept from the native select so admin forms read `e.target.value` unchanged. */
  onChange?: (e: { target: { value: string } }) => void;
}
/** Admin select = the shared AppSelect (compact). `placeholder` becomes a selectable "" first option, as before. */
export function ASelect({ options, placeholder, onChange, ...rest }: ASelectProps) {
  const opts = placeholder !== undefined && !options.some((o) => o.value === '') ? [{ value: '', label: placeholder }, ...options] : options;
  return <AppSelect size="sm" {...rest} placeholder={placeholder} options={opts} onValueChange={(v) => onChange?.({ target: { value: v } })} />;
}

/** Label + control in a 140px / 1fr row (admin forms). */
export function FieldRow({ label, children, help, error, htmlFor, required }: { label: ReactNode; children: ReactNode; help?: ReactNode; error?: ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <div className={styles.fieldRow}>
      <label htmlFor={htmlFor}>{label}{required ? <span style={{ color: 'var(--c-danger)' }} aria-hidden="true"> *</span> : null}</label>
      <div className={styles.stack} style={{ gap: 4 }}>
        {children}
        {error ? <span className={styles.error} role="alert">{error}</span> : help ? <span className={styles.help}>{help}</span> : null}
      </div>
    </div>
  );
}

export function ACheckbox({ label, id, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }) {
  const auto = useId();
  const inputId = id ?? auto;
  return <label className={cx(styles.check, className)} htmlFor={inputId}><input id={inputId} type="checkbox" {...rest} /><span>{label}</span></label>;
}

/** Simple progress bar 0..100. */
export function Bar({ value, tone }: { value: number; tone?: 'warn' | 'ok' }) {
  const v = Math.min(100, Math.max(0, value));
  return <div className={cx(styles.bar, tone === 'warn' && styles.barWarn, tone === 'ok' && styles.barOk)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}><span style={{ width: `${v}%` }} /></div>;
}

/** Tab strip as router links or buttons. */
export function TabStrip({ items, value, onChange, label }: { items: { key: string; label: ReactNode; to?: string }[]; value?: string; onChange?: (k: string) => void; label: string }) {
  const links = items.every((i) => i.to);
  return (
    <div className={styles.tabs} role={links ? undefined : 'tablist'} aria-label={label}>
      {items.map((it) => it.to ? (
        <Link key={it.key} to={it.to} className={styles.tab} aria-current={it.key === value ? 'page' : undefined}>{it.label}</Link>
      ) : (
        <button key={it.key} type="button" role="tab" className={styles.tab} aria-selected={it.key === value} onClick={() => onChange?.(it.key)}>{it.label}</button>
      ))}
    </div>
  );
}

export const adminStyles = styles;
