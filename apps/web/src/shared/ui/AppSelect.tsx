import { useMemo, type CSSProperties } from 'react';
import * as RS from '@radix-ui/react-select';
import styles from './AppSelect.module.css';
import { Icon, type IconName } from './Icon';
import { cx } from '../utils/format';

export interface AppSelectOption { value: string; label: string; disabled?: boolean }

export interface AppSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  /** Shown in the trigger while `value` matches no option. */
  placeholder?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  /** Spinner in the trigger and a disabled control (e.g. options still loading). */
  loading?: boolean;
  /** Text in the panel when there are no options. */
  emptyText?: string;
  size?: 'sm' | 'md';
  /** `dark` for controls on dark surfaces (video player); `quiet` drops the border until hover. */
  tone?: 'default' | 'dark' | 'quiet';
  /** Leading icon inside the trigger (e.g. 'sort'). */
  icon?: IconName;
  /** Small muted prefix before the value inside the trigger (e.g. "정렬"). */
  prefix?: string;
  align?: 'start' | 'center' | 'end';
  /** false renders the panel in place (required inside a fullscreen element); default portals to <body>. */
  portal?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Radix forbids "" as an item value; "" options (전체 / placeholder rows) ride on this sentinel internally. */
const EMPTY = '__app_select_empty__';
const toInner = (v: string) => (v === '' ? EMPTY : v);
const toOuter = (v: string) => (v === EMPTY ? '' : v);

/**
 * The one select control of the design system (Radix Select: combobox + listbox semantics, typeahead, arrow/Home/End,
 * Escape, focus return, collision-aware popper). Styled only through tokens. The API mirrors a controlled native select
 * with string values, so "" works as a real option value (e.g. 전체).
 */
export function AppSelect({
  value, onValueChange, options, placeholder, id, name, disabled, required, invalid, loading, emptyText = '선택할 항목이 없습니다.',
  size = 'md', tone = 'default', icon, prefix, align = 'start', portal = true, className, style, ...aria
}: AppSelectProps) {
  const hasValue = useMemo(() => options.some((o) => o.value === value), [options, value]);
  const inner = hasValue ? toInner(value) : '';
  const content = (
    <RS.Content className={cx(styles.content, tone === 'dark' && styles.contentDark)} position="popper" sideOffset={6} align={align} collisionPadding={12}>
      <RS.ScrollUpButton className={styles.scroll}><Icon name="chevron-up" size={16} /></RS.ScrollUpButton>
      <RS.Viewport className={styles.viewport}>
        {options.length === 0 ? <div className={styles.empty} role="presentation">{emptyText}</div> : options.map((o) => (
          <RS.Item key={o.value || EMPTY} value={toInner(o.value)} disabled={o.disabled} className={styles.item}>
            <RS.ItemText>{o.label}</RS.ItemText>
            <RS.ItemIndicator className={styles.check}><Icon name="check" size={16} strokeWidth={2.25} /></RS.ItemIndicator>
          </RS.Item>
        ))}
      </RS.Viewport>
      <RS.ScrollDownButton className={styles.scroll}><Icon name="chevron-down" size={16} /></RS.ScrollDownButton>
    </RS.Content>
  );
  return (
    <RS.Root value={inner} onValueChange={(v) => onValueChange(toOuter(v))} disabled={disabled || loading} name={name} required={required}>
      <RS.Trigger
        id={id}
        className={cx(styles.trigger, styles[size], tone !== 'default' && styles[tone], className)}
        style={style}
        aria-invalid={invalid || undefined}
        aria-busy={loading || undefined}
        {...aria}
      >
        {icon ? <Icon name={icon} size={16} className={styles.lead} /> : null}
        {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
        <span className={styles.value}><RS.Value placeholder={placeholder ?? '선택'} /></span>
        <RS.Icon className={styles.chevron}>
          {loading ? <Icon name="loader" size={16} className={styles.spin} /> : <Icon name="chevron-down" size={16} />}
        </RS.Icon>
      </RS.Trigger>
      {portal ? <RS.Portal>{content}</RS.Portal> : content}
    </RS.Root>
  );
}
