import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi } from '../../../../shared/api/endpoints/admin-learning';
import { AInput, ASelect } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';

/**
 * Type-to-search single select (the PHP pages used select2 for the long 과정명 lists). Options keep the PHP label
 * ("ContentsName | LectureCode"); typing filters by substring, ↑/↓ moves, Enter picks, Esc closes.
 */
export function SearchableSelect({ id, value, options, onChange, placeholder, loading, 'aria-label': ariaLabel }: { id?: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder?: string; loading?: boolean; 'aria-label'?: string }) {
  const auto = useId(); const listId = `${id ?? auto}-list`;
  const current = options.find((o) => o.value === value);
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const filtered = useMemo(() => { const t = q.trim().toLowerCase(); return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options; }, [q, options]);
  useEffect(() => { setHi(0); }, [q]);
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(filtered.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { if (open && filtered[hi]) { e.preventDefault(); pick(filtered[hi]!.value); } }
    else if (e.key === 'Escape') setOpen(false);
  };
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <AInput id={id} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-label={ariaLabel} autoComplete="off"
        value={open ? q : current?.label ?? ''} placeholder={loading ? tr('불러오는 중…', 'Loading…') : current?.label ?? placeholder ?? tr('검색하여 선택', 'Type to search')}
        onFocus={() => { setOpen(true); setQ(''); }} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={onKey} />
      {open ? (
        <ul id={listId} role="listbox" style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%', margin: 0, padding: 4, listStyle: 'none', background: 'var(--c-paper, #fff)', border: '1px solid var(--c-line, #ddd)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 300, overflow: 'auto' }}>
          {filtered.length ? filtered.slice(0, 500).map((o, i) => (
            <li key={o.value || '__all'} role="option" aria-selected={o.value === value} onMouseDown={(e) => { e.preventDefault(); pick(o.value); }} onMouseEnter={() => setHi(i)}
              style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 6, background: i === hi ? 'var(--c-soft, #f2f4f7)' : undefined, fontWeight: o.value === value ? 600 : undefined }}>{o.label}</li>
          )) : <li className="muted" style={{ padding: '6px 8px' }}>{tr('검색 결과가 없습니다.', 'No match.')}</li>}
        </ul>
      ) : null}
    </div>
  );
}

/** Wraps the matched part of `text` in red bold (study_company_search_autocomplete.php highlight). */
export function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  const t = q.trim();
  if (!t) return text;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<b style={{ color: 'var(--c-danger, #c00)' }}>{text.slice(i, i + t.length)}</b>{text.slice(i + t.length)}</>;
}

/**
 * 기간 검색 사업주 select (study_lectureterme_company.php): companies with Study rows for the chosen period, "회사명 | 코드",
 * 영업 sub-tree scoped by the API. Before a period is chosen it shows "기간을 선택하세요.".
 */
export function TermCompanySelect({ id, lectureStart, lectureEnd, value, onChange }: { id?: string; lectureStart: string; lectureEnd: string; value: string; onChange: (v: { code: string; name: string }) => void }) {
  const enabled = !!(lectureStart && lectureEnd);
  const q = useQuery({ queryKey: ['admin', 'learning', 'term-companies', lectureStart, lectureEnd], queryFn: ({ signal }) => adminLearningApi.termCompanies(lectureStart, lectureEnd, signal), enabled, staleTime: 60_000 });
  const items = q.data?.items ?? [];
  const options = enabled ? [{ value: '', label: tr('-- 사업주 선택 --', '-- company --') }, ...items.map((c) => ({ value: c.companyCode, label: c.label })), ...(value && !items.some((c) => c.companyCode === value) ? [{ value, label: value }] : [])] : [{ value: '', label: tr('기간을 선택하세요.', 'Choose a period first.') }];
  return <ASelect id={id} value={enabled ? value : ''} disabled={!enabled} loading={q.isFetching} options={options} onChange={(e) => { const c = items.find((x) => x.companyCode === e.target.value); onChange({ code: e.target.value, name: c?.companyName ?? '' }); }} />;
}
