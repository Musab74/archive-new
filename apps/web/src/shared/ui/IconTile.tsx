import type { CSSProperties } from 'react';
import styles from './IconTile.module.css';
import { Icon, type IconName } from './Icon';
import { cx } from '../utils/format';

/** Category hues from the support palette (tokens.css → --cat-*). */
export type IconTone = 'blue' | 'teal' | 'violet' | 'indigo' | 'cyan' | 'coral' | 'amber' | 'emerald' | 'navy';

export interface IconTileProps { icon: IconName; tone?: IconTone; size?: 'sm' | 'md' | 'lg'; solid?: boolean; className?: string }

const ICON_PX = { sm: 16, md: 20, lg: 24 } as const;

/**
 * Tinted icon container: the tone colour on a 12 % tint of itself with a hairline ring (≥ 3:1 for the glyph).
 * `solid` inverts it (white glyph on the tone) for emphasis. Decorative — pair it with a visible label.
 */
export function IconTile({ icon, tone = 'blue', size = 'md', solid, className }: IconTileProps) {
  return (
    <span className={cx(styles.tile, styles[size], solid && styles.solid, className)} style={{ '--tone': `var(--cat-${tone})` } as CSSProperties} aria-hidden="true" data-tone={tone}>
      <Icon name={icon} size={ICON_PX[size]} />
    </span>
  );
}
