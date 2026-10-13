import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import styles from './Header.module.css';
import { IconButton } from './IconButton';
import { Button } from './Button';
import { Icon } from './Icon';
import { TypeLabel } from './Pill';
import { useHeaderChrome } from './headerChrome';
import { useScrolled } from '../utils/useScrolled';
import { supportApi } from '../api/endpoints/support';
import { useDesign, useAssetUrl } from '../design/useDesign';
import { useSession } from '../auth/useSession';
import { useFocusTrap } from '../utils/useFocusTrap';
import { cx } from '../utils/format';
import { brand, common, footer as footerCopy, megaMenu, nav } from '../strings/ko';
import { fadeVariants, scaleInVariants } from '../motion/variants';

const RECENT_KEY = 'search.recent.v1';
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]; } catch { return []; } };
const pushRecent = (q: string) => { try { const list = [q, ...readRecent().filter((x) => x !== q)].slice(0, 6); localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* ignore */ } };

export const primaryNav = [
  { label: nav.archive, to: '/catalog', match: (p: string, s: string) => p.startsWith('/catalog') && !s.includes('competency=') },
  { label: nav.common, to: '/catalog?competency=common', match: (_p: string, s: string) => s.includes('competency=common') },
  { label: nav.job, to: '/catalog?competency=job', match: (_p: string, s: string) => s.includes('competency=job') },
  { label: nav.leadership, to: '/catalog?competency=leadership', match: (_p: string, s: string) => s.includes('competency=leadership') },
  { label: nav.aiZone, to: '/ai-zone', match: (p: string) => p.startsWith('/ai-zone') },
  { label: nav.live, to: '/live', match: (p: string) => p.startsWith('/live') },
  { label: nav.support, to: '/support/guide', match: (p: string) => p.startsWith('/support') },
];

function Brand({ className }: { className?: string }) {
  const { config } = useDesign();
  const logo = useAssetUrl(config.branding.logoAssetId);
  return (
    <Link to="/" className={cx(styles.brand, className)} aria-label={`${config.branding.siteName} ${common.goHome}`}>
      {logo ? <img src={logo} alt={config.branding.logoAlt || config.branding.siteName} /> : config.layout.heroVariant === 'visual-right' ? (
        <span className={styles.wordmark} aria-hidden="true"><span className={styles.badge}>{brand.wordmark.charAt(0)}</span><b className={styles.wordmarkText}>{brand.wordmark} <span>{brand.archive}</span></b></span>
      ) : (
        <span className={styles.wordmark} aria-hidden="true"><b>{brand.wordmark}</b><span>{brand.archive}</span></span>
      )}
    </Link>
  );
}

