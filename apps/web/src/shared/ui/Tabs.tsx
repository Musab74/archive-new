import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Tabs.module.css';
import { cx } from '../utils/format';
import { Pill } from './Pill';

export interface TabItem { key: string; label: ReactNode; to?: string; disabled?: boolean }

export interface TabsProps { items: TabItem[]; value?: string; onChange?: (key: string) => void; label: string; className?: string }

function useArrowNav(onMove: (dir: 1 | -1) => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); onMove(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onMove(-1); }
  };
}

/** Underline tabs (storyboard `.detail-tabs` / `.doc-tabs`). With `to` they render as router links. */
export function Tabs({ items, value, onChange, label, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const move = (dir: 1 | -1) => {
    const idx = items.findIndex((i) => i.key === value);
    const next = items[(idx + dir + items.length) % items.length];
    if (next && onChange) { onChange(next.key); (listRef.current?.querySelector<HTMLElement>(`[data-key="${next.key}"]`))?.focus(); }
  };
  const onKey = useArrowNav(move);
  const isLinks = items.every((i) => i.to);
  return (
    <div ref={listRef} className={cx(styles.tabs, className)} role={isLinks ? undefined : 'tablist'} aria-label={label} onKeyDown={isLinks ? undefined : onKey}>
      {items.map((it) => it.to ? (
        <NavLink key={it.key} to={it.to} className={styles.tab} end>{it.label}</NavLink>
      ) : (
        <button key={it.key} type="button" role="tab" data-key={it.key} aria-selected={it.key === value} tabIndex={it.key === value ? 0 : -1} className={styles.tab} disabled={it.disabled} onClick={() => onChange?.(it.key)}>{it.label}</button>
      ))}
    </div>
  );
}

export function TabPanel({ active, children, className }: { active: boolean; children: ReactNode; className?: string }) {
  const id = useId();
  if (!active) return null;
  return <div id={id} role="tabpanel" tabIndex={-1} className={cx(styles.panel, className)}>{children}</div>;
}

/** Pill segment (storyboard `.segment`) with aria-pressed semantics. */
export function PillTabs({ items, value, onChange, label, className, soft, small }: TabsProps & { soft?: boolean; small?: boolean }) {
  return (
    <div className={cx(styles.pills, className)} role="group" aria-label={label}>
      {items.map((it) => <Pill key={it.key} pressed={it.key === value} soft={soft} small={small} disabled={it.disabled} onClick={() => onChange?.(it.key)}>{it.label}</Pill>)}
    </div>
  );
}
