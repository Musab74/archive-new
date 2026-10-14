import { useEffect, useMemo } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import styles from './Admin.module.css';
import { cx } from '../../shared/utils/format';
import { useAdminSession } from '../../shared/auth/useAdminSession';
import { ADMIN_MENU, buildAdminMenu, GRANT_LABELS, menuEntryForPath, type AdminMenuGroup } from '../../shared/auth/adminMenu';
import { PageTransition } from '../../shared/motion/PageTransition';
import { Icon } from '../../shared/ui/Icon';
import { getAdminLang, tr } from '../../shared/i18n/adminLang';
import { adm } from './strings';
import { LangSwitch } from './LangSwitch';

const DESIGN_LABELS: Record<string, string> = { '': adm.design.nav.overview, presets: adm.design.nav.presets, tokens: adm.design.nav.tokens, typography: adm.design.nav.typography, branding: adm.design.nav.branding, media: adm.design.nav.media, layout: adm.design.nav.layout, links: adm.design.nav.links, preview: adm.design.nav.preview, versions: adm.design.nav.versions, audit: adm.design.nav.audit };

/** Breadcrumb from the menu catalogue: 대시보드 › 섹션 › 메뉴 › (하위). */
export function crumbsFor(pathname: string, menu: AdminMenuGroup[] = ADMIN_MENU): { label: string; to?: string }[] {
  const out: { label: string; to?: string }[] = [{ label: adm.top.home, to: '/admin' }];
  if (pathname === '/admin' || pathname === '/admin/') return out;
  const best = menuEntryForPath(pathname, menu);
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

/** "2026년 10월 14일 (수)" / "Oct 14, 2026 (Wed)" for the header, like the PHP admin's date line. */
export function formatToday(d: Date, lang: 'ko' | 'en' = getAdminLang()): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(d);
}

/**
 * Admin console laid out like the previous PHP admin (hrd_manager): header with greeting · date · auto sign-out,
 * a row of TOP sections (회원 관리 · 수강 관리 · 모니터링 · …), and the active section's menus in the LEFT column.
 * Clicking a section opens its first menu; the left column follows the current page.
 */
export default function AdminShell() {
  const { admin, canWrite, secondsLeft, logout, extend } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const menu = useMemo(() => buildAdminMenu(admin), [admin]);
  const crumbs = useMemo(() => crumbsFor(location.pathname), [location.pathname]);
  const isDashboard = location.pathname === '/admin' || location.pathname === '/admin/';
  const active = useMemo(() => menuEntryForPath(location.pathname, menu)?.group ?? menu[0] ?? null, [location.pathname, menu]);
  const today = useMemo(() => formatToday(new Date()), []);

  useEffect(() => { document.title = `${crumbs[crumbs.length - 1]?.label ?? ''} · ${adm.brand}`; }, [crumbs]);

  const warn = secondsLeft !== null && secondsLeft <= 60;
  const deptLabel = admin ? (admin.deptName ?? GRANT_LABELS[admin.dept] ?? admin.dept) : '';

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headRow}>
          <Link to="/admin" className={styles.brand} title={adm.brand}>
            <span className={styles.brandMark} aria-hidden="true">A</span>
            <span className={styles.brandText}><b>AINEX ARCHIVE</b><small>{tr('관리자 콘솔', 'Admin console')}</small></span>
          </Link>
          {admin ? (
            <div className={styles.greeting}>
              <span className={styles.greetName}><b>{adm.top.greeting(admin.name, deptLabel)}</b>{!canWrite ? <span className={styles.roTag}>{adm.top.readOnly}</span> : null}</span>
              <span className={styles.sep} aria-hidden="true" />
              <span className={styles.today}><Icon name="calendar" size={15} />{today}</span>
              <span className={styles.sep} aria-hidden="true" />
              <span className={cx(styles.countdown, warn && styles.countdownWarn)} title={adm.top.countdown} aria-live={warn ? 'polite' : undefined}>
                <Icon name="timer" size={15} /><span className={styles.cdLabel}>{adm.top.countdownLong}</span><b>{formatCountdown(secondsLeft)}</b>
                <button type="button" onClick={() => void extend()}>{adm.top.extend}</button>
              </span>
            </div>
          ) : null}
          <div className={styles.topRight}>
            <LangSwitch className={styles.topLang} />
            <a href="/" target="_blank" rel="noopener noreferrer" className={styles.siteLink}><Icon name="arrow-up-right" size={16} /><span>{adm.top.site}</span><span className="sr-only">{tr(' (새 창)', ' (opens in a new window)')}</span></a>
            <button type="button" className={styles.logout} onClick={() => { void logout('user'); navigate('/admin/login'); }} title={adm.top.logout}><Icon name="logout" size={17} /><span>{adm.top.logout}</span></button>
          </div>
        </div>
        <nav className={styles.sections} aria-label={adm.top.sections}>
          <NavLink to="/admin" end className={styles.section}><Icon name="dashboard" size={17} /><span>{adm.top.home}</span></NavLink>
          {menu.map((g) => {
            const current = !isDashboard && active?.key === g.key;
            return (
              <Link key={g.key} to={g.items[0]!.to} className={styles.section} aria-current={current ? 'page' : undefined} title={g.label}>
                <Icon name={g.icon ?? 'file'} size={17} /><span>{g.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>
      {!canWrite ? <div className={styles.readOnlyBar} role="status"><Icon name="lock" size={15} />{adm.readOnly}</div> : null}
      <div className={styles.body}>
        <aside className={styles.side} aria-label={tr('관리자 메뉴', 'Admin menu')}>
          {active ? (
            <>
              <div className={styles.sideHead}><Icon name={active.icon ?? 'file'} size={20} /><b>{active.label}</b></div>
              <nav className={styles.sideNav} aria-label={adm.top.sideMenu}>
                {active.items.map((it) => (
                  <NavLink key={it.to} to={it.to} className={styles.item} title={it.label} end={it.to === '/admin/design' ? false : undefined}>
                    <Icon name={it.icon ?? active.icon ?? 'file'} size={18} /><span className={styles.label}>{it.label}</span><Icon name="chevron-right" size={15} className={styles.itemChev} />
                  </NavLink>
                ))}
              </nav>
            </>
          ) : null}
        </aside>
        <div className={styles.mainCol}>
          <nav className={styles.crumbs} aria-label={tr('현재 위치', 'Breadcrumb')}>
            <Icon name="home" size={15} className={styles.crumbHome} />
            {crumbs.map((c, i) => <span key={`${c.label}${i}`} className={styles.crumb}>{i > 0 ? <Icon name="chevron-right" size={14} className={styles.crumbSep} /> : null}{c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <b aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</b>}</span>)}
          </nav>
          <main id="main" className={styles.content} tabIndex={-1}><PageTransition><Outlet /></PageTransition></main>
        </div>
      </div>
    </div>
  );
}
