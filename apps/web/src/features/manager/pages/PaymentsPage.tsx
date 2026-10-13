import { useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi } from '../../../shared/api/endpoints/manager';
import type { PaymentRow } from '../../../shared/api/schemas';
import { useManager } from '../ManagerContext';
import { DataTable, StatusBadge, type BadgeTone, type Column } from '../../../shared/ui/admin';
import { formatNumber } from '../../../shared/utils/format';
import { mgr } from '../strings';

const tone: Record<string, BadgeTone> = { N: 'neutral', R: 'warn', S: 'info', Y: 'ok' };
const c = mgr.payments.cols;
const columns: Column<PaymentRow>[] = [
  { key: 'period', header: c.period, nowrap: true, sortable: true, sortValue: (r) => r.period.start, render: (r) => `${r.period.start} ~ ${r.period.end}` },
  { key: 'bankPrice', header: c.bank, align: 'right', sortable: true, render: (r) => `${formatNumber(r.bankPrice)}원` },
  { key: 'cardPrice', header: c.card, align: 'right', sortable: true, render: (r) => `${formatNumber(r.cardPrice)}원` },
  { key: 'payStatus', header: c.status, align: 'center', sortable: true, render: (r) => <StatusBadge tone={tone[r.payStatus ?? ''] ?? 'neutral'}>{r.payStatusLabel ?? r.payStatus ?? '—'}</StatusBadge> },
  { key: 'payMethod', header: c.method, render: (r) => r.payMethod ?? '—' },
  { key: 'orderNo', header: c.order, render: (r) => <span className="mono">{r.orderNo ?? '—'}</span> },
  { key: 'payDate', header: c.payDate, nowrap: true, sortable: true, render: (r) => r.payDate ?? '—' },
  { key: 'regDate', header: c.regDate, nowrap: true, sortable: true, render: (r) => r.regDate ?? '—' },
  { key: 'remark', header: c.remark, render: (r) => r.remark ?? '' },
];

export default function PaymentsPage() {
  const { companyCode } = useManager();
  const q = useQuery({ queryKey: ['manager', 'payments', companyCode], queryFn: ({ signal }) => managerApi.payments(companyCode || undefined, signal) });
  return (
    <div>
      <div className={styles.head}><div><h1>{mgr.payments.title}</h1><p>{mgr.payments.lead}</p></div></div>
      <DataTable columns={columns} rows={q.data} rowKey={(r) => r.idx} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} size={20} emptyTitle={mgr.payments.empty} emptyBody=" " />
    </div>
  );
}
