import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { MANAGER_FILE, downloadManagerFile, managerApi, type TraineeRow, type TraineeStatus } from '../../../shared/api/endpoints/manager';
import { useManager } from '../ManagerContext';
import { useSearchState } from '../../../shared/utils/useSearchState';
import { useToast } from '../../../app/providers/ToastProvider';
import { AButton, AInput, ASelect, DataTable, FilterBar, FilterField, StatusBadge, type Column } from '../../../shared/ui/admin';
import { ManagerError, Pager, YearSelect } from '../managerUi';
import { mgr } from '../strings';

const DEFAULTS = { year: '', q: '', status: 'all', page: 1 };
export const TRAINEE_PAGE_SIZE = 50;
const SECTION_ORDER = ['A', 'W', 'Z'];
const c = mgr.trainees.cols;

export const detailHref = (r: Pick<TraineeRow, 'id' | 'studySeq'>, hash = '') => `/manager/trainees/${encodeURIComponent(r.id)}?studySeq=${r.studySeq}${hash}`;
export const assessmentReportHref = (r: { companyCode: string; lectureCode: string; period: { start: string; end: string } }) =>
  `/manager/reports/assessment-results?${new URLSearchParams({ companyCode: r.companyCode, lectureCode: r.lectureCode, lectureStart: r.period.start, lectureEnd: r.period.end })}`;

/** tab-manager-trainee.php columns (사업장 only when 2+ companies and 사업장 전체). */
export function traineeColumns(showCompany: boolean): Column<TraineeRow>[] {
  return [
    { key: 'sectionNo', header: c.no, align: 'center', width: 56 },
    { key: 'name', header: c.name, render: (r) => <b>{r.name ?? ''}</b> },
    ...(showCompany ? [{ key: 'companyName', header: c.company, render: (r: TraineeRow) => r.companyName ?? r.companyCode } as Column<TraineeRow>] : []),
    { key: 'id', header: c.id, nowrap: true },
    { key: 'period', header: c.period, width: 118, render: (r) => <div className={styles.cellStack}><span>{r.period.start} ~<br />{r.period.end}</span>{r.studyEnd ? <StatusBadge tone="neutral">{mgr.trainees.ended}</StatusBadge> : null}</div> },
    { key: 'timeLabel', header: c.time, nowrap: true, align: 'right' },
    { key: 'percent', header: c.percent, align: 'right', render: (r) => `${r.percent}%` },
    { key: 'passOk', header: c.pass, width: 150, render: (r) => r.passOk ? <StatusBadge tone="ok">{mgr.trainees.passed}</StatusBadge> : (
      <div className={styles.cellStack}><StatusBadge tone="warn">{mgr.trainees.notPassed}</StatusBadge>{r.incomplete ? <span className={styles.reason}>{r.incomplete.label}{r.incomplete.code === 'POST_MISSING' ? <> · <Link to="/my/assessment" target="_blank" rel="noopener">{mgr.trainees.guideLink}</Link></> : null}</span> : null}</div>
    ) },
    { key: 'post', header: c.post, align: 'center', render: (r) => <StatusBadge tone={r.post.state === 'done' ? 'ok' : r.post.state === 'progress' ? 'warn' : 'neutral'}>{r.post.label}</StatusBadge> },
    { key: '_assessment', header: c.assessment, render: (r) => <div className="u-flex u-gap-8"><AButton size="xs" to={detailHref(r, '#assessment')}>{mgr.trainees.assessmentView}</AButton><AButton size="xs" to={assessmentReportHref(r)}>{mgr.trainees.assessmentPdf}</AButton></div> },
    { key: '_detail', header: c.detail, render: (r) => <AButton size="xs" variant="primary" to={detailHref(r)}>{mgr.trainees.detail}</AButton> },
  ];
}

/** Groups the page rows by 과정 유형 in the PHP order A → W → Z → others. */
export function groupBySection(rows: TraineeRow[]): { type: string; title: string; rows: TraineeRow[] }[] {
  const map = new Map<string, TraineeRow[]>();
  for (const r of rows) { const k = r.serviceType || '_'; if (!map.has(k)) map.set(k, []); map.get(k)!.push(r); }
  const keys = [...SECTION_ORDER.filter((k) => map.has(k)), ...[...map.keys()].filter((k) => !SECTION_ORDER.includes(k) && k !== '')];
  return keys.map((k) => ({ type: k, title: map.get(k)![0]!.sectionTitle, rows: map.get(k)! }));
}

