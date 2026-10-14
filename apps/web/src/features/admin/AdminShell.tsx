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
export function crumbsFor(pathname: string, menu: AdminMenuGroup[] = ADMIN_MENU, search = ''): { label: string; to?: string }[] {
  const out: { label: string; to?: string }[] = [{ label: adm.top.home, to: '/admin' }];
  if (pathname === '/admin' || pathname === '/admin/') return out;
  const best = menuEntryForPath(pathname, menu, search);
  if (!best) { out.push({ label: pathname.replace(/^\/admin\/?/, '') || adm.top.home }); return out; }
  out.push({ label: best.group.label });
  out.push({ label: best.item.label, to: best.item.to });
  const base = best.item.to.split('?')[0]!;
  const rest = pathname.slice(base.length).replace(/^\//, '');
  if (rest) {
    if (base === '/admin/design') out.push({ label: DESIGN_LABELS[rest.split('/')[0] ?? ''] ?? rest });
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
 * Admin console with the previous PHP admin's chrome: purple header (logo box · "이름 (부서)님 안녕하세요" · 날짜 ·
 * 자동 로그아웃 · 로그아웃/정보수정), the TOP sections row, and the active section's menus stacked in the LEFT column.
 */
export default function AdminShell() {
  const { admin, canWrite, secondsLeft, logout, extend } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const menu = useMemo(() => buildAdminMenu(admin), [admin]);
  const entry = useMemo(() => menuEntryForPath(location.pathname, menu, location.search), [location.pathname, location.search, menu]);
  const crumbs = useMemo(() => crumbsFor(location.pathname, ADMIN_MENU, location.search), [location.pathname, location.search]);
  const isDashboard = location.pathname === '/admin' || location.pathname === '/admin/';
  const active = entry?.group ?? menu[0] ?? null;
  const today = useMemo(() => formatToday(new Date()), []);

  useEffect(() => { document.title = `${crumbs[crumbs.length - 1]?.label ?? ''} · ${adm.brand}`; }, [crumbs]);

  const warn = secondsLeft !== null && secondsLeft <= 60;
  const deptLabel = admin ? (admin.deptName ?? GRANT_LABELS[admin.dept] ?? admin.dept) : '';

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
                <li><b>{adm.top.greeting(admin.name, deptLabel)}</b>{!canWrite ? <span className={styles.roTag}>{adm.top.readOnly}</span> : null}</li>
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
              <Link to="/admin/legacy/my_info" className={cx(styles.topBtn, styles.topBtnSolid)}>{adm.top.profile}</Link>
            </div>
          </div>
          <nav className={styles.sections} aria-label={adm.top.sections}>
            <NavLink to="/admin" end className={styles.section}><Icon name="dashboard" size={16} /><span>{adm.top.home}</span></NavLink>
            {menu.map((g) => {
              const current = !isDashboard && active?.key === g.key;
              return (
                <Link key={g.key} to={g.items[0]!.to} className={styles.section} aria-current={current ? 'page' : undefined} title={g.label}>
                  <span>{g.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {!canWrite ? <div className={styles.readOnlyBar} role="status"><Icon name="lock" size={15} />{adm.readOnly}</div> : null}
      <div className={styles.body}>
        <aside className={styles.side} aria-label={tr('관리자 메뉴', 'Admin menu')}>
          {active ? (
            <>
              <h2 className={styles.sideHead}><Icon name={active.icon ?? 'file'} size={20} />{active.label}</h2>
              <nav className={styles.sideNav} aria-label={adm.top.sideMenu}>
                {active.items.map((it) => {
                  const current = entry?.item.to === it.to;
                  return (
                    <Link key={it.to} to={it.to} className={styles.item} aria-current={current ? 'page' : undefined} title={it.legacy ? tr('기존 관리자 화면으로 연결', 'Opens the legacy admin screen') : it.label}>
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
        </div>
      </div>
    </div>
  );
}
