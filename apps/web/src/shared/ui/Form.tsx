import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import styles from './Form.module.css';
import { cx } from '../utils/format';
import { common } from '../strings/ko';

export interface FormFieldProps { label: ReactNode; required?: boolean; optional?: boolean; help?: ReactNode; error?: ReactNode; htmlFor?: string; children: ReactNode; className?: string; action?: ReactNode }

/** Label + control + help/error (storyboard `.field`). Pass `action` for an inline button like 본인인증 / 중복 확인. */
export function FormField({ label, required, optional, help, error, htmlFor, children, className, action }: FormFieldProps) {
  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required ? <span className={styles.req} aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only">({common.required})</span> : null}
        {optional ? <span className={styles.opt}>({common.optional})</span> : null}
      </label>
      {action ? <div className={styles.row}>{children}{action}</div> : children}
      {error ? <span className={styles.error} role="alert">{error}</span> : help ? <span className={styles.help}>{help}</span> : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { invalid?: boolean }
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={cx(styles.input, className)} aria-invalid={invalid || undefined} {...rest} />;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { invalid?: boolean }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(styles.input, styles.textarea, className)} aria-invalid={invalid || undefined} {...rest} />;
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { invalid?: boolean; options: { value: string; label: string; disabled?: boolean }[]; placeholder?: string }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, className, options, placeholder, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(styles.input, styles.select, className)} aria-invalid={invalid || undefined} {...rest}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
    </select>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> { label: ReactNode }
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, className, id, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label className={cx(styles.check, className)} htmlFor={inputId}>
      <input ref={ref} id={inputId} type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
});

/** Inline form message: error (red bar) or ok (green bar). Empty text renders nothing. */
export function FormMessage({ tone = 'error', children }: { tone?: 'error' | 'ok'; children?: ReactNode }) {
  if (!children) return null;
  return <p className={tone === 'ok' ? styles.fieldOk : styles.fieldError} role={tone === 'error' ? 'alert' : 'status'}>{children}</p>;
}

export function MiniButton({ className, type, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type ?? 'button'} className={cx(styles.mini, className)} {...rest} />;
}
