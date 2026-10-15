import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminStudiesParityApi, type DailyTimeRow } from '../../../../shared/api/endpoints/admin-studies-parity';
import { useSearchState } from '../../../../shared/utils/useSearchState';
import { AButton, AInput, ASelect, Callout, ConfirmDialog, DataTable, DateField, FilterBar, FilterField, StatusBadge, toIsoDate, type Column } from '../../../../shared/ui/admin';
import { tr } from '../../../../shared/i18n/adminLang';
import { PendingHint, useCsvDownload } from '../learning/learningShared';
import { CompanyPicker } from './studies-pickers';
import { DAILY_EXCEL_CONFIRM } from './studies-shared';

/** hrd_manager study_time.php + study_time_search_result.php + study_time_search_excel.php — 일자별 학습시간 관리 (B3). */

const DEFAULTS = { from: '', to: '', companyCode: '', companyName: '', status: 'all', minSec: '0', salesKeyword: '', keyword: '', order: 'date_asc', page: 1, go: 0 };
const STATUS = [{ value: 'all', label: tr('전체', 'All') }, { value: 'ge8', label: tr('8시간 이상', '≥ 8 h') }, { value: 'over', label: tr('8시간 초과', '> 8 h') }, { value: 'cap', label: tr('8시간 도달', '= 8 h') }, { value: 'ok', label: tr('정상', 'Normal') }];
const MIN_SEC = [{ value: '0', label: tr('전체', 'All') }, { value: '3600', label: tr('1시간 이상', '≥ 1 h') }, { value: '14400', label: tr('4시간 이상', '≥ 4 h') }, { value: '21600', label: tr('6시간 이상', '≥ 6 h') }, { value: '28800', label: tr('8시간 이상', '≥ 8 h') }];
const SIZE = 30;

/** hrde_daily_study_sort_th(): click toggles asc/desc, first click direction per column. */
function SortTh({ label, col, order, prefer, onSort }: { label: ReactNode; col: string; order: string; prefer: 'asc' | 'desc'; onSort: (o: string) => void }) {
  const asc = `${col}_asc`; const desc = `${col}_desc`;
  const marker = order === asc ? ' ▲' : order === desc ? ' ▼' : '';
  const next = order === asc ? desc : order === desc ? asc : `${col}_${prefer}`;
  return <button type="button" onClick={() => onSort(next)} title={tr('클릭하여 정렬', 'Click to sort')} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 'inherit', cursor: 'pointer', color: 'inherit' }}>{label}{marker}</button>;
}

