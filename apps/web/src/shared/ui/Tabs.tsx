import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, useReducedMotionConfig } from 'framer-motion';
import styles from './Tabs.module.css';
import { cx } from '../utils/format';

export interface TabItem { key: string; label: ReactNode; to?: string; disabled?: boolean }

export interface TabsProps { items: TabItem[]; value?: string; onChange?: (key: string) => void; label: string; className?: string }

const SLIDE = { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 } as const;

function useArrowNav(onMove: (dir: 1 | -1) => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); onMove(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onMove(-1); }
  };
}

/** Underline tabs with an indicator that glides to the selected tab. With `to` they render as router links. */
export function Tabs({ items, value, onChange, label, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const layoutId = useId();
  const reduced = useReducedMotionConfig();
  const move = (dir: 1 | -1) => {
    const idx = items.findIndex((i) => i.key === value);
    const next = items[(idx + dir + items.length) % items.length];
    if (next && onChange) { onChange(next.key); (listRef.current?.querySelector<HTMLElement>(`[data-key="${next.key}"]`))?.focus(); }
  };
  const onKey = useArrowNav(move);
  const isLinks = items.every((i) => i.to);
  const bar = <motion.span layoutId={`tab-${layoutId}`} className={styles.bar} transition={reduced ? { duration: 0 } : SLIDE} />;
  return (
    <div ref={listRef} className={cx(styles.tabs, className)} role={isLinks ? undefined : 'tablist'} aria-label={label} onKeyDown={isLinks ? undefined : onKey}>
      {items.map((it) => it.to ? (
        <NavLink key={it.key} to={it.to} className={styles.tab} end>{({ isActive }) => <>{it.label}{isActive ? bar : null}</>}</NavLink>
      ) : (
        <button key={it.key} type="button" role="tab" data-key={it.key} aria-selected={it.key === value} tabIndex={it.key === value ? 0 : -1} className={styles.tab} disabled={it.disabled} onClick={() => onChange?.(it.key)}>
          {it.label}{it.key === value ? bar : null}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ active, children, className }: { active: boolean; children: ReactNode; className?: string }) {
  const id = useId();
  if (!active) return null;
  return <div id={id} role="tabpanel" tabIndex={-1} className={cx(styles.panel, className)}>{children}</div>;
}

/** Segmented control (aria-pressed buttons in a group) with a thumb that slides to the selected segment. */
export function PillTabs({ items, value, onChange, label, className, soft, small }: TabsProps & { soft?: boolean; small?: boolean }) {
  const layoutId = useId();
  const reduced = useReducedMotionConfig();
  return (
    <div className={cx(styles.segment, soft && styles.segmentSoft, small && styles.segmentSm, className)} role="group" aria-label={label}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button key={it.key} type="button" aria-pressed={on} className={styles.seg} disabled={it.disabled} onClick={() => onChange?.(it.key)}>
            {on ? <motion.span layoutId={`seg-${layoutId}`} className={styles.thumb} transition={reduced ? { duration: 0 } : SLIDE} /> : null}
            <span className={styles.segLabel}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
