import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminStudiesParityApi } from '../../../../shared/api/endpoints/admin-studies-parity';
import { AInput } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';

/** Pickers shared by 학습관리 (study.php) and 일자별 학습시간 관리 (study_time.php). */

const listStyle = { position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', margin: 0, padding: 4, listStyle: 'none', background: 'var(--c-paper, #fff)', border: '1px solid var(--c-line, #ddd)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 280, overflow: 'auto' } as const;
const optionStyle = { display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 0, cursor: 'pointer', font: 'inherit' } as const;

/** study_company_search_autocomplete.php: the search term inside the name in red bold (<font color='#db2400'><B>). */
export function highlightMatch(text: string, term: string): ReactNode {
  if (!term) return text;
  const parts = text.split(term);
  if (parts.length === 1) return text;
  const out: ReactNode[] = [];
  parts.forEach((p, i) => { out.push(p); if (i < parts.length - 1) out.push(<b key={i} style={{ color: '#db2400' }}>{term}</b>); });
  return out;
}

/**
 * study_company_search_autocomplete.php — "n. 사업주명(검색어 빨간 굵게)  사업자번호" rows, '검색 결과가 없습니다.', a close button.
 * Typing clears the code; picking sets both (the PHP fills CompanyName + hidden CompanyCode).
 */
export function CompanyPicker({ id, name, code, onPick, placeholder }: { id: string; name: string; code: string; onPick: (v: { name: string; code: string }) => void; placeholder?: string }) {
  const [q, setQ] = useState(name); const [open, setOpen] = useState(false); const [debounced, setDebounced] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setQ(name); }, [name]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const sug = useQuery({ queryKey: ['admin', 'studies', 'companies', debounced], queryFn: ({ signal }) => adminStudiesParityApi.companies(debounced, signal), enabled: open && debounced.length > 0 && !(code && debounced === name), staleTime: 60_000 });
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <AInput id={id} value={q} autoComplete="off" placeholder={placeholder ?? tr('사업주명 검색 후 선택', 'Search and pick a company')} title={code ? `${tr('사업주 코드', 'Company code')}: ${code}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); onPick({ name: e.target.value, code: '' }); }} onFocus={() => setOpen(true)} />
      {open && debounced && sug.data ? (
        <div style={listStyle}>
          <ul role="listbox" aria-label={tr('사업주 검색 결과', 'Company results')} style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {sug.data.items.length ? sug.data.items.map((c, i) => (
              <li key={c.companyCode}><button type="button" role="option" aria-selected={c.companyCode === code} style={optionStyle} onClick={() => { onPick({ name: c.companyName ?? c.companyCode, code: c.companyCode }); setQ(c.companyName ?? c.companyCode); setOpen(false); }}>{i + 1}. {highlightMatch(c.companyName ?? '', debounced)}&nbsp;&nbsp;<span className="muted mono" style={{ fontSize: 12 }}>{c.companyCode}</span></button></li>
            )) : <li className="muted" style={{ padding: '6px 8px' }}>{tr('검색 결과가 없습니다.', 'No match.')}</li>}
          </ul>
          {sug.data.truncated ? <p className="muted" style={{ fontSize: 12, margin: '4px 8px' }}>{tr(`검색 결과가 많아 처음 ${(sug.data.cap ?? sug.data.items.length).toLocaleString('ko-KR')}건만 표시합니다. 사업주명을 더 입력하세요.`, `Only the first ${sug.data.cap ?? sug.data.items.length} are shown; type more.`)}</p> : null}
          <div style={{ textAlign: 'right', padding: '4px 4px 0' }}><button type="button" onClick={() => setOpen(false)} style={{ ...optionStyle, display: 'inline-block', width: 'auto', fontSize: 12, border: '1px solid var(--c-line, #ddd)', borderRadius: 6, padding: '2px 10px' }}>{tr('닫기', 'Close')}</button></div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * study.php "$('#LectureCode').select2()": a type-to-filter dropdown over a long option list. Substring match on the label
 * (e.g. "과정명 | 코드"); Enter picks the first match, Escape closes.
 */
export function SearchableSelect({ id, value, options, onChange, placeholder, loading }: { id: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder?: string; loading?: boolean }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  useEffect(() => { const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ(''); } }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const filtered = useMemo(() => { const t = q.trim().toLowerCase(); return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options; }, [options, q]);
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <AInput id={id} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
        value={open ? q : selected?.label ?? ''} placeholder={loading ? tr('불러오는 중…', 'Loading…') : selected?.label ?? placeholder ?? ''}
        onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setQ(''); } if (e.key === 'Enter' && open) { e.preventDefault(); if (filtered[0]) pick(filtered[0].value); } }} />
      {open ? (
        <ul id={listId} role="listbox" style={listStyle}>
          {filtered.length ? filtered.slice(0, 500).map((o) => (
            <li key={o.value || '__all'}><button type="button" role="option" aria-selected={o.value === value} style={{ ...optionStyle, fontWeight: o.value === value ? 700 : 400 }} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.value)}>{q ? highlightMatch(o.label, q.trim()) : o.label}</button></li>
          )) : <li className="muted" style={{ padding: '6px 8px' }}>{tr('일치하는 항목이 없습니다.', 'No match.')}</li>}
        </ul>
      ) : null}
    </div>
  );
}