export function StudyTimePage() {
  const [p, setP, reset] = useSearchState(DEFAULTS);
  const today = toIsoDate(new Date());
  const [form, setForm] = useState({ from: p.from || today, to: p.to || today, companyCode: p.companyCode, companyName: p.companyName, status: p.status, minSec: p.minSec, salesKeyword: p.salesKeyword, keyword: p.keyword });
  const [err, setErr] = useState<string | null>(null);
  const [exporting, download] = useCsvDownload();
  const filters = useMemo(() => ({ from: p.from, to: p.to || undefined, companyCode: p.companyCode, status: p.status, minSec: p.minSec, keyword: p.keyword || undefined, salesKeyword: p.salesKeyword || undefined, order: p.order }), [p]);
  const q = useQuery({ queryKey: ['admin', 'studies', 'daily-time', filters, p.page], queryFn: ({ signal }) => adminStudiesParityApi.dailyTime({ ...filters, page: p.page }, signal), placeholderData: keepPreviousData, enabled: p.go === 1 && !!p.from && !!p.companyCode });
  const d = q.data;
  const firstNo = (d?.total ?? 0) - (p.page - 1) * SIZE;
  const [confirmExport, setConfirmExport] = useState(false);
  /** function.js StudyTimeValidateRequired(). */
  const validate = () => {
    if (!form.from || !form.to) { setErr(tr('학습날짜를 선택하세요.', 'Choose the study dates.')); return false; }
    if (form.from > form.to) { setErr(tr('종료일이 시작일보다 이전입니다. 학습날짜를 다시 선택하세요.', 'The end date is before the start date.')); return false; }
    if (!form.companyCode) { setErr(tr('회사명을 검색 후 목록에서 선택하세요.', 'Search for the company and pick it from the list.')); return false; }
    setErr(null); return true;
  };
  const submit = () => { if (validate()) setP({ ...form, go: 1 }, true); };
  /** function.js StudyTimeExcel(): validate the CURRENT form, confirm, then export those values (study_time_search_excel.php, one .xlsx). */
  const startExport = () => { if (exporting) return; if (validate()) setConfirmExport(true); };
  const runExport = () => {
    setConfirmExport(false);
    setP({ ...form, go: 1 }, true);
    const cur = { from: form.from, to: form.to || undefined, companyCode: form.companyCode, status: form.status, minSec: form.minSec, keyword: form.keyword || undefined, salesKeyword: form.salesKeyword || undefined, order: p.order };
    void download(() => adminStudiesParityApi.downloadDailyTimeExcel(cur));
  };
  const sort = (o: string) => setP({ order: o }, true);
  const red = { color: '#c0392b', fontWeight: 700 }; const green = { color: '#1e8449', fontWeight: 700 };
  const cols: Column<DailyTimeRow>[] = [
    { key: 'no', header: tr('번호', 'No.'), align: 'right', width: 56, render: (_r, i) => firstNo - i },
    { key: 'lectureCode', header: tr('과정코드', 'Course'), render: (r) => r.lectureCode ?? '' },
    { key: 'companyName', header: <SortTh label={tr('회사명', 'Company')} col="company" order={p.order} prefer="asc" onSort={sort} />, render: (r) => r.companyName ?? '' },
    { key: 'openChapter', header: tr('실시회차', 'Round'), align: 'center', render: (r) => r.openChapter ?? '' },
    { key: 'lecturePeriod', header: tr('과정 수강기간', 'Period'), nowrap: true, render: (r) => r.lecturePeriod ?? '' },
    { key: 'studyEnd', header: tr('수강마감', 'Closed'), align: 'center', render: (r) => r.studyEnd ?? '' },
    { key: 'tutor', header: tr('첨삭강사ID', 'Tutor ID'), render: (r) => r.tutor ?? '' },
    { key: 'salesId', header: tr('영업자ID', 'Sales ID'), render: (r) => r.salesId ?? '' },
    { key: 'id', header: <SortTh label="ID" col="id" order={p.order} prefer="asc" onSort={sort} />, render: (r) => <Link to={`/admin/members/${encodeURIComponent(r.id)}`}>{r.id}</Link> },
    { key: 'name', header: tr('이름', 'Name'), render: (r) => r.name ?? '' },
    { key: 'attendLabel', header: tr('수료', 'Passed'), align: 'center', render: (r) => <span style={r.attendPass === 'Y' ? green : r.attendPass === 'N' ? { color: '#c0392b' } : { color: '#888' }}>{r.attendLabel}</span> },
    { key: 'hours15Label', header: tr('15시간', '15 h'), align: 'center', render: (r) => <span style={r.hours15Ok ? green : red}>{r.hours15Label}</span> },
    { key: 'totalCreditedLabel', header: <>{tr('인정합', 'Credited total')}<br />{tr('(8시간 적용)', '(8 h cap)')}</>, nowrap: true },
    { key: 'studyDate', header: <SortTh label={tr('학습날짜', 'Date')} col="date" order={p.order} prefer="asc" onSort={sort} />, nowrap: true },
    { key: 'secondsLabel', header: tr('학습시간', 'Studied'), nowrap: true },
    { key: 'creditedLabel', header: <>{tr('인정시간', 'Credited')}<br />{tr('(하루8시간)', '(8 h/day)')}</>, nowrap: true },
    { key: 'excessLabel', header: tr('초과시간', 'Excess'), nowrap: true, render: (r) => (r.excessSec ? <span style={{ color: 'var(--c-danger)' }}>{r.excessLabel}</span> : r.excessLabel) },
    { key: 'statusLabel', header: tr('하루판정', 'Day status'), align: 'center', render: (r) => <StatusBadge tone={r.status === 'over' ? 'danger' : r.status === 'cap' ? 'warn' : r.seconds <= 0 ? 'neutral' : 'ok'}>{r.statusLabel}</StatusBadge> },
  ];
  return (
    <>
      <ConfirmDialog open={confirmExport} tone="warn" onCancel={() => setConfirmExport(false)} onConfirm={runExport} title={tr('검색 결과 엑셀 출력', 'Export to Excel')} confirmLabel={tr('출력', 'Export')}
        body={<p style={{ whiteSpace: 'pre-line' }}>{tr(DAILY_EXCEL_CONFIRM, 'Export the results of the current search (sheets 일자별학습시간 + 15시간충족)? Large results take a while; do not click again until it finishes.')}</p>} />
      <FilterBar onSubmit={submit} onReset={() => { setForm({ from: today, to: today, companyCode: '', companyName: '', status: 'all', minSec: '0', salesKeyword: '', keyword: '' }); setErr(null); reset(); }}
        extra={<AButton onClick={startExport} loading={exporting}>{tr('검색 결과 엑셀 출력', 'Export to Excel')}</AButton>}>
        <FilterField label={tr('학습날짜 *', 'Study dates *')} width={280}><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><DateField id="st-from" value={form.from} onChange={(v) => setForm({ ...form, from: v })} /> ~ <DateField id="st-to" value={form.to} onChange={(v) => setForm({ ...form, to: v })} min={form.from || undefined} /></div></FilterField>
        <FilterField label={tr('회사명 *', 'Company *')} htmlFor="st-co" width={280}><CompanyPicker id="st-co" name={form.companyName} code={form.companyCode} onPick={(v) => setForm({ ...form, companyName: v.name, companyCode: v.code })} /></FilterField>
        <FilterField label={tr('판정', 'Status')} htmlFor="st-status" width={140}><ASelect id="st-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUS} /></FilterField>
        <FilterField label={tr('최소시간', 'Minimum')} htmlFor="st-min" width={120}><ASelect id="st-min" value={form.minSec} onChange={(e) => setForm({ ...form, minSec: e.target.value })} options={MIN_SEC} /></FilterField>
        <FilterField label={tr('영업자 ID/이름', 'Sales ID / name')} htmlFor="st-sales" width={180}><AInput id="st-sales" value={form.salesKeyword} placeholder={tr('영업자 ID 또는 이름', 'Sales ID or name')} onChange={(e) => setForm({ ...form, salesKeyword: e.target.value })} /></FilterField>
        <FilterField label={tr('수강생 ID/이름', 'Learner ID / name')} htmlFor="st-kw" width={180}><AInput id="st-kw" value={form.keyword} placeholder={tr('수강생 ID 또는 이름', 'Learner ID or name')} onChange={(e) => setForm({ ...form, keyword: e.target.value })} /></FilterField>
      </FilterBar>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>{tr('※ 학습날짜(기간)·회사명은 필수입니다. 학습시간은 차시 첫 시각 ~ 끝 시각을 날짜로 자른 값이고, 15시간은 하루 8시간을 적용한 인정합입니다.', '※ Dates and company are required. Study time = each chapter’s first-to-last log time cut by day; 15 h uses the 8 h/day credited total.')}</p>
      {err ? <Callout tone="warn" className="u-mb-8">{err}</Callout> : null}
      {p.go !== 1 || !p.companyCode ? <PendingHint /> : (
        <>
          {d ? (
            <div style={{ margin: '4px 0 8px', padding: '10px 12px', background: 'var(--c-surface-2, #f4f7fb)', border: '1px solid var(--c-line, #c9d6e5)', borderRadius: 6, fontSize: 13 }}>
              <strong>{tr('요약', 'Summary')}</strong>&nbsp; {d.summaryLabel}
              {d.items.length ? <span style={{ marginLeft: 8 }}>{tr(`이 페이지 인원 ${d.pagePeople.people} / 15시간 충족 ${d.pagePeople.ok15}`, `This page: ${d.pagePeople.people} learners / ${d.pagePeople.ok15} meet 15 h`)}</span> : null}
              <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{tr(`기간 ${d.period.label}`, `Period ${d.period.label}`)}</span>
            </div>
          ) : null}
          <DataTable columns={cols} rows={d?.items} rowKey={(r) => `${r.studyDate}-${r.id}`} loading={q.isPending || q.isFetching} error={q.error} onRetry={() => void q.refetch()} emptyTitle={tr('검색된 내용이 없습니다.', 'No results.')}
            page={p.page} size={SIZE} total={d?.total} onPageChange={(n) => setP({ page: n })} dense />
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{d?.rule ?? ''} {tr('8시간 초과는 미인정분이며 수료 문제가 아닙니다.', 'Time over 8 h is simply not credited; it is not a completion problem.')}</p>
        </>
      )}
    </>
  );
}