/** 수강생 관리 (tabs/tab-manager-trainee.php). */
export default function TraineesPage() {
  const { companyCode } = useManager();
  const { toast } = useToast();
  const [params, setParams, reset] = useSearchState(DEFAULTS);
  const [q, setQ] = useState(params.q);
  const [status, setStatus] = useState(params.status);
  const [exporting, setExporting] = useState(false);
  const query = useMemo(() => ({ companyCode: companyCode || undefined, year: params.year || undefined, q: params.q || undefined, status: (params.status || 'all') as TraineeStatus, page: params.page, size: TRAINEE_PAGE_SIZE }), [companyCode, params]);
  const list = useQuery({ queryKey: ['manager', 'trainees', query], queryFn: ({ signal }) => managerApi.trainees(query, signal), placeholderData: keepPreviousData, retry: false });
  const d = list.data;
  const sections = useMemo(() => groupBySection(d?.items ?? []), [d]);
  const columns = useMemo(() => traineeColumns(!!d?.showCompanyColumn), [d?.showCompanyColumn]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await downloadManagerFile(MANAGER_FILE.traineesXlsx, { companyCode: companyCode || undefined, year: params.year || undefined }, '수강생리스트.xlsx');
      toast(mgr.trainees.excelDone, { tone: 'ok' });
    } catch (e) { toast(e instanceof Error && e.message ? e.message : mgr.trainees.excelFail, { tone: 'danger' }); } finally { setExporting(false); }
  };

  return (
    <div>
      <div className={styles.head}><div><h1>{mgr.trainees.title}</h1><p>{mgr.trainees.intro}</p></div></div>
      <FilterBar onSubmit={() => setParams({ q: q.trim(), status }, true)} onReset={() => { setQ(''); setStatus('all'); reset(); }}
        extra={<AButton icon="download" onClick={() => void exportXlsx()} loading={exporting}>{mgr.trainees.excel}</AButton>}>
        <FilterField label={mgr.year.label} htmlFor="tr-year" width={150}><YearSelect id="tr-year" value={params.year} options={d?.yearOptions ?? []} allLabel={mgr.year.all} onChange={(v) => setParams({ year: v }, true)} /></FilterField>
        <FilterField label={mgr.trainees.search} htmlFor="tr-q" width={200}><AInput id="tr-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={mgr.trainees.search} /></FilterField>
        <FilterField label={mgr.trainees.status} htmlFor="tr-status" width={160}><ASelect id="tr-status" value={status} onChange={(e) => setStatus(e.target.value)} options={mgr.trainees.statuses} /></FilterField>
      </FilterBar>
      {list.isError ? <ManagerError error={list.error} onRetry={() => void list.refetch()} /> : (
        <>
          <div className={styles.toolbar}>
            <p>{mgr.trainees.count(d?.total ?? 0)} {d && d.items.length ? <span className="muted">{mgr.trainees.pageNote(d.items.length, d.uniqueOnPage)}</span> : null}<small>{mgr.trainees.lead}</small></p>
          </div>
          {list.isPending ? <DataTable columns={columns} rows={undefined} rowKey={(r) => r.studySeq} loading /> : sections.length ? sections.map((s) => (
            <section key={s.type} className={styles.typeCard} aria-label={s.title}>
              <header><h3>{s.title}</h3><span>{mgr.trainees.sectionCount(s.rows.length)}</span></header>
              <DataTable columns={columns} rows={s.rows} rowKey={(r) => r.studySeq} dense loading={list.isFetching && !list.isPending} />
            </section>
          )) : <DataTable columns={columns} rows={[]} rowKey={(r) => r.studySeq} emptyTitle={mgr.trainees.empty} emptyBody=" " />}
          {d ? <Pager page={d.page} totalPages={d.totalPages} onChange={(p) => setParams({ page: p })} /> : null}
        </>
      )}
    </div>
  );
}
