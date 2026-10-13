import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import styles from './Form.module.css';
import { cx } from '../utils/format';
import { common } from '../strings/ko';
import { AppSelect, type AppSelectProps } from './AppSelect';

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

export interface SelectProps extends Omit<AppSelectProps, 'options'> { options: { value: string; label: string; disabled?: boolean }[] }
/**
 * Form select = AppSelect. `placeholder` becomes a selectable "" first option (as the native `<option value="">` did),
 * so "전체 / 선택하세요" stays a real choice that resets the value.
 */
export function Select({ options, placeholder, ...rest }: SelectProps) {
  const opts = placeholder !== undefined && !options.some((o) => o.value === '') ? [{ value: '', label: placeholder }, ...options] : options;
  return <AppSelect {...rest} placeholder={placeholder} options={opts} />;
}

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
