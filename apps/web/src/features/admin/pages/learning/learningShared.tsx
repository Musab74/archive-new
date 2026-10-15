import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi, openCertificatePdf, type CertificatePdfKind, type LearningOptions } from '../../../../shared/api/endpoints/admin-learning';
import { AInput, ASelect, FilterField } from '../../../../shared/ui/admin';
import { LEGACY_ADMIN_BASE } from '../../../../shared/auth/adminMenu';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { Highlight, TermCompanySelect } from './learningPickers';

/** Shared pieces of the 수강 관리 pages (study2 / study_end / study_ip / course_data / study_end2 filters). */

export const LEGACY_SITE_ROOT = LEGACY_ADMIN_BASE.replace(/\/hrd_manager$/, '');
type Params = Record<string, string | number | null | undefined>;
const qs = (params?: Params) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); const s = p.toString(); return s ? `?${s}` : ''; };
/** PHP page under /hrd_manager/ (still served by the previous site; needs its own login). */
export const legacyAdminHref = (file: string, params?: Params) => `${LEGACY_ADMIN_BASE}/${file}${qs(params)}`;
/** PHP page under the site root (include/…, public/mypage/…). */
export const legacySiteHref = (path: string, params?: Params) => `${LEGACY_SITE_ROOT}/${path.replace(/^\/+/, '')}${qs(params)}`;
export const openLegacy = (href: string) => { window.open(href, '_blank', 'noopener,width=1100,height=820,scrollbars=yes,resizable=yes'); };

export function useLearningOptions() {
  return useQuery({ queryKey: ['admin', 'learning', 'options'], queryFn: ({ signal }) => adminLearningApi.options(signal), staleTime: 5 * 60_000 });
}

export const YN_OPTIONS = [{ value: '', label: adm.common.all }, { value: 'Y', label: 'Y' }, { value: 'N', label: 'N' }];
export const SERVICE_TYPE_OPTIONS = [{ value: '', label: adm.common.all }, { value: 'A', label: tr('패키지(환급)', 'Package (refund)') }, { value: 'W', label: tr('비환급', 'Non-refund') }];
/** 월 select with an explicit 전체 value ('0') so the choice survives the URL state (useSearchState drops ''). */
export const MONTH_ALL = '0';
export const MONTH_OPTIONS_ALL = [{ value: MONTH_ALL, label: adm.common.all }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: tr(`${i + 1}월`, `Month ${i + 1}`) }))];
export const MONTH_OPTIONS = [{ value: '', label: adm.common.all }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: tr(`${i + 1}월`, `Month ${i + 1}`) }))];
export const thisYear = () => String(new Date().getFullYear());
export const thisMonth = () => String(new Date().getMonth() + 1).padStart(2, '0');
export const fmtDate = (v: string | null | undefined) => (v ?? '').slice(0, 10);

/** 기간 검색 / 사업주 검색 form values (TermForm → URL state via termToParams). */
export interface TermForm { searchGubun: string; year: string; month: string; period: string; companyCode: string; companyName: string }
export const TERM_DEFAULTS: TermForm = { searchGubun: 'A', year: thisYear(), month: thisMonth(), period: '', companyCode: '', companyName: '' };
export const TERM_PARAM_DEFAULTS = { searchGubun: 'A', year: thisYear(), month: thisMonth(), lectureStart: '', lectureEnd: '', companyCode: '', companyName: '' };
export function termToParams(t: TermForm) {
  const [lectureStart = '', lectureEnd = ''] = t.period ? t.period.split('~') : [];
  return { searchGubun: t.searchGubun, year: t.year, month: t.month, lectureStart, lectureEnd, companyCode: t.companyCode, companyName: t.companyName };
}
export function termFromParams(p: { searchGubun: string; year: string; month: string; lectureStart: string; lectureEnd: string; companyCode: string; companyName: string }): TermForm {
  return { searchGubun: p.searchGubun, year: p.year, month: p.month, period: p.lectureStart && p.lectureEnd ? `${p.lectureStart}~${p.lectureEnd}` : '', companyCode: p.companyCode, companyName: p.companyName };
}
/** Query values sent to the API: 사업주 검색(B) filters by company name LIKE, 기간 검색(A) by company code (the PHP pages). */
export function termQuery(p: { searchGubun: string; year: string; month: string; lectureStart: string; lectureEnd: string; companyCode: string; companyName: string }) {
  return { searchGubun: p.searchGubun, year: p.year || undefined, month: p.month && p.month !== MONTH_ALL ? Number(p.month) : undefined, lectureStart: p.lectureStart || undefined, lectureEnd: p.lectureEnd || undefined, companyCode: p.searchGubun === 'A' ? p.companyCode || undefined : undefined, companyName: p.searchGubun === 'B' ? p.companyName || undefined : undefined };
}

/**
 * 사업주명 autocomplete (study_company_search_autocomplete.php): numbered rows, typed text in red bold, company code, a close
 * button and "검색 결과가 없습니다." when nothing matches. Typing clears the code; picking sets both.
 */
