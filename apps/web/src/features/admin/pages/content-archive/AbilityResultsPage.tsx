import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminContentArchiveApi as apiX, type AbilityResultRow } from '../../../../shared/api/endpoints/admin-content-archive';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AdminPage, AInput, ASelect, DataTable, DateField, FilterBar, FilterField, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { GrantGate } from '../../GrantGate';
import { ExportButton, RangeSummary, SIZE, noOf, useResolvedRangeInForm } from './shared';

const DEFAULTS = { from: '', to: '', col: 'aValue', q: '', page: 1 };

/** ability_manager.php (+ _lib / _excel) — 역량진단관리, grant D4. Read-only listing; 학습시간 = SUM(Progress.StudyTime) of the enrollment. */
export default function AbilityResultsPage() {
  return <GrantGate grant="D4"><AbilityResults /></GrantGate>;
}

function AbilityResults() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const [form, setForm] = useState({ from: p.from, to: p.to, col: p.col, q: p.q });
  const query = useMemo(() => ({ from: p.from || undefined, to: p.to || undefined, col: p.col, q: p.q || undefined, page: p.page, size: SIZE }), [p]);
  const list = useQuery({ queryKey: ['admin', 'ability-results', query], queryFn: ({ signal }) => apiX.abilityResults(query, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  useResolvedRangeInForm(list.data?.range, p, form, setForm, list.isPlaceholderData);
  const columns: Column<AbilityResultRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 60, render: (_r, i) => noOf(total, p.page, SIZE, i) },
    { key: 'id', header: tr('아이디', 'User ID'), nowrap: true, render: (r) => <b>{r.id}</b> },
    { key: 'name', header: tr('이름', 'Name'), nowrap: true, render: (r) => r.name ?? '' },
    { key: 'depthLabel', header: tr('단계', 'Step'), nowrap: true, align: 'center' },
    { key: 'groupLabel', header: tr('타입', 'Type'), nowrap: true, align: 'center' },
    { key: 'prepost', header: tr('사전/사후', 'Pre/post'), nowrap: true, align: 'center' },
    { key: 'studyTimeLabel', header: tr('학습시간', 'Study time'), nowrap: true, align: 'center', render: (r) => <span title={r.studySeq ? `Study.Seq ${r.studySeq}` : undefined}>{r.studyTimeLabel}</span> },
    { key: 'bindLabel', header: tr('역량', 'Competency'), nowrap: true },
    { key: 'question', header: tr('문항', 'Question'), render: (r) => r.question ?? '' },
    { key: 'selected', header: tr('선택값', 'Answer'), nowrap: true, align: 'center' },
    { key: 'regDate', header: tr('등록일', 'Registered'), nowrap: true, render: (r) => r.regDate ?? '' },
  ];
  return (
    <AdminPage title={tr('역량진단관리', 'Assessments')} lead={tr('역량진단 결과(ArchiveAbilityResult2)입니다. 등록일 기준 기본 오늘, 최대 1개월까지 조회합니다. 학습시간은 해당 수강의 저장된 학습 초 합계(Progress.StudyTime)입니다.', 'Assessment answers (ArchiveAbilityResult2). Default today, up to 30 days. Study time is the stored Progress.StudyTime sum of that enrollment.')}>
      <FilterBar onSubmit={() => setP(form, true)} onReset={() => { setForm({ from: '', to: '', col: 'aValue', q: '' }); reset(); }}
        extra={<ExportButton disabled={!list.data || total === 0} run={() => apiX.downloadAbilityCsv({ from: query.from, to: query.to, col: query.col, q: query.q })} />}>
        <FilterField label={tr('등록일 시작', 'From')} htmlFor="ar-from" width={160}><DateField id="ar-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} /></FilterField>
        <FilterField label={tr('등록일 종료', 'To')} htmlFor="ar-to" width={160}><DateField id="ar-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} /></FilterField>
        <FilterField label={tr('검색 항목', 'Search in')} htmlFor="ar-col" width={130}><ASelect id="ar-col" value={form.col} onChange={(e) => setForm({ ...form, col: e.target.value })} options={[{ value: 'aValue', label: tr('문항명', 'Question') }, { value: 'ID', label: tr('아이디', 'User ID') }, { value: 'Name', label: tr('이름', 'Name') }]} /></FilterField>
        <FilterField label={tr('검색어', 'Keyword')} htmlFor="ar-q" width={260}><AInput id="ar-q" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder={tr('선택 입력 (미입력 시 기간만 조회)', 'Optional (date range only when empty)')} /></FilterField>
      </FilterBar>
      <RangeSummary total={total} range={list.data?.range} />
      <DataTable columns={columns} rows={list.data?.items} rowKey={(r) => r.idx} loading={list.isPending || list.isFetching} error={list.error} onRetry={() => void list.refetch()} page={p.page} size={SIZE} total={total} onPageChange={(n) => setP({ page: n })} emptyTitle={tr('해당 기간에 등록된 역량진단 결과가 없습니다.', 'No assessment results in this period.')} dense />
    </AdminPage>
  );
}
