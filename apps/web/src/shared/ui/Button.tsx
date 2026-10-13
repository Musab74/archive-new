import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Button.module.css';
import { cx } from '../utils/format';
import { Icon } from './Icon';
import { common } from '../strings/ko';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'pill-dark' | 'text' | 'white' | 'accent';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** 5 px corner (storyboard primary-btn) instead of the pill. */
  square?: boolean;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
  className?: string;
}
type ButtonAsButton = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & { to?: undefined; href?: undefined };
type ButtonAsLink = BaseProps & { to: string; href?: undefined; external?: false } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'className'>;
type ButtonAsExternal = BaseProps & { href: string; to?: undefined; external?: boolean } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'className'>;
export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsExternal;

const variantClass: Record<ButtonVariant, string> = { primary: styles.primary, secondary: styles.secondary, ghost: styles.ghost, 'pill-dark': styles.pillDark, text: styles.text, white: styles.white, accent: styles.accent };

/**
 * Button / router Link / external anchor with one visual API.
 * - external links open in a new tab with rel="noopener noreferrer" and a visible ↗ mark + sr text.
 * - `loading` keeps the width, hides the label and sets aria-busy.
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(props, ref) {
  const { variant = 'primary', size = 'md', loading = false, square = false, block = false, icon, iconRight, children, className } = props;
  const cls = cx(styles.btn, variantClass[variant], styles[size], square && styles.square, block && styles.block, loading && styles.loading, className);
  const inner = (
    <>
      {icon}
      {children}
      {iconRight ? <span className={styles.trail} aria-hidden="true">{iconRight}</span> : null}
      {loading ? <span className={styles.spinner} aria-hidden="true"><span /></span> : null}
    </>
  );

  if ('to' in props && props.to !== undefined) {
    const { to, variant: _v, size: _s, loading: _l, square: _q, block: _b, icon: _i, iconRight: _r, children: _c, className: _cn, external: _e, ...rest } = props as ButtonAsLink;
    return <Link ref={ref as React.Ref<HTMLAnchorElement>} to={to} className={cls} aria-busy={loading || undefined} {...rest}>{inner}</Link>;
  }
  if ('href' in props && props.href !== undefined) {
    const { href, external = true, variant: _v, size: _s, loading: _l, square: _q, block: _b, icon: _i, iconRight: _r, children: _c, className: _cn, ...rest } = props as ButtonAsExternal;
    return (
      <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={cls} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} aria-busy={loading || undefined} {...rest}>
        {icon}
        {children}
        {external ? <><span className={styles.ext} aria-hidden="true"><Icon name="arrow-up-right" size={15} /></span><span className="sr-only"> ({common.external})</span></> : iconRight ? <span className={styles.trail} aria-hidden="true">{iconRight}</span> : null}
        {loading ? <span className={styles.spinner} aria-hidden="true"><span /></span> : null}
      </a>
    );
  }
  const { variant: _v, size: _s, loading: _l, square: _q, block: _b, icon: _i, iconRight: _r, children: _c, className: _cn, type, disabled, ...rest } = props as ButtonAsButton;
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type={type ?? 'button'} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {inner}
    </button>
  );
});

export function ArrowIcon({ size = 16 }: { size?: number }) { return <Icon name="arrow" size={size} />; }