export function CompanyAutocomplete({ id, name, code, onPick, placeholder, disabled }: { id?: string; name: string; code: string; onPick: (v: { name: string; code: string }) => void; placeholder?: string; disabled?: boolean }) {
  const [q, setQ] = useState(name);
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setQ(name); }, [name]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const sug = useQuery({ queryKey: ['admin', 'learning', 'companies', debounced], queryFn: ({ signal }) => adminLearningApi.companies(debounced, signal), enabled: open && debounced.length > 0 && debounced !== name, staleTime: 60_000 });
  const showList = open && !!debounced && debounced !== name && sug.isSuccess;
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <AInput id={id} value={q} placeholder={placeholder ?? tr('사업주명 입력', 'Company name')} disabled={disabled} autoComplete="off" title={code ? `${tr('사업주 코드', 'Company code')}: ${code}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); onPick({ name: e.target.value, code: '' }); }} onFocus={() => setOpen(true)} />
      {showList ? (
        <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', minWidth: 280, background: 'var(--c-paper, #fff)', border: '1px solid var(--c-line, #ddd)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
          <ul role="listbox" aria-label={tr('사업주 검색 결과', 'Company matches')} style={{ margin: 0, padding: 4, listStyle: 'none', maxHeight: 260, overflow: 'auto' }}>
            {sug.data!.items.length ? sug.data!.items.map((c, i) => (
              <li key={c.companyCode}><button type="button" role="option" aria-selected={c.companyCode === code} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => { onPick({ name: c.companyName ?? c.companyCode, code: c.companyCode }); setQ(c.companyName ?? c.companyCode); setOpen(false); }}>
                <span className="muted" style={{ display: 'inline-block', minWidth: 28 }}>{i + 1}.</span><Highlight text={c.companyName ?? ''} q={debounced} /> <span className="muted mono" style={{ fontSize: 12 }}>{c.companyCode}</span></button></li>
            )) : <li className="muted" style={{ padding: '8px' }}>{tr('검색 결과가 없습니다.', 'No results.')}</li>}
            {sug.data!.truncated ? <li className="muted" style={{ padding: '4px 8px', fontSize: 12 }}>{tr('결과가 많아 1,000건까지만 표시합니다. 이름을 더 입력하세요.', 'Showing the first 1,000; type more.')}</li> : null}
          </ul>
          <div style={{ textAlign: 'right', padding: 4, borderTop: '1px solid var(--c-line, #ddd)' }}><button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit', fontSize: 12 }}>{tr('닫기', 'Close')}</button></div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 기간 검색(연/월/기간 + 기간별 사업주 select) / 사업주 검색(사업주명 + 연/월/기간) block shared by 학습내역관리, IP모니터링, 과정 이수데이터.
 * `onCommit(next)` runs when the period, the period-company select or the 사업주 기간 changes — the PHP SubmitFunction searched at once.
 */
export function TermSearchFields({ value, onChange, options, idPrefix = 't', termOnCompanySearch = true, onCommit }: { value: TermForm; onChange: (v: TermForm) => void; options?: LearningOptions; idPrefix?: string; termOnCompanySearch?: boolean; onCommit?: (v: TermForm) => void }) {
  const years = useMemo(() => (options?.years ?? [Number(thisYear())]).slice().reverse().map((y) => ({ value: String(y), label: tr(`${y}년`, String(y)) })), [options]);
  const isB = value.searchGubun === 'B';
  const termsEnabled = !!value.year && (!isB || !!value.companyCode);
  const month = value.month && value.month !== MONTH_ALL ? Number(value.month) : undefined;
  const terms = useQuery({ queryKey: ['admin', 'learning', 'terms', value.year, month ?? '', isB ? value.companyCode : ''], queryFn: ({ signal }) => adminLearningApi.terms({ year: value.year, month, companyCode: isB ? value.companyCode : undefined }, signal), enabled: termsEnabled, staleTime: 60_000 });
  const periodOptions = useMemo(() => [{ value: '', label: tr('-- 기간 선택 --', '-- period --') }, ...(terms.data?.items ?? []).map((t) => ({ value: t.label, label: t.label })), ...(value.period && !(terms.data?.items ?? []).some((t) => t.label === value.period) ? [{ value: value.period, label: value.period }] : [])], [terms.data, value.period]);
  const set = (patch: Partial<TermForm>, commit = false) => { const next = { ...value, ...patch }; onChange(next); if (commit) onCommit?.(next); };
  const [ps = '', pe = ''] = value.period ? value.period.split('~') : [];
  return (
    <>
      <FilterField label={tr('검색 구분', 'Search by')} htmlFor={`${idPrefix}-gubun`} width={150}><ASelect id={`${idPrefix}-gubun`} value={value.searchGubun} onChange={(e) => set({ searchGubun: e.target.value, period: '', companyCode: '', companyName: '' })} options={[{ value: 'A', label: tr('기간 검색', 'By period') }, { value: 'B', label: tr('사업주 검색', 'By company') }]} /></FilterField>
      {isB ? <FilterField label={tr('사업주명', 'Company')} htmlFor={`${idPrefix}-co`} width={260}><CompanyAutocomplete id={`${idPrefix}-co`} name={value.companyName} code={value.companyCode} onPick={(v) => set({ companyName: v.name, companyCode: v.code, period: '' })} placeholder={tr('사업주명 입력', 'Company name')} /></FilterField> : null}
      {(!isB || termOnCompanySearch) ? (<>
        <FilterField label={tr('연도', 'Year')} htmlFor={`${idPrefix}-year`} width={110}><ASelect id={`${idPrefix}-year`} value={value.year} onChange={(e) => set({ year: e.target.value, period: '', companyCode: isB ? value.companyCode : '' })} options={years} /></FilterField>
        <FilterField label={tr('월', 'Month')} htmlFor={`${idPrefix}-month`} width={100}><ASelect id={`${idPrefix}-month`} value={value.month || MONTH_ALL} onChange={(e) => set({ month: e.target.value, period: '', companyCode: isB ? value.companyCode : '' })} options={MONTH_OPTIONS_ALL} /></FilterField>
        <FilterField label={tr('수강 기간', 'Term')} htmlFor={`${idPrefix}-period`} width={240}><ASelect id={`${idPrefix}-period`} value={value.period} onChange={(e) => set({ period: e.target.value, ...(isB ? {} : { companyCode: '', companyName: '' }) }, true)} options={periodOptions} loading={terms.isFetching} disabled={!termsEnabled} /></FilterField>
      </>) : null}
      {!isB ? <FilterField label={tr('사업주 선택', 'Company')} htmlFor={`${idPrefix}-co`} width={300}><TermCompanySelect id={`${idPrefix}-co`} lectureStart={ps} lectureEnd={pe} value={value.companyCode} onChange={(v) => set({ companyCode: v.code, companyName: v.name }, true)} /></FilterField> : null}
    </>
  );
}

/** function.js checks shared by study2 / study_ip / course_data: 사업주 검색 needs a name; 진도율 boxes both filled (digits) or both empty. */
export function termValidationError(t: TermForm): string | null {
  if (t.searchGubun === 'B' && !t.companyName.trim()) return tr('사업주명을 입력하세요.', 'Enter the company name.');
  return null;
}
export function progressValidationError(p1: string, p2: string): string | null {
  if (!p1 && !p2) return null;
  if (!/^\d+$/.test(p1) || !/^\d+$/.test(p2)) return tr('진도율은 숫자만 입력하세요.', 'Progress must be numbers.');
  return null;
}
export const EXPORT_CONFIRM = () => window.confirm(tr('현재 검색조건으로 검색된 결과를 엑셀로 출력하시겠습니까?', 'Export the current search result to Excel?'));
/** Opens a console page in a new tab (the PHP opened its PDFs in a popup window). */
export const openNewTab = (path: string) => { window.open(path, '_blank', 'noopener'); };

/** PDFs the PHP showed inline (FPDF Output 'I'); the others were downloads ('D'). */
const INLINE_PDF: CertificatePdfKind[] = ['seq', 'subject', 'learner'];
/**
 * Certificate PDF button state: opens the PDF built by the API (same layout as the PHP FPDF file). Inline kinds get a tab opened
 * synchronously in the click (popup blockers); API errors (e.g. "수료내역이 없습니다.") are toasted like the PHP alert.
 */
export function useCertificatePdf(): [boolean, (kind: CertificatePdfKind, query: Record<string, string | number | null | undefined>) => void] {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return [busy, (kind, query) => {
    const win = INLINE_PDF.includes(kind) ? window.open('', '_blank') : null;
    setBusy(true);
    openCertificatePdf(kind, query, win)
      .catch((err) => toast(isAppError(err) ? err.message : tr('PDF를 만들지 못했습니다.', 'Could not build the PDF.'), { tone: 'danger' }))
      .finally(() => setBusy(false));
  }];
}

/** CSV download button state + error toast. */
export function useCsvDownload(): [boolean, (run: () => Promise<void>) => Promise<void>] {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return [busy, async (run) => { setBusy(true); try { await run(); } catch (err) { toast(isAppError(err) ? err.message : tr('목록을 내려받지 못했습니다.', 'Download failed.'), { tone: 'danger' }); } finally { setBusy(false); } }];
}

export const MemberLink = ({ id, children }: { id: string; children?: ReactNode }) => <Link to={`/admin/members/${encodeURIComponent(id)}`}>{children ?? id}</Link>;
export const StudyLink = ({ seq, children }: { seq: number; children?: ReactNode }) => <Link to={`/admin/studies/${seq}`}>{children ?? seq}</Link>;
export const PendingHint = () => <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>{tr('검색 조건을 선택하세요.', 'Choose search conditions.')}</p>;
