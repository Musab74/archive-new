import { useEffect, useMemo } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import styles from '../../Admin.module.css';
import { cx } from '../../../../shared/utils/format';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { ADMIN_MENU, menuEntryForPath, type AdminMenuGroup, type AdminMenuItem } from '../../../../shared/auth/adminMenu';
import { PageTransition } from '../../../../shared/motion/PageTransition';
import { Icon } from '../../../../shared/ui/Icon';
import { tr } from '../../../../shared/i18n/adminLang';
import { adm } from '../../strings';
import { LangSwitch } from '../../LangSwitch';
import { crumbsFor, formatCountdown, formatToday } from '../../AdminShell';
import { buildPhpParityMenu, phpSectionBadge, phpSideExtras } from '../support-menu-parity';
import { AdminChromeGreeting, AdminFooter, AdminMainSideMenu, SectionTestBadge, useAdminChrome } from './AdminChrome';

/** include_submenu.php case "Z" (my_info.php): heading 정보 변경 with one link. */
const MY_INFO_GROUP: AdminMenuGroup = { key: 'my-info', letter: 'Z', label: tr('정보 변경', 'My info'), icon: 'user', items: [{ label: tr('정보 변경', 'My info'), to: '/admin/my-info', grant: '' }] };

export type SideMenu = { kind: 'main' } | { kind: 'group'; group: AdminMenuGroup; items: AdminMenuItem[] };

/**
 * Left column the PHP admin shows for a location: 메인 (no links) on main.php, 정보 변경 on my_info.php, otherwise the section of
 * the page among the sections the staff member can see (include_submenu.php), with the 사이트관리 Ruby links appended.
 * A page outside the visible menu falls back to the first visible section (previous AdminShell behaviour).
 */
export function sideMenuFor(pathname: string, search: string, menu: AdminMenuGroup[], src: Parameters<typeof phpSideExtras>[0]): SideMenu | null {
  if (pathname === '/admin' || pathname === '/admin/') return { kind: 'main' };
  if (pathname === '/admin/my-info' || pathname.startsWith('/admin/my-info/')) return { kind: 'group', group: MY_INFO_GROUP, items: MY_INFO_GROUP.items };
  const group = menuEntryForPath(pathname, menu, search)?.group ?? menu[0] ?? null;
  return group ? { kind: 'group', group, items: [...group.items, ...phpSideExtras(src, group)] } : null;
}

/**
 * The admin console frame with the previous PHP admin's rules (include_top.php / include_submenu.php / include_bottom.php):
 *  - TOP sections and LEFT links filtered exactly like the PHP (buildPhpParityMenu: TopMenuGrant per section, exact SubMenuGrant
 *    per link, 회원 관리 hidden for dept C, Ruby for F2 or dept A, 모니터링 with the "test" badge for dept A only),
 *  - "<이름> (부서명:<StaffInfo.Team>)님 안녕하세요." in the header, the browser title "<SiteName> (<ServerIP>)" on every page,
 *  - 메인 heading in the left column on the dashboard, and the footer (logo → main, SiteInfomation.Address).
 * Same layout and CSS as AdminShell; it replaces it as the AdminLayout element.
 */
