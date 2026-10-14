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
import { tr } from '../../../shared/i18n/adminLang';
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
            <Kpi icon="user" iconTone="blue" label={c.logins} value={d?.logins.today} unit={tr('회', '')} hint={d ? tr(`${c.uniqueUsers} ${d.logins.uniqueUsers ?? '—'}명`, `${c.uniqueUsers}: ${d.logins.uniqueUsers ?? '—'}`) : undefined} />
            <Kpi icon="activity" iconTone="indigo" label={c.activePlayers} value={d?.activePlayers.count} unit={tr('명', '')} hint={d ? c.freshness(d.activePlayers.freshnessSeconds) : undefined} tone="navy" />
            <Kpi icon="award" label={c.over15h} value={d?.learnersOver15hThisMonth} unit={tr('명', '')} tone="ok" hint={d ? `${d.monthStart} ~ ${d.today}` : undefined} />
            <Kpi icon="book" iconTone="violet" label={c.activeEnrollments} value={d?.activeEnrollments} unit={tr('건', '')} />
            <Kpi icon="users" iconTone="teal" label={c.signups} value={d?.signupsToday} unit={tr('명', '')} />
            <Kpi icon="send" iconTone="cyan" label={c.emonPending} value={d?.emon.pending} unit={tr('건', '')} tone={d?.emon.pending ? 'warn' : undefined} hint={<Link to="/admin/emon">{tr('EMON 전송함 →', 'EMON outbox →')}</Link>} />
            <Kpi icon="timer" iconTone="amber" label={c.emonStale} value={d?.emon.pendingStale} unit={tr('건', '')} tone={d?.emon.pendingStale ? 'warn' : undefined} />
            <Kpi icon="building" iconTone="navy" label={c.openInquiries} value={d?.support.openInquiries} unit={tr('건', '')} tone={d?.support.openInquiries ? 'warn' : undefined} hint={<Link to="/admin/inquiries?status=A">{tr('문의 보기 →', 'View inquiries →')}</Link>} />
            <Kpi icon="inbox" iconTone="blue" label={c.openCounsel} value={d?.support.openCounsel} unit={tr('건', '')} tone={d?.support.openCounsel ? 'warn' : undefined} hint={<Link to="/admin/counsel?status=A">{tr('1:1 문의 →', '1:1 questions →')}</Link>} />
          </div>
          <Card title={tr('바로가기', 'Shortcuts')} icon="grid">
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
