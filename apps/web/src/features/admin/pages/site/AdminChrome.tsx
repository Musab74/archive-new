import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminSupportParityApi } from '../../../../shared/api/endpoints/admin-support-parity';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { tr } from '../../../../shared/i18n/adminLang';
import { Icon } from '../../../../shared/ui/Icon';

/**
 * Pieces of the PHP admin frame (include_top.php / include_submenu.php / include_bottom.php) that every page shows, fed by
 * GET /admin/dashboard/chrome. AdminShellParity places the greeting, the browser title, the '메인' side heading and the footer.
 */
export function useAdminChrome() {
  const { admin } = useAdminSession();
  return useQuery({ queryKey: ['admin', 'chrome', admin?.id ?? ''], queryFn: ({ signal }) => adminSupportParityApi.chrome(signal), enabled: !!admin, staleTime: 5 * 60_000 });
}

/**
 * include_top.php <title><?=$SiteName?> (<?=$ServerIP?>)</title>. Applied after AdminShell's own title effect (which runs after the
 * page's effects), so the PHP title wins while this component is mounted.
 */
export function useAdminBrowserTitle(enabled = true) {
  const chrome = useAdminChrome();
  const title = chrome.data?.browserTitle;
  useEffect(() => {
    if (!enabled || !title) return undefined;
    const t = setTimeout(() => { document.title = title; }, 0);
    return () => clearTimeout(t);
  }, [enabled, title]);
}

/**
 * include_top.php header line: <strong><?=$LoginAdminName?> (부서명:<?=$LoginAdminDepart?>)</strong>님 안녕하세요.
 * ($LoginAdminDepart = StaffInfo.Team). Until the chrome call answers, the name is shown with an empty 부서명 like a staff row
 * without a team.
 */
export function AdminChromeGreeting({ className }: { className?: string }) {
  const { admin } = useAdminSession();
  const chrome = useAdminChrome();
  const name = chrome.data?.name ?? admin?.name ?? '';
  if (!name) return null;
  return <span className={className} data-testid="admin-greeting"><b>{`${name} (부서명:${chrome.data?.team ?? ''})`}</b>{tr('님 안녕하세요.', ', hello.')}</span>;
}

/** include_submenu.php default case (main.php): the left column shows the heading 메인 with no links. */
export function AdminMainSideMenu({ className, headClassName }: { className?: string; headClassName?: string }) {
  return (
    <div className={className} aria-label={tr('메인', 'Main')}>
      <h2 className={headClassName} style={headClassName ? undefined : { display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 18 }}><Icon name="home" size={20} />{tr('메인', 'Main')}</h2>
    </div>
  );
}

/** include_top.php 모니터링 <span class="hrde-test-badge">test</span>. */
export function SectionTestBadge({ label = 'test' }: { label?: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 16, marginLeft: 4, padding: '0 5px', borderRadius: 3, background: '#ff6b6b', color: '#fff', fontSize: 10.5, fontWeight: 700, lineHeight: 1, textTransform: 'lowercase' }}>{label}</span>;
}

/** include_bottom.php: logo linking to main.php and $SiteAddress (newest SiteInfomation.Address). */
export function AdminFooter({ className }: { className?: string }) {
  const chrome = useAdminChrome();
  const address = chrome.data?.siteAddress;
  return (
    <footer className={className} style={{ textAlign: 'center', padding: '20px 16px', borderTop: '1px solid var(--c-line)', color: 'var(--c-muted)', fontSize: 13 }}>
      <p style={{ margin: 0 }}><Link to="/admin" aria-label={tr('관리자 메인으로', 'Admin home')} style={{ fontWeight: 700, color: 'var(--c-ink)', textDecoration: 'none' }}>{chrome.data?.siteName || 'HRDe아카이브'}</Link></p>
      {address ? <p style={{ margin: '10px 0 0' }}>{address}</p> : null}
    </footer>
  );
}