export default function AdminShellParity() {
  const { admin, canWrite, secondsLeft, logout, extend } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const chrome = useAdminChrome();
  const menu = useMemo(() => buildPhpParityMenu(admin), [admin]);
  const entry = useMemo(() => menuEntryForPath(location.pathname, menu, location.search), [location.pathname, location.search, menu]);
  const crumbs = useMemo(() => crumbsFor(location.pathname, ADMIN_MENU, location.search), [location.pathname, location.search]);
  const side = useMemo(() => sideMenuFor(location.pathname, location.search, menu, admin), [location.pathname, location.search, menu, admin]);
  const isDashboard = side?.kind === 'main';
  const activeKey = side?.kind === 'group' ? side.group.key : null;
  const today = useMemo(() => formatToday(new Date()), []);
  const phpTitle = chrome.data?.browserTitle;

  // include_top.php <title><?=$SiteName?> (<?=$ServerIP?>)</title> on every page; the menu title until the chrome call answers.
  useEffect(() => { document.title = phpTitle || `${crumbs[crumbs.length - 1]?.label ?? ''} · ${adm.brand}`; }, [crumbs, phpTitle]);

  const warn = secondsLeft !== null && secondsLeft <= 60;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/admin" className={styles.logo} title={adm.brand}>
          <span className={styles.brandMark} aria-hidden="true">A</span>
          <span className={styles.brandText}><b>AINEX ARCHIVE</b><small>{tr('관리자', 'Admin')}</small></span>
        </Link>
        <div className={styles.headRight}>
          <div className={styles.topSide}>
            {admin ? (
              <ul className={styles.adminInfo}>
                <li><AdminChromeGreeting />{!canWrite ? <span className={styles.roTag}>{adm.top.readOnly}</span> : null}</li>
                <li>{today}</li>
                <li className={cx(styles.countdown, warn && styles.countdownWarn)} title={adm.top.countdown} aria-live={warn ? 'polite' : undefined}>
                  <span className={styles.cdLabel}>{adm.top.countdownLong} : </span><b>{formatCountdown(secondsLeft)}</b>
                  <button type="button" onClick={() => void extend()}>{adm.top.extend}</button>
                </li>
              </ul>
            ) : null}
            <div className={styles.topBtns}>
              <LangSwitch className={styles.topLang} />
              <a href="/" target="_blank" rel="noopener noreferrer" className={styles.topBtn}><Icon name="arrow-up-right" size={13} />{adm.top.site}<span className="sr-only">{tr(' (새 창)', ' (opens in a new window)')}</span></a>
              <button type="button" className={cx(styles.topBtn, styles.topBtnSolid)} onClick={() => { void logout('user'); navigate('/admin/login'); }}>{adm.top.logout}</button>
              <Link to="/admin/my-info" className={cx(styles.topBtn, styles.topBtnSolid)}>{adm.top.profile}</Link>
            </div>
          </div>
          <nav className={styles.sections} aria-label={adm.top.sections}>
            <NavLink to="/admin" end className={styles.section}><Icon name="dashboard" size={16} /><span>{adm.top.home}</span></NavLink>
            {menu.map((g) => {
              const current = !isDashboard && activeKey === g.key;
              const badge = phpSectionBadge(g);
              return (
                <Link key={g.key} to={g.items[0]!.to} className={styles.section} aria-current={current ? 'page' : undefined} title={g.label}>
                  <span>{g.label}</span>{badge ? <SectionTestBadge label={badge} /> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {!canWrite ? <div className={styles.readOnlyBar} role="status"><Icon name="lock" size={15} />{adm.readOnly}</div> : null}
      <div className={styles.body}>
        <aside className={styles.side} aria-label={tr('관리자 메뉴', 'Admin menu')}>
          {side?.kind === 'main' ? <AdminMainSideMenu headClassName={styles.sideHead} /> : side ? (
            <>
              <h2 className={styles.sideHead}><Icon name={side.group.icon ?? 'file'} size={20} />{side.group.label}{phpSectionBadge(side.group) ? <SectionTestBadge /> : null}</h2>
              <nav className={styles.sideNav} aria-label={adm.top.sideMenu}>
                {side.items.map((it) => {
                  const current = entry?.item.to === it.to && entry.group.key === side.group.key;
                  return (
                    <Link key={`${side.group.key}:${it.to}`} to={it.to} className={styles.item} aria-current={current ? 'page' : undefined} title={it.legacy ? tr('기존 관리자 화면으로 연결', 'Opens the legacy admin screen') : it.label}>
                      <span className={styles.label}>{it.label}</span>
                      {it.legacy ? <Icon name="external" size={13} className={styles.legacyMark} aria-hidden="true" /> : null}
                    </Link>
                  );
                })}
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
          <AdminFooter />
        </div>
      </div>
    </div>
  );
}
