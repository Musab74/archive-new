import { useQuery } from '@tanstack/react-query';
import styles from '../Manager.module.css';
import { managerApi } from '../../../shared/api/endpoints/manager';
import type { CompletionRow } from '../../../shared/api/schemas';
import { useManager } from '../ManagerContext';
import { Bar, DataTable, type Column } from '../../../shared/ui/admin';
import { mgr } from '../strings';

const c = mgr.completion.cols;
const columns: Column<CompletionRow>[] = [
  { key: 'companyName', header: c.company, sortable: true, render: (r) => r.companyName ?? r.companyCode },
  { key: 'courseName', header: c.course, sortable: true, render: (r) => <span title={r.lectureCode}>{r.courseName}</span> },
  { key: 'period', header: c.period, nowrap: true, sortable: true, sortValue: (r) => r.period.start, render: (r) => `${r.period.start} ~ ${r.period.end}` },
  { key: 'total', header: c.total, align: 'right', sortable: true },
  { key: 'passed', header: c.passed, align: 'right', sortable: true },
  { key: 'failed', header: c.failed, align: 'right', sortable: true },
  { key: 'closed', header: c.closed, align: 'right', sortable: true },
  { key: 'over15h', header: c.over15h, align: 'right', sortable: true },
  { key: 'passRate', header: c.rate, sortable: true, width: 140, render: (r) => <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Bar value={r.passRate} tone={r.passRate >= 80 ? 'ok' : r.passRate < 50 ? 'warn' : undefined} /><span style={{ fontSize: 12, minWidth: 40, textAlign: 'right' }}>{r.passRate}%</span></div> },
];

export default function CompletionPage() {
  const { companyCode } = useManager();
  const q = useQuery({ queryKey: ['manager', 'completion', companyCode], queryFn: ({ signal }) => managerApi.completion(companyCode || undefined, signal) });
  return (
    <div>
      <div className={styles.head}><div><h1>{mgr.completion.title}</h1><p>{mgr.completion.lead}</p></div></div>
      <DataTable columns={columns} rows={q.data} rowKey={(r) => `${r.companyCode}-${r.lectureCode}-${r.period.start}-${r.period.end}`} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} size={20} />
    </div>
  );
}
