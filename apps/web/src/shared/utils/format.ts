import { common, contentType } from '../strings/ko';

export const formatNumber = (n: number | null | undefined): string => (n ?? 0).toLocaleString('ko-KR');

/** 26 → "26분", 260 → "4시간 20분", 240 → "4시간". */
export function formatMinutes(min: number | null | undefined): string {
  const m = Math.max(0, Math.round(min ?? 0));
  if (m < 60) return `${m}${common.minutes}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}${common.hours} ${r}${common.minutes}` : `${h}${common.hours}`;
}

export const formatRating = (rating: number | null | undefined, count?: number): string =>
  rating == null || (count !== undefined && count === 0) ? common.noRating : `${rating.toFixed(1)}${count !== undefined ? ` (${formatNumber(count)})` : ''}`;

export const typeLabel = (ctype: string | null | undefined): string => (ctype ? contentType[ctype] ?? ctype : '');

/** "2026-06-12T00:00:00" → "2026.06.12" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10).replace(/-/g, '.');
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');
