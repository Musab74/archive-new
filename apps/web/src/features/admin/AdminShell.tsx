import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import styles from './Admin.module.css';
import { cx } from '../../shared/utils/format';
import { useAdminSession } from '../../shared/auth/useAdminSession';
import { ADMIN_MENU, buildAdminMenu, GRANT_LABELS, type AdminMenuGroup } from '../../shared/auth/adminMenu';
import { PageTransition } from '../../shared/motion/PageTransition';
import { IconButton } from '../../shared/ui/IconButton';
import { Icon } from '../../shared/ui/Icon';
import { tr } from '../../shared/i18n/adminLang';
import { adm } from './strings';
import { LangSwitch } from './LangSwitch';

const COLLAPSE_KEY = 'admin.sidebar.collapsed';
const DESIGN_LABELS: Record<string, string> = { '': adm.design.nav.overview, presets: adm.design.nav.presets, tokens: adm.design.nav.tokens, typography: adm.design.nav.typography, branding: adm.design.nav.branding, media: adm.design.nav.media, layout: adm.design.nav.layout, links: adm.design.nav.links, preview: adm.design.nav.preview, versions: adm.design.nav.versions, audit: adm.design.nav.audit };

/** Breadcrumb from the menu catalogue: 대시보드 › 그룹 › 메뉴 › (하위). */
export function crumbsFor(pathname: string, menu: AdminMenuGroup[] = ADMIN_MENU): { label: string; to?: string }[] {
  const out: { label: string; to?: string }[] = [{ label: adm.top.home, to: '/admin' }];
  if (pathname === '/admin' || pathname === '/admin/') return out;
  let best: { group: AdminMenuGroup; item: AdminMenuGroup['items'][number] } | null = null;
  for (const group of menu) for (const item of group.items) if ((pathname === item.to || pathname.startsWith(`${item.to}/`)) && (!best || item.to.length > best.item.to.length)) best = { group, item };
  if (!best) { out.push({ label: pathname.replace(/^\/admin\/?/, '') || adm.top.home }); return out; }
  out.push({ label: best.group.label });
  out.push({ label: best.item.label, to: best.item.to });
  const rest = pathname.slice(best.item.to.length).replace(/^\//, '');
  if (rest) {
    if (best.item.to === '/admin/design') out.push({ label: DESIGN_LABELS[rest.split('/')[0] ?? ''] ?? rest });
    else out.push({ label: decodeURIComponent(rest) });
  }
  return out;
}

export function formatCountdown(sec: number | null): string {
  if (sec === null) return '--:--';
  const m = Math.floor(sec / 60); const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Admin console: collapsible sidebar grouped by grant letter, top bar (staff, dept, countdown), breadcrumb, read-only bar. */
export default function AdminShell() {
  const { admin, canWrite, secondsLeft, logout, extend } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const menu = useMemo(() => buildAdminMenu(admin), [admin]);
  const crumbs = useMemo(() => crumbsFor(location.pathname), [location.pathname]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => { try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ } }, [collapsed]);
  useEffect(() => { document.title = `${crumbs[crumbs.length - 1]?.label ?? ''} · ${adm.brand}`; }, [crumbs]);

  const isOpen = (letter: string) => openGroups[letter] ?? true;
  const warn = secondsLeft !== null && secondsLeft <= 60;

  return (
    <div className={cx(styles.shell, collapsed && styles.collapsed)}>
      {mobileOpen ? <div className={styles.sideScrim} onClick={() => setMobileOpen(false)} aria-hidden="true" /> : null}
      <aside className={cx(styles.sidebar, mobileOpen && styles.sidebarOpen)} aria-label={tr('관리자 메뉴', 'Admin menu')}>
        <Link to="/admin" className={styles.brand} title={adm.brand}>
          <span className={styles.brandMark} aria-hidden="true">A</span>
          <span className={styles.brandText}><b>AINEX ARCHIVE</b><small>{tr('관리자 콘솔', 'Admin console')}</small></span>
        </Link>
        <nav className={styles.menu}>
          <NavLink to="/admin" end className={styles.item} title={adm.top.home}><Icon name="dashboard" size={19} /><span className={styles.label}>{adm.top.home}</span></NavLink>
          {menu.map((g) => (
            <div key={g.letter} className={styles.group}>
              <button type="button" className={styles.groupHead} aria-expanded={isOpen(g.letter)} onClick={() => setOpenGroups((o) => ({ ...o, [g.letter]: !isOpen(g.letter) }))} title={g.label}>
                <span className={styles.label}>{GRANT_LABELS[g.letter] ?? g.label}</span>
                <Icon name="chevron-down" size={15} className={styles.chev} />
              </button>
              {isOpen(g.letter) || collapsed ? (
                <div className={styles.items}>
                  {g.items.map((it) => (
                    <NavLink key={it.to} to={it.to} className={styles.item} title={it.label} end={it.to === '/admin/design' ? false : undefined}>
                      <Icon name={it.icon ?? g.icon ?? 'file'} size={19} /><span className={styles.label}>{it.label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className={styles.sideFoot}>
          <button type="button" className={styles.toggle} onClick={() => setCollapsed((v) => !v)} aria-pressed={collapsed} title={collapsed ? adm.top.expand : adm.top.collapse}>
            <Icon name={collapsed ? 'panel-open' : 'panel-close'} size={18} /><span className={styles.label}>{collapsed ? adm.top.expand : adm.top.collapse}</span>
          </button>
        </div>
      </aside>
      <div className={styles.mainCol}>
        <header className={styles.topbar}>
          <IconButton icon="menu" label={tr('메뉴', 'Menu')} size="sm" className={styles.mobileMenuBtn} onClick={() => setMobileOpen((v) => !v)} aria-expanded={mobileOpen} />
          <nav className={styles.crumbs} aria-label={tr('현재 위치', 'Breadcrumb')}>
            <Icon name="home" size={16} className={styles.crumbHome} />
            {crumbs.map((c, i) => <span key={`${c.label}${i}`} className={styles.crumb}>{i > 0 ? <Icon name="chevron-right" size={14} className={styles.crumbSep} /> : null}{c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <b aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</b>}</span>)}
          </nav>
          <div className={styles.topRight}>
            <LangSwitch className={styles.topLang} />
            <a href="/" target="_blank" rel="noopener noreferrer" className={styles.siteLink}><Icon name="arrow-up-right" size={16} /><span>{adm.top.site}</span><span className="sr-only">{tr(' (새 창)', ' (opens in a new window)')}</span></a>
            <span className={cx(styles.countdown, warn && styles.countdownWarn)} title={adm.top.countdown} aria-live={warn ? 'polite' : undefined}>
              <Icon name="timer" size={16} /><span className={styles.cdLabel}>{adm.top.countdown}</span><b>{formatCountdown(secondsLeft)}</b>
              <button type="button" onClick={() => void extend()}>{adm.top.extend}</button>
            </span>
            {admin ? (
              <span className={styles.staff}>
                <span className={styles.avatar} aria-hidden="true">{admin.name.charAt(0)}</span>
                <span className={styles.staffText}><b>{admin.name}</b><small>{admin.deptName ?? GRANT_LABELS[admin.dept] ?? admin.dept} · {admin.dept}{!canWrite ? ` · ${adm.top.readOnly}` : ''}</small></span>
              </span>
            ) : null}
            <button type="button" className={styles.logout} onClick={() => { void logout('user'); navigate('/admin/login'); }} title={adm.top.logout}><Icon name="logout" size={17} /><span>{adm.top.logout}</span></button>
          </div>
        </header>
        {!canWrite ? <div className={styles.readOnlyBar} role="status"><Icon name="lock" size={15} />{adm.readOnly}</div> : null}
        <main id="main" className={styles.content} tabIndex={-1}><PageTransition><Outlet /></PageTransition></main>
      </div>
    </div>
  );
}
