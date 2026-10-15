import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminLearningApi } from '../../../../shared/api/endpoints/admin-learning';
import { adminStudiesParityApi } from '../../../../shared/api/endpoints/admin-studies-parity';
import { ASelect, FilterField } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { MONTH_OPTIONS, thisYear, type TermForm } from '../learning/learningShared';
import { CompanyPicker } from './studies-pickers';

/**
 * study.php 검색 구분 block, wired like the PHP page:
 *  - 기간 검색(A): 연도 / 월 → 수강 기간 select (study_lectureterme.php). Picking a period loads the 사업주 select of companies that have
 *    enrollments in that period (study_lectureterme_company.php) and runs the search at once (onchange="LectureCompanySearch();StudySearch(1)").
 *    Picking a company runs the search too.
 *  - 사업주 검색(B): 사업주명 autocomplete (study_company_search_autocomplete.php); after a pick, 연도 / 월 → 수강 기간 of that company
 *    (study_company_lectureterme.php), whose change also runs the search.
 */
export function StudyTermFields({ value, onChange, onAutoSubmit, years: yearList, idPrefix = 'sm' }: { value: TermForm; onChange: (v: TermForm) => void; onAutoSubmit: (v: TermForm) => void; years?: number[]; idPrefix?: string }) {
  const years = useMemo(() => (yearList?.length ? yearList : [Number(thisYear())]).slice().reverse().map((y) => ({ value: String(y), label: tr(`${y}년`, String(y)) })), [yearList]);
  const isB = value.searchGubun === 'B';
  const termsEnabled = !!value.year && (!isB || !!value.companyCode);
  const terms = useQuery({ queryKey: ['admin', 'learning', 'terms', value.year, value.month, isB ? value.companyCode : ''], queryFn: ({ signal }) => adminLearningApi.terms({ year: value.year, month: value.month ? Number(value.month) : undefined, companyCode: isB ? value.companyCode : undefined }, signal), enabled: termsEnabled, staleTime: 60_000 });
  const periodOptions = useMemo(() => [{ value: '', label: tr('-- 기간 선택 --', '-- period --') }, ...(terms.data?.items ?? []).map((t) => ({ value: t.label, label: t.label })), ...(value.period && !(terms.data?.items ?? []).some((t) => t.label === value.period) ? [{ value: value.period, label: value.period }] : [])], [terms.data, value.period]);
  const [ls = '', le = ''] = value.period ? value.period.split('~') : [];
  const companies = useQuery({ queryKey: ['admin', 'studies', 'period-companies', ls, le], queryFn: ({ signal }) => adminStudiesParityApi.periodCompanies(ls, le, signal), enabled: !isB && !!ls && !!le, staleTime: 60_000 });
  const companyOptions = useMemo(() => {
    const items = companies.data?.items ?? [];
    const keep = value.companyCode && !items.some((c) => c.companyCode === value.companyCode) ? [{ value: value.companyCode, label: value.companyName ? `${value.companyName} | ${value.companyCode}` : value.companyCode }] : [];
    return [{ value: '', label: tr('-- 사업주 선택 --', '-- company --') }, ...items.map((c) => ({ value: c.companyCode, label: c.label })), ...keep];
  }, [companies.data, value.companyCode, value.companyName]);
  const set = (patch: Partial<TermForm>) => onChange({ ...value, ...patch });
  const setAndSearch = (patch: Partial<TermForm>) => { const next = { ...value, ...patch }; onChange(next); onAutoSubmit(next); };
  const yearMonth = (
    <>
      <FilterField label={tr('연도', 'Year')} htmlFor={`${idPrefix}-year`} width={110}><ASelect id={`${idPrefix}-year`} value={value.year} onChange={(e) => set({ year: e.target.value, period: '', ...(isB ? {} : { companyCode: '', companyName: '' }) })} options={years} /></FilterField>
      <FilterField label={tr('월', 'Month')} htmlFor={`${idPrefix}-month`} width={100}><ASelect id={`${idPrefix}-month`} value={value.month} onChange={(e) => set({ month: e.target.value, period: '', ...(isB ? {} : { companyCode: '', companyName: '' }) })} options={MONTH_OPTIONS} /></FilterField>
      <FilterField label={tr('수강 기간', 'Term')} htmlFor={`${idPrefix}-period`} width={240}>
        <ASelect id={`${idPrefix}-period`} value={value.period} options={periodOptions} loading={terms.isFetching} disabled={!termsEnabled}
          onChange={(e) => setAndSearch(isB ? { period: e.target.value } : { period: e.target.value, companyCode: '', companyName: '' })} />
      </FilterField>
    </>
  );
  return (
    <>
      <FilterField label={tr('검색 구분', 'Search by')} htmlFor={`${idPrefix}-gubun`} width={150}>
        <ASelect id={`${idPrefix}-gubun`} value={value.searchGubun} onChange={(e) => set({ searchGubun: e.target.value, period: '', companyCode: '', companyName: '' })} options={[{ value: 'A', label: tr('기간 검색', 'By period') }, { value: 'B', label: tr('사업주 검색', 'By company') }]} />
      </FilterField>
      {!isB ? (
        <>
          {yearMonth}
          <FilterField label={tr('사업주', 'Company')} htmlFor={`${idPrefix}-co`} width={280}>
            {value.period
              ? <ASelect id={`${idPrefix}-co`} value={value.companyCode} options={companyOptions} loading={companies.isFetching}
                  onChange={(e) => { const c = companies.data?.items.find((x) => x.companyCode === e.target.value); setAndSearch({ companyCode: e.target.value, companyName: c?.companyName ?? '' }); }} />
              : <span id={`${idPrefix}-co`} className="muted" style={{ display: 'inline-block', padding: '6px 0', fontWeight: 700 }}>{tr('기간을 선택하세요.', 'Choose a term first.')}</span>}
          </FilterField>
        </>
      ) : (
        <>
          <FilterField label={tr('사업주명', 'Company name')} htmlFor={`${idPrefix}-coname`} width={300}>
            <CompanyPicker id={`${idPrefix}-coname`} name={value.companyName} code={value.companyCode} placeholder={tr('사업주명 입력', 'Company name')} onPick={(v) => set({ companyName: v.name, companyCode: v.code, period: '' })} />
          </FilterField>
          {value.companyCode ? yearMonth : null}
        </>
      )}
    </>
  );
}
