import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import styles from '../Admin.module.css';
import { adminApi } from '../../../shared/api/endpoints/admin';
import { useAdminSession } from '../../../shared/auth/useAdminSession';
import { buildAdminMenu } from '../../../shared/auth/adminMenu';
import { AButton, AdminPage, Card, Kpi } from '../../../shared/ui/admin';
import { Icon } from '../../../shared/ui/Icon';
import { IconTile } from '../../../shared/ui/IconTile';
import { StateBlock } from '../../../shared/ui/StateBlock';
import { adm } from '../strings';

export default function DashboardPage() {
  const { admin } = useAdminSession();
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: ({ signal }) => adminApi.dashboard(signal), refetchInterval: 60_000 });
  const d = q.data;
  const c = adm.dashboard;
  const menu = buildAdminMenu(admin);
  return (
    <AdminPage title={c.title} lead={c.lead} actions={<AButton icon="refresh" onClick={() => void q.refetch()} loading={q.isFetching && !q.isPending}>{adm.common.refresh}</AButton>}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : (
        <>
          <div className={styles.kpis} aria-busy={q.isPending}>
            <Kpi icon="user" iconTone="blue" label={c.logins} value={d?.logins.today} unit="회" hint={d ? `${c.uniqueUsers} ${d.logins.uniqueUsers ?? '—'}명` : undefined} />
            <Kpi icon="activity" iconTone="indigo" label={c.activePlayers} value={d?.activePlayers.count} unit="명" hint={d ? c.freshness(d.activePlayers.freshnessSeconds) : undefined} tone="navy" />
            <Kpi icon="award" label={c.over15h} value={d?.learnersOver15hThisMonth} unit="명" tone="ok" hint={d ? `${d.monthStart} ~ ${d.today}` : undefined} />
            <Kpi icon="book" iconTone="violet" label={c.activeEnrollments} value={d?.activeEnrollments} unit="건" />
            <Kpi icon="users" iconTone="teal" label={c.signups} value={d?.signupsToday} unit="명" />
            <Kpi icon="send" iconTone="cyan" label={c.emonPending} value={d?.emon.pending} unit="건" tone={d?.emon.pending ? 'warn' : undefined} hint={<Link to="/admin/emon">EMON 전송함 →</Link>} />
            <Kpi icon="timer" iconTone="amber" label={c.emonStale} value={d?.emon.pendingStale} unit="건" tone={d?.emon.pendingStale ? 'warn' : undefined} />
            <Kpi icon="building" iconTone="navy" label={c.openInquiries} value={d?.support.openInquiries} unit="건" tone={d?.support.openInquiries ? 'warn' : undefined} hint={<Link to="/admin/inquiries?status=A">문의 보기 →</Link>} />
            <Kpi icon="inbox" iconTone="blue" label={c.openCounsel} value={d?.support.openCounsel} unit="건" tone={d?.support.openCounsel ? 'warn' : undefined} hint={<Link to="/admin/counsel?status=A">1:1 문의 →</Link>} />
          </div>
          <Card title="바로가기" icon="grid">
            <div className={styles.quick}>
              {menu.flatMap((g) => g.items.map((it) => (
                <Link key={it.to} to={it.to} className={styles.quickItem}>
                  <IconTile icon={it.icon ?? g.icon ?? 'file'} size="md" />
                  <span className={styles.quickText}><small>{g.label}</small><b>{it.label}</b></span>
                  <Icon name="chevron-right" size={18} className={styles.quickGo} />
                </Link>
              )))}
            </div>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
