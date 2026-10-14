import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import styles from './admin.module.css';
import { cx } from '../../utils/format';
import { Icon } from '../Icon';
import { useT, useUiLang } from '../../i18n/adminLang';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const POP_WIDTH = 300;

/** 'YYYY-MM-DD' → local Date, or null when malformed or not a real day (e.g. 2026-02-30). */
export function parseIsoDate(s: string): Date | null {
  const m = ISO.exec(s);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]) - 1; const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d ? dt : null;
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Typing helper: keeps the digits and inserts the dashes ('20261014' or '2026.10.14' → '2026-10-14'). */
export function maskIsoDate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length > 6) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
  if (d.length > 4) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Same day-of-month in another month, clamped to that month's length (Jan 31 + 1 month → Feb 28/29). */
const addMonths = (d: Date, n: number) => {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
};
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** 6 × 7 days starting on the Sunday on or before the 1st of the month. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export interface DateFieldProps {
  id?: string;
  /** 'YYYY-MM-DD' or ''. */
  value: string;
  /** Called with a valid 'YYYY-MM-DD' or '' (cleared) — never with a half-typed value. */
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Date input for the admin console: type YYYY-MM-DD (dashes are inserted for you) or pick from the calendar.
 * Replaces native `type="date"`, whose format and picker follow the browser locale (mm/dd/yyyy on English browsers).
 * Calendar keys: arrows (day/week), PageUp/PageDown (month, +Shift: year), Home/End (week), Enter to pick, Escape to close.
 */
export function DateField({ id, value, onChange, min, max, invalid, disabled, className, ...aria }: DateFieldProps) {
  const t = useT();
  const autoId = useId();
  const inputId = id ?? autoId;
  const popId = `${inputId}-calendar`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);

  useEffect(() => { setText(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const minD = min ? parseIsoDate(min) : null;
  const maxD = max ? parseIsoDate(max) : null;
  const outOfRange = (d: Date) => (!!minD && d < minD) || (!!maxD && d > maxD);
  const parsed = parseIsoDate(text);
  const bad = text !== '' && (!parsed || outOfRange(parsed));

  const type = (raw: string) => {
    const next = maskIsoDate(raw);
    setText(next);
    const d = parseIsoDate(next);
    if (next === '') onChange('');
    else if (d && !outOfRange(d)) onChange(next);
  };

  const toggle = () => {
    if (!open && wrapRef.current) setAlignEnd(wrapRef.current.getBoundingClientRect().left + POP_WIDTH > window.innerWidth - 12);
    setOpen((v) => !v);
  };
  const close = (refocus: boolean) => { setOpen(false); if (refocus) inputRef.current?.focus(); };
  const pick = (d: Date) => { const iso = toIsoDate(d); setText(iso); onChange(iso); close(true); };

  return (
    <div ref={wrapRef} className={cx(styles.dateField, className)} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); close(true); } }}>
      <input
        ref={inputRef}
        id={inputId}
        className={styles.input}
        value={text}
        onChange={(e) => type(e.target.value)}
        onBlur={() => { if (bad) setText(value); }}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); toggle(); } }}
        placeholder="YYYY-MM-DD"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        disabled={disabled}
        aria-invalid={invalid || bad || undefined}
        {...aria}
      />
      <button type="button" className={styles.dateBtn} onClick={toggle} disabled={disabled} aria-label={t('달력 열기', 'Open calendar')} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popId : undefined}>
        <Icon name="calendar" size={17} />
      </button>
      {open ? (
        <Calendar id={popId} selected={parsed && !outOfRange(parsed) ? parsed : null} isDisabled={outOfRange} alignEnd={alignEnd} onPick={pick}
          onClear={() => { setText(''); onChange(''); close(true); }} />
      ) : null}
    </div>
  );
}

function Calendar({ id, selected, isDisabled, alignEnd, onPick, onClear }: { id: string; selected: Date | null; isDisabled: (d: Date) => boolean; alignEnd: boolean; onPick: (d: Date) => void; onClear: () => void }) {
  const lang = useUiLang();
  const t = useT();
  const locale = lang === 'en' ? 'en-US' : 'ko-KR';
  const today = useMemo(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }, []);
  const [focus, setFocus] = useState<Date>(selected ?? today);
  const gridRef = useRef<HTMLTableElement>(null);
  const moved = useRef(false);

  const fmt = useMemo(() => ({
    title: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }),
    full: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: lang === 'en' ? 'short' : 'narrow' }),
  }), [locale, lang]);
  // 2023-01-01 was a Sunday.
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => fmt.weekday.format(new Date(2023, 0, 1 + i))), [fmt]);
  const days = monthGrid(focus.getFullYear(), focus.getMonth());

  useEffect(() => {
    // Focus the active day on open and whenever it moves by keyboard or the month buttons.
    gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus({ preventScroll: !moved.current });
    moved.current = true;
  }, [focus]);

  const onKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const step: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focus, -1), ArrowRight: () => addDays(focus, 1), ArrowUp: () => addDays(focus, -7), ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1), PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
      Home: () => addDays(focus, -focus.getDay()), End: () => addDays(focus, 6 - focus.getDay()),
    };
    const next = step[e.key];
    if (next) { e.preventDefault(); setFocus(next()); }
  };

  return (
    <div id={id} className={cx(styles.datePop, alignEnd && styles.datePopEnd)} role="dialog" aria-modal="false" aria-label={t('날짜 선택', 'Choose a date')}>
      <div className={styles.calHead}>
        <button type="button" className={styles.calNav} onClick={() => setFocus(addMonths(focus, -1))} aria-label={t('이전 달', 'Previous month')}><Icon name="chevron-left" size={16} /></button>
        <b aria-live="polite">{fmt.title.format(focus)}</b>
        <button type="button" className={styles.calNav} onClick={() => setFocus(addMonths(focus, 1))} aria-label={t('다음 달', 'Next month')}><Icon name="chevron-right" size={16} /></button>
      </div>
      <table ref={gridRef} className={styles.calGrid} onKeyDown={onKey}>
        <thead><tr>{weekdays.map((w, i) => <th key={i} scope="col">{w}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: 6 }, (_, row) => (
            <tr key={row}>
              {days.slice(row * 7, row * 7 + 7).map((d) => {
                const isFocus = sameDay(d, focus);
                return (
                  <td key={d.getTime()}>
                    <button type="button" className={styles.calDay} tabIndex={isFocus ? 0 : -1} disabled={isDisabled(d)}
                      data-outside={d.getMonth() !== focus.getMonth() || undefined} aria-pressed={sameDay(d, selected)} aria-current={sameDay(d, today) ? 'date' : undefined}
                      aria-label={fmt.full.format(d)} onClick={() => onPick(d)}>
                      {d.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.calFoot}>
        <button type="button" className={cx(styles.btn, styles.btnXs, styles.btnGhost)} onClick={onClear}>{t('지우기', 'Clear')}</button>
        <button type="button" className={cx(styles.btn, styles.btnXs)} onClick={() => (isDisabled(today) ? setFocus(today) : onPick(today))}>{t('오늘', 'Today')}</button>
      </div>
    </div>
  );
}
