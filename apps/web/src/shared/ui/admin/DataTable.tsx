import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './admin.module.css';
import { cx } from '../../utils/format';
import { isAppError } from '../../api/client';
import { nextSort, pageCount, pageSlice, pageWindow, sortRows, type SortState } from './tableSort';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer; defaults to String(row[key]). */
  render?: (row: T, index: number) => ReactNode;
  /** Value used for client-side sorting (defaults to row[key]). */
  sortValue?: (row: T) => unknown;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  nowrap?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: readonly T[] | undefined;
  rowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
  /** Sorting: controlled (server) when `onSortChange` is given, otherwise client-side on the visible rows. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Pagination: server-side when `onPageChange` is given (rows are the current page), client-side when only `size` is set. */
  page?: number;
  size?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
  dense?: boolean;
  caption?: string;
  footer?: ReactNode;
  className?: string;
  /** Skeleton rows while loading without data. */
  skeletonRows?: number;
}

/**
 * Admin data table: sortable headers (aria-sort), server or client pagination, keyboard-focusable clickable rows,
 * loading / error / empty states inside the table frame.
 */
export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, emptyTitle = '표시할 항목이 없습니다.', emptyBody, sort, onSortChange, page, size, total, onPageChange, onRowClick, selectedKey, dense, caption, footer, className, skeletonRows = 5 }: DataTableProps<T>) {
  const [localSort, setLocalSort] = useState<SortState | null>(null);
  const [localPage, setLocalPage] = useState(1);
  const controlledSort = onSortChange !== undefined;
  const activeSort = controlledSort ? (sort ?? null) : localSort;
  const serverPaged = onPageChange !== undefined;
  const currentPage = serverPaged ? (page ?? 1) : localPage;

  const sorted = useMemo(() => {
    if (!rows) return [];
    if (controlledSort || !activeSort) return [...rows];
    const col = columns.find((c) => c.key === activeSort.key);
    return sortRows(rows, activeSort, col?.sortValue ?? ((r) => (r as Record<string, unknown>)[activeSort.key]));
  }, [rows, activeSort, controlledSort, columns]);

  const visible = useMemo(() => (!serverPaged && size ? pageSlice(sorted, currentPage, size) : sorted), [sorted, serverPaged, size, currentPage]);
  const totalCount = serverPaged ? (total ?? sorted.length) : sorted.length;
  const pages = size ? pageCount(totalCount, size) : 1;
  const showPager = !!size && pages > 1;

  const setSort = (key: string) => {
    const next = nextSort(activeSort, key);
    if (controlledSort) onSortChange?.(next); else { setLocalSort(next); setLocalPage(1); }
  };
  const goPage = (p: number) => { const clamped = Math.min(pages, Math.max(1, p)); if (serverPaged) onPageChange?.(clamped); else setLocalPage(clamped); };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
  };

  const colCount = columns.length;
  const errMessage = error ? (isAppError(error) ? error.message : '목록을 불러오지 못했습니다.') : null;
  const isEmpty = !loading && !error && rows && rows.length === 0;

  return (
    <div className={cx(styles.tableWrap, className)} aria-busy={loading || undefined}>
      <table className={cx(styles.table, dense && styles.dense, onRowClick && styles.clickable)}>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => {
              const sortedBy = activeSort?.key === c.key;
              const ariaSort = sortedBy ? (activeSort!.dir === 'asc' ? 'ascending' : 'descending') : undefined;
              return (
                <th key={c.key} scope="col" aria-sort={c.sortable ? (ariaSort ?? 'none') : undefined} style={{ width: c.width }} className={cx(c.align === 'right' && styles.num, c.align === 'center' && styles.center)}>
                  {c.sortable ? (
                    <button type="button" className={styles.sortBtn} aria-pressed={sortedBy} onClick={() => setSort(c.key)}>
                      {c.header}
                      <span className={styles.sortMark} aria-hidden="true">{sortedBy ? (activeSort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading && !rows ? Array.from({ length: skeletonRows }).map((_, i) => (
            <tr key={`sk${i}`} className={styles.skeletonRow} aria-hidden="true">{columns.map((c) => <td key={c.key}><span className={styles.skeletonBar} style={{ width: `${40 + ((i * 17 + c.key.length * 7) % 50)}%` }} /></td>)}</tr>
          )) : null}
          {errMessage ? (
            <tr><td colSpan={colCount}><div className={styles.tableState} role="alert"><b>목록 조회 실패</b>{errMessage}{onRetry ? <div className="u-mt-8"><button type="button" className={cx(styles.btn, styles.btnSm)} onClick={onRetry}>다시 불러오기</button></div> : null}</div></td></tr>
          ) : null}
          {isEmpty ? (
            <tr><td colSpan={colCount}><div className={styles.tableState}><b>{emptyTitle}</b>{emptyBody ?? '조건을 바꾸거나 잠시 후 다시 확인해 주세요.'}</div></td></tr>
          ) : null}
          {!errMessage && visible.map((row, i) => {
            const key = rowKey(row, i);
            const selected = selectedKey !== undefined && selectedKey !== null && key === selectedKey;
            return (
              <tr key={key} className={cx(selected && styles.selected)} tabIndex={onRowClick ? 0 : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined} onKeyDown={(e) => onRowKey(e, row)} aria-selected={selected || undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={cx(c.align === 'right' && styles.num, c.align === 'center' && styles.center, c.nowrap && styles.nowrap, c.className)}>
                    {c.render ? c.render(row, i) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {(showPager || footer || (rows && rows.length > 0 && size)) ? (
        <div className={styles.tableFoot}>
          <span>{footer ?? (size ? `총 ${totalCount.toLocaleString('ko-KR')}건 · ${currentPage}/${pages} 페이지` : null)}</span>
          {showPager ? (
            <nav className={styles.pager} aria-label="페이지">
              <button type="button" onClick={() => goPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="이전">‹</button>
              {pageWindow(currentPage, pages).map((p, i) => p === '…' ? <span key={`e${i}`} aria-hidden="true">…</span> : <button key={p} type="button" aria-current={p === currentPage ? 'page' : undefined} onClick={() => goPage(p)}>{p}</button>)}
              <button type="button" onClick={() => goPage(currentPage + 1)} disabled={currentPage >= pages} aria-label="다음">›</button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