/** Latest 공지 for the editorial header's NEWS pill; silently hidden when the API is unreachable or the list is empty. */
function NewsPill() {
  const q = useQuery({ queryKey: ['support', 'notices', 'latest'], queryFn: ({ signal }) => supportApi.notices({ page: 1, size: 1 }, signal), staleTime: 10 * 60_000, retry: false });
  const latest = q.data?.items?.[0];
  if (!latest) return null;
  return (
    <Link to={`/support/notice/${latest.idx}`} className={styles.news} aria-label={`${nav.news}: ${latest.title}`}>
      <TypeLabel tone="coral" small>{nav.news}</TypeLabel>
      <span className={styles.newsTitle}>{latest.title}</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

/**
 * Site header (AR-20 C01): brand, 6 + ARCHIVE nav, search overlay, login/name+logout, 나의 학습실, 전체메뉴 mega menu / mobile drawer.
 * Editorial treatment (heroVariant 'visual-right'): floats transparently over the orbit hero and frosts once scrolled;
 * right cluster = 공지 pill → text link → white pill button.
 */
export function Header() {
  const { config } = useDesign();
  const editorial = config.layout.heroVariant === 'visual-right';
  const { overlay } = useHeaderChrome();
  const scrolled = useScrolled(8);
  const { user, isAuthed, logout } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const searchId = useId();
  const drawerId = useId();

  const closeAll = useCallback(() => { setMenuOpen(false); setSearchOpen(false); setDrawerOpen(false); }, []);
  useEffect(() => { closeAll(); }, [location.pathname, location.search, closeAll]);
  useFocusTrap(megaRef, menuOpen, () => setMenuOpen(false));
  useFocusTrap(searchRef, searchOpen, () => setSearchOpen(false));
  useFocusTrap(drawerRef, drawerOpen, () => setDrawerOpen(false));

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = (new FormData(e.currentTarget).get('q') as string | null)?.trim() ?? '';
    if (!q) return;
    pushRecent(q);
    setSearchOpen(false);
    navigate(`/catalog?q=${encodeURIComponent(q)}`);
  };

  const variant = config.layout.headerVariant;
  const recent = searchOpen ? readRecent() : [];
  const menuColumns = megaMenu.map((col) => ({ ...col, items: col.items.filter((it) => !it.auth || isAuthed) }));
  const roleLinks = [
    ...(user?.eduManager ? [{ label: nav.manager, to: '/manager' }] : []),
    ...(isAuthed && user?.companyCode ? [{ label: nav.companyEdu, to: '/my/company' }] : []),
  ];

  const transparent = editorial && overlay && !scrolled && !menuOpen && !searchOpen;
  const frosted = editorial && scrolled;
  const loginHref = `/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <header className={cx(styles.header, variant === 'compact' && styles.compact, variant === 'centered' && styles.centered, editorial && styles.editorial, transparent && styles.transparent, frosted && styles.frosted)} data-scrolled={scrolled || undefined}>
      <a href="#main" className={styles.skip}>{common.skipToContent}</a>
      <div className={styles.inner}>
        <Brand />
        <nav aria-label={nav.mainMenu} className={styles.gnb}>
          {primaryNav.map((item) => {
            const current = item.match(location.pathname, location.search);
            // Plain Link: NavLink ignores the query string, so every /catalog?competency=… entry would claim aria-current on /catalog.
            return <Link key={item.to} to={item.to} className={cx(styles.navLink, current && styles.current)} aria-current={current ? 'page' : undefined}>{item.label}</Link>;
          })}
        </nav>
        <div className={styles.util}>
          {editorial ? <NewsPill /> : null}
          <IconButton icon="search" label={nav.search} aria-expanded={searchOpen} aria-controls={searchId} onClick={() => { setMenuOpen(false); setSearchOpen((v) => !v); }} />
          {isAuthed && user ? (
            <span className={styles.member}>{user.name} {nav.memberSuffix} <button type="button" className={styles.utilLink} onClick={() => void logout('user')}>{nav.logout}</button></span>
          ) : (
            <Link to={loginHref} className={styles.utilLink}>{nav.login}</Link>
          )}
          {editorial && !isAuthed
            ? <Link to="/support/inquiry/new" className={styles.myBtn}>{nav.apply}</Link>
            : <Link to={isAuthed ? '/my' : `/auth/login?next=${encodeURIComponent('/my')}`} className={styles.myBtn}>{nav.myRoom}</Link>}
          <IconButton icon="menu" label={nav.allMenu} className={cx('u-hide-mobile', styles.desktopMenu)} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => { setSearchOpen(false); setMenuOpen((v) => !v); }} />
          <IconButton icon="menu" label={nav.allMenu} className={cx(styles.mobileOnly, styles.tabletDrawer)} aria-expanded={drawerOpen} aria-controls={drawerId} onClick={() => setDrawerOpen(true)} />
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.div key="scrim" className={styles.scrim} variants={fadeVariants} initial="hidden" animate="show" exit="exit" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <motion.div key="mega" id={menuId} ref={megaRef} className={styles.mega} role="dialog" aria-modal="true" aria-label={nav.allMenu} tabIndex={-1} variants={reduced ? fadeVariants : scaleInVariants} initial="hidden" animate="show" exit="exit">
              <div className={styles.megaInner}>
                <div className={styles.menuTop}><h2>{nav.allMenu}</h2><IconButton icon="close" label={nav.closeMenu} onClick={() => setMenuOpen(false)} /></div>
                <div className={styles.menuAccount}>
                  {isAuthed && user ? (
                    <>
                      <b>{user.name} {nav.memberSuffix}</b>
                      <Button variant="secondary" square size="sm" onClick={() => void logout('user')}>{nav.logout}</Button>
                      <Button variant="secondary" square size="sm" to="/my">{nav.myRoom}</Button>
                    </>
                  ) : (
                    <>
                      <Button square size="sm" to={`/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`}>{nav.login}</Button>
                      <Button variant="secondary" square size="sm" to="/auth/signup/terms">{nav.signup}</Button>
                      <Button variant="secondary" square size="sm" to={`/auth/login?next=${encodeURIComponent('/my')}`}>{nav.myRoom}</Button>
                    </>
                  )}
                </div>
                <div className={styles.allmenu}>
                  {menuColumns.map((col) => (
                    <div key={col.title} className={styles.col}>
                      <h3>{col.title}</h3>
                      {col.items.map((it) => <Link key={it.to} to={it.to}>{it.label}</Link>)}
                      {col.title === '참여·지원' && roleLinks.map((r) => <Link key={r.to} to={r.to}>{r.label}</Link>)}
                    </div>
                  ))}
                </div>
                <div className={styles.menuLinks}>
                  {config.links.liveClassUrl ? <a href={config.links.liveClassUrl} target="_blank" rel="noopener noreferrer">{footerCopy.links.academy} <span aria-hidden="true">↗</span><span className="sr-only"> ({common.external})</span></a> : null}
                  {config.links.axisUrl ? <a href={config.links.axisUrl} target="_blank" rel="noopener noreferrer">{footerCopy.links.axis} <span aria-hidden="true">↗</span><span className="sr-only"> ({common.external})</span></a> : null}
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen ? (
          <>
            <motion.div key="sscrim" className={styles.scrim} variants={fadeVariants} initial="hidden" animate="show" exit="exit" onClick={() => setSearchOpen(false)} aria-hidden="true" />
            <motion.div key="search" id={searchId} ref={searchRef} className={styles.search} role="dialog" aria-modal="true" aria-label={nav.search} tabIndex={-1} variants={reduced ? fadeVariants : scaleInVariants} initial="hidden" animate="show" exit="exit">
              <div className={styles.searchInner}>
                <div className={styles.menuTop}><h2>{nav.searchTitle}</h2><IconButton icon="close" label={nav.closeSearch} onClick={() => setSearchOpen(false)} /></div>
                <form className={styles.searchbox} role="search" onSubmit={onSearch}>
                  <label htmlFor={`${searchId}-q`} className="sr-only">{nav.search}</label>
                  <input id={`${searchId}-q`} name="q" type="search" placeholder={nav.searchPlaceholder} autoComplete="off" autoFocus />
                  <button type="submit" aria-label={nav.searchSubmit}><Icon name="search" size={22} /></button>
                </form>
                <div className={styles.recent}>
                  <h3>{nav.recentSearch}</h3>
                  {recent.length === 0 ? <p>{nav.noRecentSearch}</p> : (
                    <div className={styles.recentList}>{recent.map((q) => <Button key={q} variant="secondary" size="xs" to={`/catalog?q=${encodeURIComponent(q)}`}>{q}</Button>)}</div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {drawerOpen ? (
          <div className={styles.drawer} id={drawerId}>
            <motion.div className={styles.drawerScrim} variants={fadeVariants} initial="hidden" animate="show" exit="exit" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <motion.div ref={drawerRef} className={styles.drawerPanel} role="dialog" aria-modal="true" aria-label={nav.allMenu} tabIndex={-1} initial={reduced ? { opacity: 0 } : { x: '100%' }} animate={reduced ? { opacity: 1 } : { x: 0 }} exit={reduced ? { opacity: 0 } : { x: '100%' }} transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}>
              <div className={styles.drawerHead}><h2>{nav.allMenu}</h2><IconButton icon="close" label={nav.closeMenu} onClick={() => setDrawerOpen(false)} /></div>
              <div className={styles.drawerAccount}>
                {isAuthed && user ? (
                  <>
                    <b>{user.name} {nav.memberSuffix}</b>
                    <Button variant="secondary" square size="sm" onClick={() => void logout('user')}>{nav.logout}</Button>
                    <Button square size="sm" to="/my">{nav.myRoom}</Button>
                  </>
                ) : (
                  <>
                    <Button square size="sm" to={`/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`}>{nav.login}</Button>
                    <Button variant="secondary" square size="sm" to="/auth/signup/terms">{nav.signup}</Button>
                  </>
                )}
              </div>
              <nav className={styles.drawerNav} aria-label={nav.mainMenu}>
                <div>
                  <h3>{nav.archive}</h3>
                  {primaryNav.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}
                </div>
                {menuColumns.map((col) => (
                  <div key={col.title}>
                    <h3>{col.title}</h3>
                    {col.items.map((it) => <Link key={it.to} to={it.to}>{it.label}</Link>)}
                    {col.title === '참여·지원' && roleLinks.map((r) => <Link key={r.to} to={r.to}>{r.label}</Link>)}
                  </div>
                ))}
              </nav>
              <div className={styles.drawerLinks}>
                {config.links.axisUrl ? <a href={config.links.axisUrl} target="_blank" rel="noopener noreferrer">{footerCopy.links.axis} <span aria-hidden="true">↗</span></a> : null}
                <Link to="/terms">{footerCopy.legal.terms}</Link>
                <Link to="/privacy">{footerCopy.legal.privacy}</Link>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
