import type { ReactNode } from 'react';
import styles from './Manager.module.css';
import { StateBlock } from '../../shared/ui/StateBlock';
import { ASelect, Bar } from '../../shared/ui/admin';
import { isAppError } from '../../shared/api/client';
import { mgr } from './strings';

/** AR-21 states: 배정 운영건 없음 (403 NO_COMPANY) / 권한 없음 (403) / 조회 실패 (never shown as 0 or "no records"). */
export function ManagerError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const reason = isAppError(error) ? (error.details as { reason?: string } | undefined)?.reason : undefined;
  if (isAppError(error) && error.status === 403 && reason === 'NO_COMPANY') return <StateBlock code="NO_ACCESS" center title={mgr.states.noCompany.title} body={mgr.states.noCompany.body} hideActions />;
  if (isAppError(error) && error.status === 403) return <StateBlock code="NO_ACCESS" center title={mgr.states.forbidden.title} body={error.message || mgr.states.forbidden.body} hideActions />;
  return <StateBlock code="LIST_ERROR" center title={mgr.states.error.title} body={mgr.states.error.body} onRetry={onRetry} />;
}

/** 년도 select (tab-manager-trainee.php / complete / payment). `allLabel` adds the "년도 선택" (= no year) option. */
export function YearSelect({ id, value, options, onChange, allLabel }: { id: string; value: string; options: number[]; onChange: (v: string) => void; allLabel?: string }) {
  const opts = options.map((y) => ({ value: String(y), label: mgr.year.option(y) }));
  return <ASelect id={id} aria-label={mgr.year.label} style={{ width: 140 }} value={value} onChange={(e) => onChange(e.target.value)} options={allLabel ? [{ value: '', label: allLabel }, ...opts] : opts} />;
}

/** Page buttons; `block` = 5-page window with 이전/다음 (자부담금), otherwise every page (수강생 관리). */
export function Pager({ page, totalPages, onChange, block }: { page: number; totalPages: number; onChange: (p: number) => void; block?: number }) {
  if (totalPages <= 1 && !block) return null;
  if (totalPages < 1) return null;
  let start = 1; let end = totalPages;
  if (block) { start = Math.floor((page - 1) / block) * block + 1; end = Math.min(start + block - 1, totalPages); }
  const pages: number[] = []; for (let p = start; p <= end; p++) pages.push(p);
  return (
    <nav className={styles.pager} aria-label="페이지">
      {block && page > 1 ? <button type="button" onClick={() => onChange(page - 1)}>{mgr.payments.prev}</button> : null}
      {pages.map((p) => <button key={p} type="button" aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>{p}</button>)}
      {block && page < totalPages ? <button type="button" onClick={() => onChange(page + 1)}>{mgr.payments.next}</button> : null}
    </nav>
  );
}

/** One labelled bar per value (single series — the panel title names it; every value is also printed as text). */
export function BarList({ items, max, unit, tone }: { items: { label: string; value: number; tone?: 'warn' | 'ok' }[]; max: number; unit: string; tone?: 'warn' | 'ok' }) {
  const top = Math.max(max, 0.0001);
  return (
    <ul className={styles.bars}>
      {items.map((it) => (
        <li key={it.label} title={`${it.label}: ${it.value}${unit}`}>
          <span>{it.label}</span>
          <Bar value={(it.value / top) * 100} tone={it.tone ?? tone} />
          <b>{it.value.toLocaleString('ko-KR')}{unit}</b>
        </li>
      ))}
    </ul>
  );
}

export function Panel({ title, children, note }: { title: ReactNode; children: ReactNode; note?: ReactNode }) {
  return <section className={styles.panel}><h2>{title}</h2>{children}{note ? <p className={styles.note}>{note}</p> : null}</section>;
}

export const won = (n: number) => mgr.common.won(n);
