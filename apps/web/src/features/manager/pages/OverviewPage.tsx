import { useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi } from '../../../shared/api/endpoints/manager';
import { useManager } from '../ManagerContext';
import { mgr } from '../strings';
import { StatCard } from '../../../shared/ui/StatCard';
import { StateBlock } from '../../../shared/ui/StateBlock';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { DataTable, type Column } from '../../../shared/ui/admin';
import type { ManagerCompany } from '../../../shared/api/schemas';
import { Callout } from '../../../shared/ui/admin';

const companyCols: Column<ManagerCompany>[] = [
  { key: 'companyName', header: '기업명', sortable: true, render: (r) => r.companyName ?? r.companyCode },
  { key: 'companyCode', header: '기업코드', sortable: true },
  { key: 'ceo', header: '대표', render: (r) => r.ceo ?? '' },
  { key: 'tel', header: '연락처', render: (r) => r.tel ?? '' },
  { key: 'trainees', header: '수강생', align: 'right', sortable: true },
];

export default function OverviewPage() {
  const { companyCode, companies, loading: companiesLoading, error: companiesError } = useManager();
  const q = useQuery({ queryKey: ['manager', 'overview', companyCode], queryFn: ({ signal }) => managerApi.overview(companyCode || undefined, signal) });
  const d = q.data;
  const c = mgr.overview;
  return (
    <div>
      <div className={styles.head}><div><h1>{c.title}</h1><p>{c.lead}</p></div>{d ? <span className="muted" style={{ fontSize: 12 }}>{c.today(d.today)}</span> : null}</div>
      {q.isError ? <StateBlock code="LIST_ERROR" center title={c.error.title} body={c.error.body} onRetry={() => void q.refetch()} /> : q.isPending ? (
        <div className={styles.kpis} aria-busy="true">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={96} />)}</div>
      ) : d ? (
        <>
          <div className={styles.kpis}>
            <StatCard title={c.kpis.enrollments} value={d.enrollments} unit="건" />
            <StatCard title={c.kpis.trainees} value={d.trainees} unit="명" tone="navy" />
            <StatCard title={c.kpis.active} value={d.active} unit="건" />
            <StatCard title={c.kpis.over15h} value={d.over15h} unit="건" tone="mint" progress={d.enrollments ? (d.over15h / d.enrollments) * 100 : 0} />
            <StatCard title={c.kpis.passOk} value={d.passOk} unit="건" tone="mint" />
            <StatCard title={c.kpis.closed} value={d.closed} unit="건" />
            <StatCard title={c.kpis.preDone} value={d.preDone} unit="건" progress={d.enrollments ? (d.preDone / d.enrollments) * 100 : 0} />
            <StatCard title={c.kpis.postDone} value={d.postDone} unit="건" progress={d.enrollments ? (d.postDone / d.enrollments) * 100 : 0} />
          </div>
          <div className={styles.kpis} style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
            <StatCard title={c.kpis.avg} value={Math.round(d.avgSeconds / 60)} unit="분" caption={d.avgFormatted} countUp={false} />
            <StatCard title={c.kpis.total} value={Math.round(d.totalSeconds / 3600)} unit="시간" caption={`${d.totalSeconds.toLocaleString('ko-KR')}초`} countUp={false} />
          </div>
          <Callout>{c.scopeNote}</Callout>
        </>
      ) : null}
      <section className={styles.section} style={{ marginTop: 22 }}>
        <h2>{mgr.company.label}</h2>
        <DataTable columns={companyCols} rows={companies} rowKey={(r) => r.companyCode} loading={companiesLoading} error={companiesError} emptyTitle={mgr.company.none} dense />
      </section>
    </div>
  );
}
