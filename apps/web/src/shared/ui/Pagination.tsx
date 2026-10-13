import styles from './Pagination.module.css';
import { common } from '../strings/ko';
import { Icon } from './Icon';

export interface PaginationProps { page: number; total: number; size: number; onChange: (page: number) => void; label?: string; siblings?: number }

export function pageRange(page: number, pages: number, siblings = 1): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const start = Math.max(2, page - siblings);
  const end = Math.min(pages - 1, page + siblings);
  const out: (number | '…')[] = [1];
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push('…');
  out.push(pages);
  return out;
}

/** Page buttons (storyboard `.page-btn`); hidden when there is a single page. */
export function Pagination({ page, total, size, onChange, label = common.page, siblings = 1 }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, size)));
  if (pages <= 1) return null;
  return (
    <nav className={styles.nav} aria-label={label}>
      <button type="button" className={styles.btn} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={common.prev}><Icon name="chevron-right" size={16} style={{ transform: 'rotate(180deg)' }} /></button>
      {pageRange(page, pages, siblings).map((p, i) => p === '…' ? <span key={`e${i}`} className={styles.ellipsis} aria-hidden="true">…</span> : (
        <button key={p} type="button" className={styles.btn} aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>{p}</button>
      ))}
      <button type="button" className={styles.btn} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={common.next}><Icon name="chevron-right" size={16} /></button>
    </nav>
  );
}
