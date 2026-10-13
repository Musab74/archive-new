export type SortDir = 'asc' | 'desc';
export interface SortState { key: string; dir: SortDir }

/** Click cycle: none → asc → desc → none (returns null to clear). */
export function nextSort(current: SortState | null | undefined, key: string): SortState | null {
  if (!current || current.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return null;
}

type Getter<T> = (row: T) => unknown;

function compare(a: unknown, b: unknown): number {
  const an = a === null || a === undefined || a === '';
  const bn = b === null || b === undefined || b === '';
  if (an && bn) return 0;
  if (an) return 1; // empties last
  if (bn) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  const as = String(a); const bs = String(b);
  const anum = Number(as); const bnum = Number(bs);
  if (!Number.isNaN(anum) && !Number.isNaN(bnum) && as.trim() !== '' && bs.trim() !== '') return anum - bnum;
  return as.localeCompare(bs, 'ko');
}

/** Stable client-side sort; `getter` resolves the comparable value (default: row[key]). Empty values sort last in both directions. */
export function sortRows<T>(rows: readonly T[], sort: SortState | null | undefined, getter?: Getter<T>): T[] {
  if (!sort) return [...rows];
  const get = getter ?? ((r: T) => (r as Record<string, unknown>)[sort.key]);
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => {
      const c = compare(get(x.row), get(y.row));
      if (c === 0) return x.i - y.i;
      const emptyX = get(x.row) === null || get(x.row) === undefined || get(x.row) === '';
      const emptyY = get(y.row) === null || get(y.row) === undefined || get(y.row) === '';
      if (emptyX || emptyY) return c; // keep empties last regardless of direction
      return sort.dir === 'asc' ? c : -c;
    })
    .map((x) => x.row);
}

/** Page window for client-side pagination (1-based page). */
export function pageSlice<T>(rows: readonly T[], page: number, size: number): T[] {
  const p = Math.max(1, page);
  const s = Math.max(1, size);
  return rows.slice((p - 1) * s, p * s);
}

export function pageCount(total: number, size: number): number { return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, size))); }

/** Compact page button list: 1 … p-1 p p+1 … n. */
export function pageWindow(page: number, pages: number, siblings = 1): (number | '…')[] {
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
