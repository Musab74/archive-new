import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, type SatisfactionRow } from '../../../../shared/api/endpoints/admin-content-archive';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, AInput, ASelect, DataTable, DateField, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { GrantGate } from '../../GrantGate';
import { ExportButton, RangeSummary, SIZE, noOf, useResolvedRangeInForm } from './shared';

const DEFAULTS = { from: '', to: '', col: 'aValue', q: '', page: 1 };

/** satisfaction_manager.php (+ _lib / _excel) — 만족도조사, grant D5. 사후(A)·1단계·일반(A) 문항의 답변만. */
export default function SatisfactionPage() {
  return <GrantGate grant="D5"><Satisfaction /></GrantGate>;
}

function Satisfaction() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ from: p.from, to: p.to, col: p.col, q: p.q });
  const query = useMemo(() => ({ from: p.from || undefined, to: p.to || undefined, col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'satisfaction-results', query], queryFn: ({ signal }) => apiX.satisfactionResults(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  useResolvedRangeInForm(list.data?.range, p, form, setForm, list.isPlaceholderData);
  const columns: Column<SatisfactionRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => noOf(total, p.page, SIZE, i) },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <b>{r.id}</b> },
    { key: 'name', header: tr('이름', 'Name'), nowrap: true, render: (r) => r.name ?? '' },
    { key: 'aOrder', header: tr('순서', 'Order'), align: 'right', width: 60, render: (r) => r.aOrder ?? '' },
    { key: 'question', header: tr('문항', 'Question'), render: (r) => r.question ?? '' },
    { key: 'stars', header: tr('만족도', 'Satisfaction'), nowrap: true, align: 'center', render: (r) => <span title={`${r.score}/5`} style={{ color: 'var(--c-warn, #d97706)', letterSpacing: 1 }}>{r.stars}</span> },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
  ];
  return (
    <AdminPage title={tr('만족도조사', 'Satisfaction surveys')} lead={tr('사후 1단계(만족도) 문항에 대한 답변입니다. 등록일 기준 기본 오늘, 최대 1개월까지 조회합니다. 만족도는 저장된 선택값(1~5)을 ★로 표시합니다.', 'Answers to the post-course satisfaction questions. Default today, up to 30 days. Stars show the stored 1–5 value.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ from: '', to: '', col: 'aValue', q: '' }); reset(); }}
        extra={<ExportButton disabled={!list.data || total === 0} run={() => apiX.downloadSatisfactionCsv({ from: query.from, to: query.to, col: query.col, q: query.q })} />}>
        <FilterField label={tr('등록일 시작', 'From')} htmlFor="sf-from" width={160}><DateField id="sf-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} /></FilterField>
        <FilterField label={tr('등록일 종료', 'To')} htmlFor="sf-to" width={160}><DateField id="sf-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} /></FilterField>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="sf-col" width={130}><ASelect id="sf-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'aValue', label: tr('문항명', 'Question') }, { value: 'ID', label: tr('아이디', 'User ID') }, { value: 'Name', label: tr('이름', 'Name') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="sf-q" width={260}><AInput id="sf-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder={tr('선택 입력 (미입력 시 기간만 조회)', 'Optional (date range only when empty)')} /></FilterField>
      </FilterBar>
      <RangeSummary total={total} range={list.data?.range} />
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('해당 기간에 등록된 만족도 조사 결과가 없습니다.', 'No satisfaction results in this period.')} dense />
    </AdminPage>
  );
}
