import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import styles from '../Admin.module.css';
import { adminSupportParityApi } from '../../../shared/api/endpoints/admin-support-parity';
import { useAdminSession } from '../../../shared/auth/useAdminSession';
import { buildAdminMenu } from '../../../shared/auth/adminMenu';
import { AButton, AdminPage, Card, DescList, Kpi } from '../../../shared/ui/admin';
import { Icon } from '../../../shared/ui/Icon';
import { IconTile } from '../../../shared/ui/IconTile';
import { StateBlock } from '../../../shared/ui/StateBlock';
import { tr } from '../../../shared/i18n/adminLang';
import { adm } from '../strings';

/** main.php "Ruby RAG 관리 바로가기" (shown for sub-menu F2 or department A). */
const RUBY_LINKS = [
  { to: '/admin/ruby/faq', label: 'FAQ CRUD' },
  { to: '/admin/ruby/kb', label: 'Knowledge Base' },
  { to: '/admin/ruby/prompts', label: () => tr('Prompt 설정', 'Prompt settings') },
  { to: '/admin/ruby/runtime', label: () => tr('Threshold 설정', 'Threshold settings') },
  { to: '/admin/ruby/embeddings', label: () => tr('Embedding 재생성', 'Rebuild embeddings') },
  { to: '/admin/ruby/tickets', label: 'Support Ticket' },
];

export default function DashboardPage() {
  const { admin } = useAdminSession();
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: ({ signal }) => adminSupportParityApi.dashboard(signal), refetchInterval: 60_000 });
  const d = q.data;
  const c = adm.dashboard;
  const menu = buildAdminMenu(admin);
  const w = d?.welcome;
  const ruby = d?.rubyShortcuts ?? (admin ? admin.dept === 'A' || admin.subGrants.includes('F2') : false);
  return (
    <AdminPage title={c.title} lead={c.lead} actions={<AButton icon="refresh" onClick={() => void q.refetch()} loading={q.isFetching && !q.isPending}>{adm.common.refresh}</AButton>}>
      {q.isError ? <StateBlock code="LIST_ERROR" center onRetry={() => void q.refetch()} /> : (
        <>
          {/* main.php welcome box */}
          <Card icon="user" title={<span><strong>{w?.name ?? admin?.name ?? ''}</strong> {tr('님 반갑습니다!', ', welcome!')}</span>}>
            <p className="muted" style={{ margin: '0 0 8px' }}>{tr('상단의 메뉴를 눌러 이동하시기 바랍니다.', 'Use the menu above to move around.')}</p>
            <DescList cols={2} items={[[tr('로그인 시간', 'Signed in at'), w?.loginAt ?? null], [tr('접속 IP', 'Your IP'), w?.clientIp ?? null], [tr('연결된 서버 IP', 'Server IP'), w?.serverIp ?? null], [tr('부서', 'Department'), w?.deptName ?? admin?.deptName ?? null]]} />
          </Card>
          <div className={styles.kpis} aria-busy={q.isPending}>
            <Kpi icon="user" iconTone="blue" label={c.logins} value={d?.logins.today} unit={tr('회', '')} hint={d ? tr(`${c.uniqueUsers} ${d.logins.uniqueUsers ?? '—'}명`, `${c.uniqueUsers}: ${d.logins.uniqueUsers ?? '—'}`) : undefined} />
            <Kpi icon="activity" iconTone="indigo" label={c.activePlayers} value={d?.activePlayers.count} unit={tr('명', '')} hint={d ? c.freshness(d.activePlayers.freshnessSeconds) : undefined} tone="navy" />
            <Kpi icon="award" label={c.over15h} value={d?.learnersOver15hThisMonth} unit={tr('명', '')} tone="ok" hint={d ? `${d.monthStart} ~ ${d.today}` : undefined} />
            <Kpi icon="book" iconTone="violet" label={c.activeEnrollments} value={d?.activeEnrollments} unit={tr('건', '')} />
            <Kpi icon="users" iconTone="teal" label={c.signups} value={d?.signupsToday} unit={tr('명', '')} />
            <Kpi icon="send" iconTone="cyan" label={c.emonPending} value={d?.emon.pending} unit={tr('건', '')} tone={d?.emon.pending ? 'warn' : undefined} hint={<Link to="/admin/emon">{tr('EMON 전송함 →', 'EMON outbox →')}</Link>} />
            <Kpi icon="timer" iconTone="amber" label={c.emonStale} value={d?.emon.pendingStale} unit={tr('건', '')} tone={d?.emon.pendingStale ? 'warn' : undefined} />
            <Kpi icon="building" iconTone="navy" label={c.openInquiries} value={d?.support.openInquiries} unit={tr('건', '')} tone={d?.support.openInquiries ? 'warn' : undefined} hint={<Link to="/admin/inquiries">{tr('문의 보기 →', 'View inquiries →')}</Link>} />
            <Kpi icon="inbox" iconTone="blue" label={c.openCounsel} value={d?.support.openCounsel} unit={tr('건', '')} tone={d?.support.openCounsel ? 'warn' : undefined} hint={<Link to="/admin/counsel?status=A">{tr('1:1 문의 →', '1:1 questions →')}</Link>} />
            {d?.support.openCheating !== undefined ? <Kpi icon="shield" iconTone="amber" label={tr('미처리 부정제보', 'Open misconduct reports')} value={d.support.openCheating} unit={tr('건', '')} tone={d.support.openCheating ? 'warn' : undefined} hint={<Link to="/admin/cheating">{tr('부정제보 →', 'Reports →')}</Link>} /> : null}
          </div>
          {ruby ? (
            <Card icon="sparkles" title={tr('Ruby RAG 관리 바로가기', 'Ruby RAG shortcuts')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {RUBY_LINKS.map((l) => <AButton key={l.to} to={l.to} variant="primary" size="sm">{typeof l.label === 'function' ? l.label() : l.label}</AButton>)}
              </div>
            </Card>
          ) : null}
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
