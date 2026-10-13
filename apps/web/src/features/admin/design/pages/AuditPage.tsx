import { useQuery } from '@tanstack/react-query';
import { designApi } from '../../../../shared/api/endpoints/design';
import type { DesignAuditLine } from '../../../../shared/api/schemas';
import { AButton, Card, DataTable, StatusBadge, type BadgeTone, type Column } from '../../../../shared/ui/admin';
import { adm } from '../../strings';

const tone = (a: string): BadgeTone => (a.startsWith('publish') || a === 'bootstrap' ? 'ok' : a.startsWith('restore') ? 'warn' : a.startsWith('media.delete') ? 'danger' : a.startsWith('media') ? 'info' : 'neutral');
const cols: Column<DesignAuditLine>[] = [
  { key: 'at', header: adm.design.audit.cols.at, nowrap: true, sortable: true, render: (r) => r.at.replace('T', ' ').slice(0, 19) },
  { key: 'actor', header: adm.design.audit.cols.actor, sortable: true },
  { key: 'action', header: adm.design.audit.cols.action, sortable: true, render: (r) => <StatusBadge tone={tone(r.action)}>{r.action}</StatusBadge> },
  { key: 'meta', header: adm.design.audit.cols.meta, render: (r) => <span className="mono" style={{ fontSize: 11 }}>{r.meta ? JSON.stringify(r.meta) : ''}</span> },
];

export default function AuditPage() {
  const q = useQuery({ queryKey: ['design', 'audit'], queryFn: ({ signal }) => designApi.audit(200, signal) });
  return (
    <Card title={adm.design.nav.audit} aside={<AButton size="sm" onClick={() => void q.refetch()} loading={q.isFetching && !q.isPending}>{adm.common.refresh}</AButton>}>
      <DataTable columns={cols} rows={q.data} rowKey={(r, i) => `${r.at}-${i}`} loading={q.isPending} error={q.error} onRetry={() => void q.refetch()} dense size={50} />
    </Card>
  );
}
