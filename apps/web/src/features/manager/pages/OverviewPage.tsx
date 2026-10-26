import { useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi, type ManagerCompany } from '../../../shared/api/endpoints/manager';
import { useManager } from '../ManagerContext';
import { mgr } from '../strings';
import { StatCard } from '../../../shared/ui/StatCard';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { DataTable, type Column } from '../../../shared/ui/admin';
import { BarList, ManagerError, Panel } from '../managerUi';

const c = mgr.overview;
const companyCols: Column<ManagerCompany>[] = [
  { key: 'companyName', header: c.companyCols.name, sortable: true, render: (r) => <b>{r.companyName}{r.primary ? <small className="muted"> · {mgr.company.primary}</small> : null}</b> },
  { key: 'companyCode', header: c.companyCols.code, sortable: true, nowrap: true },
  { key: 'ceo', header: c.companyCols.ceo, render: (r) => r.ceo ?? '' },
  { key: 'tel', header: c.companyCols.tel, render: (r) => r.tel ?? '' },
  { key: 'trainees', header: c.companyCols.trainees, align: 'right', sortable: true },
];

function Comp({ label, value }: { label: string; value: number }) {
  return <div className={styles.compItem}><span>{label}</span><b>{value.toLocaleString('ko-KR')}</b></div>;
}

/** tab-manager-ai.php "AI 데이터 요약" + AR-21 기업 운영현황 (학습현황 구성). */
export default function OverviewPage() {
  const { companyCode, companies, loading: companiesLoading, error: companiesError } = useManager();
  const q = useQuery({ queryKey: ['manager', 'overview', companyCode], queryFn: ({ signal }) => managerApi.overview(companyCode || undefined, signal), retry: false });
  const d = q.data;
  return (
    <div>
      <div className={styles.head}><div><h1>{c.title}</h1><p>{c.lead}</p></div>{d ? <span className={styles.asOf}>{mgr.asOf(d.asOf)}</span> : null}</div>
      {q.isError ? <ManagerError error={q.error} onRetry={() => void q.refetch()} /> : q.isPending ? (
        <div className={styles.kpis} aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={96} />)}</div>
      ) : d ? (
        <>
          <div className={styles.kpis}>
            <StatCard title={c.kpis.completion} value={d.stats.avgCompletionRate} unit="%" tone="mint" progress={d.stats.avgCompletionRate} caption={c.kpiCaptions.completion(d.stats.completedLearners, d.stats.totalLearners)} />
            <StatCard title={c.kpis.progress} value={d.stats.avgProgressRate} unit="%" progress={d.stats.avgProgressRate} caption={c.kpiCaptions.progress} />
            <StatCard title={c.kpis.learners} value={d.stats.totalLearners} unit="명" tone="navy" caption={c.kpiCaptions.learners(d.stats.completedLearners, d.stats.avgSatisfaction)} />
            <StatCard title={c.kpis.payment} value={d.stats.paymentCompletionRate} unit="%" progress={d.stats.paymentCompletionRate} caption={c.kpiCaptions.payment} />
          </div>

          <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>{c.composition}</h2>
          <div className={styles.grid2}>
            <Panel title={c.refund} note={c.refundNote}>
              <div className={styles.compGrid}>
                <Comp label={c.comp.enrollments} value={d.composition.refund.enrollments} /><Comp label={c.comp.withRecord} value={d.composition.refund.withRecord} /><Comp label={c.comp.noRecord} value={d.composition.refund.noRecord} />
                <Comp label={c.comp.over15h} value={d.composition.refund.over15h} /><Comp label={c.comp.passed} value={d.composition.refund.passed} /><Comp label={c.comp.pending} value={d.composition.refund.pending} />
              </div>
            </Panel>
            <Panel title={c.nonRefund} note={c.nonRefundNote}>
              <div className={styles.compGrid}>
                <Comp label={c.comp.enrollments} value={d.composition.nonRefund.enrollments} /><Comp label={c.comp.withRecord} value={d.composition.nonRefund.withRecord} /><Comp label={c.comp.noRecord} value={d.composition.nonRefund.noRecord} />
              </div>
            </Panel>
          </div>

          <div className={styles.grid2}>
            <Panel title={c.weekly}>
              <BarList unit="시간" max={Math.max(...d.stats.weeklyTimeDistribution, 0)} items={c.weekdays.map((label, i) => ({ label, value: d.stats.weeklyTimeDistribution[i] ?? 0 }))} />
            </Panel>
            <Panel title={c.risk}>
              {d.stats.safeLearners + d.stats.warningLearners + d.stats.atRiskLearners === 0 ? <p className={styles.note}>{c.riskEmpty}</p> : (
                <BarList unit="명" max={Math.max(d.stats.safeLearners, d.stats.warningLearners, d.stats.atRiskLearners)} items={[
                  { label: c.riskLabels.safe, value: d.stats.safeLearners, tone: 'ok' }, { label: c.riskLabels.warning, value: d.stats.warningLearners }, { label: c.riskLabels.risk, value: d.stats.atRiskLearners, tone: 'warn' },
                ]} />
              )}
            </Panel>
          </div>

          <div className={styles.grid2}>
            <Panel title={c.competency}>
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead><tr><th style={{ textAlign: 'left' }}>{c.competencyCols.area}</th><th>{c.competencyCols.before}</th><th>{c.competencyCols.after}</th></tr></thead>
                <tbody>
                  <tr><td>{c.areas.common}</td><td style={{ textAlign: 'center' }}>{d.competency.commonBefore.toFixed(1)}</td><td style={{ textAlign: 'center' }}>{d.competency.commonAfter.toFixed(1)}</td></tr>
                  <tr><td>{c.areas.leadership}</td><td style={{ textAlign: 'center' }}>{d.competency.leadershipBefore.toFixed(1)}</td><td style={{ textAlign: 'center' }}>{d.competency.leadershipAfter.toFixed(1)}</td></tr>
                  <tr><td>{c.areas.job}</td><td style={{ textAlign: 'center' }}>{d.competency.jobBefore.toFixed(1)}</td><td style={{ textAlign: 'center' }}>{d.competency.jobAfter.toFixed(1)}</td></tr>
                </tbody>
              </table>
            </Panel>
            <Panel title={c.insights} note={c.insightNote}>
              <ul className={styles.insights}>
                <li><h4>{c.insightTitles.insight}</h4>{d.insights.insight}</li>
                <li><h4>{c.insightTitles.risk}</h4>{d.insights.risk}</li>
                <li><h4>{c.insightTitles.performance}</h4>{d.insights.performance}</li>
              </ul>
            </Panel>
          </div>
        </>
      ) : null}
      <section className={styles.section}>
        <h2>{c.companies}</h2>
        <DataTable columns={companyCols} rows={companies} rowKey={(r) => r.companyCode} loading={companiesLoading} error={companiesError} emptyTitle={mgr.company.none} dense />
      </section>
    </div>
  );
}
