import { useState, type ReactNode } from 'react';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { AButton } from '../../../../shared/ui/admin';

/** Shared bits of the 컨텐츠관리 parity screens (course.php / contents.php / course_category.php / main_contents.php ports). */

/** course.php $MenuName per ctype. */
export const menuName = (ctype: string): string => ({ X: tr('이러닝', 'E-learning'), Y: tr('숏폼', 'Short-form'), Z: tr('마이크로닝', 'Micro-learning'), W: tr('비환급', 'Non-refundable'), R: tr('실시간 강의실', 'Live classroom') } as Record<string, string>)[ctype] ?? '';
export const useYnOptions = () => [{ value: 'Y', label: tr('사용', 'In use') }, { value: 'N', label: tr('미사용', 'Not used') }];
export const won = (n: number | null | undefined) => `${Number(n ?? 0).toLocaleString('ko-KR')} ${tr('원', 'KRW')}`;

/** API VALIDATION details ([{path, message}]) → { field: message }. */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (isAppError(err) && Array.isArray(err.details)) {
    for (const d of err.details as { path?: string | (string | number)[]; message?: string }[]) {
      const k = Array.isArray(d.path) ? d.path.join('.') : d.path;
      if (k) out[k] = d.message ?? '';
    }
  }
  return out;
}

/** onError handler for useAdminMutation: shows the API message as a toast and keeps the field errors. */
export function useFormErrors() {
  const { toast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const onError = (err: unknown) => { setErrors(fieldErrors(err)); toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); };
  return { errors, setErrors, onError };
}

/** Text with line breaks kept (PHP nl2br / raw HTML fields shown as text). */
export function Multiline({ text }: { text: string | null | undefined }) {
  if (!text) return <span className="muted">{adm.common.none}</span>;
  return <span style={{ whiteSpace: 'pre-wrap' }}>{text.replace(/<br\s*\/?>/gi, '\n')}</span>;
}

/** ▲ / ▼ buttons used by every "정렬하기" list. */
export function MoveButtons({ index, length, disabled, onMove }: { index: number; length: number; disabled?: boolean; onMove: (dir: -1 | 1) => void }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <AButton size="xs" disabled={disabled || index === 0} aria-label={tr('위로', 'Up')} onClick={(e) => { e.stopPropagation(); onMove(-1); }}>▲</AButton>
      <AButton size="xs" disabled={disabled || index === length - 1} aria-label={tr('아래로', 'Down')} onClick={(e) => { e.stopPropagation(); onMove(1); }}>▼</AButton>
    </span>
  );
}

/** Immutable swap helper. */
export function moveIn<T>(list: readonly T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const out = [...list];
  const [it] = out.splice(index, 1);
  out.splice(to, 0, it as T);
  return out;
}

/** Row of buttons below a read view (컨텐츠 삭제 · 컨텐츠 수정 · 목록), like the PHP pages. */
export function ReadButtons({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
      <div>{left}</div><div style={{ display: 'flex', gap: 8 }}>{center}</div><div>{right}</div>
    </div>
  );
}

/**
 * Parse rows pasted from Excel (tab separated, first line = header) into objects keyed by the header names with
 * whitespace removed — the same header normalisation as course_package_excel_upload.php normalizeHeader().
 */
export function parsePasted(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const sep = lines[0]!.includes('\t') ? '\t' : ',';
  const head = lines[0]!.split(sep).map((h) => h.replace(/\s+/g, ''));
  return lines.slice(1).map((l) => { const cells = l.split(sep); const o: Record<string, string> = {}; head.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); }); return o; });
}
