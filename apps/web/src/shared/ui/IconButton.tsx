import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styles from './IconButton.module.css';
import { cx } from '../utils/format';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Required: the accessible name. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  plain?: boolean;
  active?: boolean;
  iconSize?: number;
}

/** Circular 44 px icon button (storyboard `.icon-btn`) with an aria-label. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ icon, label, size = 'md', plain, active, iconSize, className, type, ...rest }, ref) {
  return (
    <button ref={ref} type={type ?? 'button'} aria-label={label} title={label} className={cx(styles.btn, size !== 'md' && styles[size], plain && styles.plain, active && styles.active, className)} {...rest}>
      <Icon name={icon} size={iconSize ?? (size === 'sm' ? 18 : 22)} />
    </button>
  );
});
