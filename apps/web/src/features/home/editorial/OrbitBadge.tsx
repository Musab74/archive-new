import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion, type MotionValue } from 'framer-motion';
import styles from './OrbitRing.module.css';
import { Icon, type IconName } from '../../../shared/ui/Icon';
import type { Lane } from './orbitMath';

export interface OrbitBadgeSpec { key: string; name: string; icon: IconName; to: string; color: string; lane: Lane }
export interface BadgeMotion {
  x: MotionValue<number>; y: MotionValue<number>; o: MotionValue<number>; s: MotionValue<number>;
  rot: MotionValue<number>; sx: MotionValue<number>; so: MotionValue<number>;
}

interface Props { spec: OrbitBadgeSpec; mv?: BadgeMotion; staticAt?: { x: number; y: number; scale: number; opacity: number } }

/**
 * One badge riding the ring. The position layer (li) only ever changes transform/opacity; the streak is a
 * pre-blurred gradient rotated to the travel tangent and stretched by speed; hover scaling lives on a separate
 * element so it never fights the position transform.
 */
export function OrbitBadge({ spec, mv, staticAt }: Props) {
  const color = { '--b': spec.color } as CSSProperties;
  const inner = (
    <motion.div className={styles.inner} whileHover={staticAt ? undefined : { scale: 1.08 }} transition={{ duration: 0.2 }}>
      <Link to={spec.to} className={styles.badge} aria-label={spec.name} data-badge={spec.key}>
        <Icon name={spec.icon} size={22} />
      </Link>
      <span className={styles.tooltip} aria-hidden="true">{spec.name}</span>
    </motion.div>
  );
  if (staticAt || !mv) {
    const p = staticAt ?? { x: 0, y: 0, scale: 1, opacity: 1 };
    return (
      <li className={styles.slot} style={{ ...color, transform: `translate(${p.x}px, ${p.y}px) scale(${p.scale})`, opacity: p.opacity }}>
        {inner}
      </li>
    );
  }
  return (
    <motion.li className={styles.slot} style={{ ...color, x: mv.x, y: mv.y, opacity: mv.o, scale: mv.s }}>
      <motion.span className={styles.streak} aria-hidden="true" style={{ rotate: mv.rot, scaleX: mv.sx, opacity: mv.so }} />
      {inner}
    </motion.li>
  );
}
