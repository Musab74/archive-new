import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import styles from './SearchField.module.css';
import { Icon } from './Icon';
import { cx } from '../utils/format';

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onSubmit' | 'size' | 'type'> {
  /** Accessible label for the input (visually hidden). */
  label: string;
  /** Called with the trimmed query on submit. */
  onSearch: (q: string) => void;
  submitLabel?: string;
  /** Text label on the submit button; omitted → icon-only button with `submitLabel` as its name. */
  showSubmitText?: boolean;
  clearLabel?: string;
  loading?: boolean;
  size?: 'md' | 'lg';
  /** Fires after the clear button empties the field (e.g. to drop ?q= from the URL). */
  onClear?: () => void;
  formClassName?: string;
}

/**
 * Search form: leading icon, input, clear (×) button once there is text, spinner while `loading`, submit button.
 * Uncontrolled (defaultValue) so it stays cheap inside large pages; `ref` exposes the input.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { label, onSearch, submitLabel = '검색', showSubmitText = true, clearLabel = '검색어 지우기', loading, size = 'md', onClear, formClassName, id, defaultValue, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [hasText, setHasText] = useState(() => String(defaultValue ?? '').length > 0);
  const inputId = id ?? 'search-field';
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); onSearch((inputRef.current?.value ?? '').trim()); };
  const clear = () => {
    if (!inputRef.current) return;
    inputRef.current.value = '';
    setHasText(false);
    inputRef.current.focus();
    onClear?.();
  };
  return (
    <form className={cx(styles.form, styles[size], formClassName)} role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor={inputId}>{label}</label>
      <span className={styles.lead} aria-hidden="true">{loading ? <Icon name="loader" size={19} className={styles.spin} /> : <Icon name="search" size={19} />}</span>
      <input ref={inputRef} id={inputId} type="search" autoComplete="off" defaultValue={defaultValue} enterKeyHint="search" onInput={(e) => setHasText(e.currentTarget.value.length > 0)} {...rest} />
      {hasText ? <button type="button" className={styles.clear} onClick={clear} aria-label={clearLabel}><Icon name="close" size={15} strokeWidth={2.25} /></button> : null}
      <button type="submit" className={cx(styles.submit, !showSubmitText && styles.iconOnly)} aria-label={showSubmitText ? undefined : submitLabel}>
        {showSubmitText ? submitLabel : <Icon name="arrow" size={18} />}
      </button>
    </form>
  );
});
