import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import styles from '../Admin.module.css';
import { adminApi } from '../../../shared/api/endpoints/admin';
import { useAdminSession } from '../../../shared/auth/useAdminSession';
import { buildAdminMenu } from '../../../shared/auth/adminMenu';
import { AButton, AdminPage, Card, Kpi } from '../../../shared/ui/admin';
import { StateBlock } from '../../../shared/ui/StateBlock';
import { adm } from '../strings';

export default function DashboardPage() {
  const { admin } = useAdminSession();
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: ({ signal }) => adminApi.dashboard(signal), refetchInterval: 60_000 });
  const d = q.data;
  const c = adm.dashboard;
  const menu = buildAdminMenu(admin);
  return (
    <AdminPage title={c.title} lead={c.lead} actions={<AButton onClick={() => void q.refetch()} loading={q.isFetching && !q.isPending}>{adm.common.refresh}</AButton>}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : (
        <>
          <div className={styles.kpis} aria-busy={q.isPending}>
            <Kpi label={c.logins} value={d?.logins.today} unit="회" hint={d ? `${c.uniqueUsers} ${d.logins.uniqueUsers ?? '—'}명` : undefined} />
            <Kpi label={c.activePlayers} value={d?.activePlayers.count} unit="명" hint={d ? c.freshness(d.activePlayers.freshnessSeconds) : undefined} tone="navy" />
            <Kpi label={c.over15h} value={d?.learnersOver15hThisMonth} unit="명" tone="ok" hint={d ? `${d.monthStart} ~ ${d.today}` : undefined} />
            <Kpi label={c.activeEnrollments} value={d?.activeEnrollments} unit="건" />
            <Kpi label={c.signups} value={d?.signupsToday} unit="명" />
            <Kpi label={c.emonPending} value={d?.emon.pending} unit="건" tone={d?.emon.pending ? 'warn' : undefined} hint={<Link to="/admin/emon">EMON 전송함 →</Link>} />
            <Kpi label={c.emonStale} value={d?.emon.pendingStale} unit="건" tone={d?.emon.pendingStale ? 'warn' : undefined} />
            <Kpi label={c.openInquiries} value={d?.support.openInquiries} unit="건" tone={d?.support.openInquiries ? 'warn' : undefined} hint={<Link to="/admin/inquiries?status=A">문의 보기 →</Link>} />
            <Kpi label={c.openCounsel} value={d?.support.openCounsel} unit="건" tone={d?.support.openCounsel ? 'warn' : undefined} hint={<Link to="/admin/counsel?status=A">1:1 문의 →</Link>} />
          </div>
          <Card title="메뉴">
            <div className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {menu.flatMap((g) => g.items.map((it) => <AButton key={it.to} to={it.to} size="sm">{g.label} · {it.label}</AButton>))}
            </div>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
