import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi, type PaymentItem } from '../../../shared/api/endpoints/manager';
import { useManager } from '../ManagerContext';
import { useSearchState } from '../../../shared/utils/useSearchState';
import { DataTable, StatusBadge, type Column } from '../../../shared/ui/admin';
import { StatCard } from '../../../shared/ui/StatCard';
import { ManagerError, Pager, Panel, YearSelect, won } from '../managerUi';
import { mgr } from '../strings';

const DEFAULTS = { year: '', page: 1 };
const c = mgr.payments.cols;
const columns: Column<PaymentItem>[] = [
  { key: 'no', header: c.no, align: 'center', width: 56 },
  { key: 'courseName', header: c.course, render: (r) => <span title={`${r.lectureCode} · ${r.period.start} ~ ${r.period.end}`}>{r.courseName}</span> },
  { key: 'educationFee', header: c.fee, align: 'right', render: (r) => won(r.educationFee) },
  { key: 'selfPayment', header: c.self, align: 'right', render: (r) => won(r.selfPayment) },
  { key: 'deposit', header: c.deposit, align: 'right', render: (r) => won(r.deposit) },
  { key: 'requestAmount', header: c.request, align: 'right', render: (r) => won(r.requestAmount) },
  { key: 'statusLabel', header: c.status, align: 'center', render: (r) => <StatusBadge tone={r.depositStatus === 'C' ? 'ok' : 'warn'}>{r.statusLabel}</StatusBadge> },
  { key: 'payStatusLabel', header: c.payStatus, align: 'center', render: (r) => r.payStatusLabel ?? '—' },
];

/** 자부담금 관리 (tabs/tab-manager-payment.php) + AR-21 비용·증빙 상태 구분. */
export default function PaymentsPage() {
  const { companyCode } = useManager();
  const [params, setParams] = useSearchState(DEFAULTS);
  const q = useQuery({ queryKey: ['manager', 'payments', companyCode, params], queryFn: ({ signal }) => managerApi.payments({ companyCode: companyCode || undefined, year: params.year || undefined, page: params.page }, signal), placeholderData: keepPreviousData, retry: false });
  const d = q.data;
  return (
    <div>
      <div className={styles.head}><div><h1>{mgr.payments.title}</h1><p>{mgr.payments.lead}</p></div></div>
      {q.isError ? <ManagerError error={q.error} onRetry={() => void q.refetch()} /> : (
        <>
          <div className={styles.kpis}>
            <StatCard title={mgr.payments.cards.fee} value={d?.summary.totalEducationFee ?? 0} unit="원" countUp={false} />
            <StatCard title={mgr.payments.cards.self} value={d?.summary.totalSelfPayment ?? 0} unit="원" countUp={false} />
            <StatCard title={mgr.payments.cards.deposit} value={d?.summary.totalDeposit ?? 0} unit="원" countUp={false} tone="mint" />
            <StatCard title={mgr.payments.cards.rate} value={d?.summary.paymentRate ?? 0} unit="%" progress={d?.summary.paymentRate ?? 0} countUp={false} />
          </div>
          <section className={styles.section}>
            <div className={styles.toolbar}>
              <h2 style={{ margin: 0 }}>{mgr.payments.history}</h2>
              {d ? <YearSelect id="pay-year" value={params.year || d.year} options={d.yearOptions} onChange={(v) => setParams({ year: v }, true)} /> : null}
            </div>
            {d ? <p className={styles.note} style={{ margin: '0 0 8px' }}>{mgr.payments.students(d.summary.uniqueStudents, d.summary.totalCount)}</p> : null}
            <DataTable columns={columns} rows={d?.items} rowKey={(r) => r.studySeq} loading={q.isPending || q.isFetching} emptyTitle={mgr.payments.empty} emptyBody=" " />
            {d ? <Pager page={d.page} totalPages={d.totalPages} block={5} onChange={(p) => setParams({ page: p })} /> : null}
          </section>
          <div style={{ margin: '0 0 22px' }}>
            <Panel title={mgr.payments.insight} note={mgr.payments.insightNote}>
              <ul className={styles.insights}>{mgr.payments.insightItems.map((i) => <li key={i.title}><h4>{i.title}</h4>{i.text}</li>)}</ul>
            </Panel>
          </div>
          <Panel title={mgr.payments.proofTitle} note={mgr.payments.proofNote}>
            <ul className={styles.stats}>{mgr.payments.proofItems.map((label) => <li key={label}><span>{label}</span><b style={{ fontSize: 13 }}>{mgr.payments.proofStatus}</b></li>)}</ul>
          </Panel>
        </>
      )}
    </div>
  );
}
