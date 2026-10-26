import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import styles from './Header.module.css';
import { IconButton } from './IconButton';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { IconTile, type IconTone } from './IconTile';
import { SearchField } from './SearchField';
import { useHeaderChrome } from './headerChrome';
import { useScrolled } from '../utils/useScrolled';
import { supportApi } from '../api/endpoints/support';
import { useDesign, useAssetUrl } from '../design/useDesign';
import { useSession } from '../auth/useSession';
import { useFocusTrap } from '../utils/useFocusTrap';
import { cx } from '../utils/format';
import { brand, common, footer as footerCopy, megaMenu, nav } from '../strings/ko';
import { fadeVariants } from '../motion/variants';

const RECENT_KEY = 'search.recent.v1';
const DISMISS_KEY = 'notice.dismissed.v1';
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]; } catch { return []; } };
const pushRecent = (q: string) => { try { const list = [q, ...readRecent().filter((x) => x !== q)].slice(0, 6); localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* ignore */ } };
const readDismissed = (): number | null => { try { const v = sessionStorage.getItem(DISMISS_KEY); return v ? Number(v) : null; } catch { return null; } };

const EASE = [0.16, 1, 0.3, 1] as const;

export interface PrimaryNavItem { label: string; to: string; icon: IconName; tone: IconTone; match: (p: string, s: string) => boolean }
export const primaryNav: PrimaryNavItem[] = [
  { label: nav.archive, to: '/catalog', icon: 'library', tone: 'navy', match: (p, s) => p.startsWith('/catalog') && !s.includes('competency=') },
  { label: nav.common, to: '/catalog?competency=common', icon: 'briefcase', tone: 'blue', match: (_p, s) => s.includes('competency=common') },
  { label: nav.job, to: '/catalog?competency=job', icon: 'target', tone: 'teal', match: (_p, s) => s.includes('competency=job') },
  { label: nav.leadership, to: '/catalog?competency=leadership', icon: 'users', tone: 'violet', match: (_p, s) => s.includes('competency=leadership') },
  { label: nav.aiZone, to: '/ai-zone', icon: 'sparkles', tone: 'indigo', match: (p) => p.startsWith('/ai-zone') },
  { label: nav.live, to: '/live', icon: 'broadcast', tone: 'coral', match: (p) => p.startsWith('/live') },
  { label: nav.support, to: '/support/guide', icon: 'headset', tone: 'amber', match: (p) => p.startsWith('/support') },
];

function Brand({ className, compact }: { className?: string; compact?: boolean }) {
  const { config } = useDesign();
  const logo = useAssetUrl(config.branding.logoAssetId);
  return (
    <Link to="/" className={cx(styles.brand, className)} aria-label={`${config.branding.siteName} ${common.goHome}`}>
      {logo ? <img src={logo} alt={config.branding.logoAlt || config.branding.siteName} /> : (
        <span className={styles.wordmark} aria-hidden="true">
          <span className={styles.badge}>{brand.wordmark.charAt(0)}</span>
          <b className={styles.wordmarkText}>{brand.wordmark}{compact ? null : <span> {brand.archive}</span>}</b>
        </span>
      )}
    </Link>
  );
}

/** Slim bar above the header with the latest 공지; dismissible for the session, silently absent without data. */
function AnnouncementBar() {
  const q = useQuery({ queryKey: ['support', 'notices', 'latest'], queryFn: ({ signal }) => supportApi.notices({ page: 1, size: 1 }, signal), staleTime: 10 * 60_000, retry: false });
  const latest = q.data?.items?.[0];
  const [dismissed, setDismissed] = useState<number | null>(readDismissed);
  if (!latest || dismissed === latest.idx) return null;
  const dismiss = () => { try { sessionStorage.setItem(DISMISS_KEY, String(latest.idx)); } catch { /* ignore */ } setDismissed(latest.idx); };
  return (
    <div className={styles.announce} role="region" aria-label={nav.news}>
      <div className={styles.announceInner}>
        <Link to={`/support/notice/${latest.idx}`} className={styles.announceLink}>
          <span className={styles.announceTag}><Icon name="megaphone" size={13} />{nav.news}</span>
          <span className={styles.announceTitle}>{latest.title}</span>
          <Icon name="arrow" size={14} className={styles.announceArrow} />
        </Link>
        <Link to="/support/notice" className={styles.announceAll}>{nav.allNotices}</Link>
        <button type="button" className={styles.announceClose} onClick={dismiss} aria-label={nav.dismissNotice}><Icon name="close" size={14} /></button>
      </div>
    </div>
  );
}

/**
 * Site header (AR-20 C01): optional 공지 bar, sticky bar with brand · primary nav (animated active indicator) ·
 * search · account · CTA · 전체메뉴. Desktop: mega menu + search panel drop below the bar. ≤1024 px: a slide-in drawer
 * with the nav as icon rows and the menu groups as accordions. On the editorial home hero the bar starts transparent
 * and frosts once scrolled (useHeaderOverlay); elsewhere it is solid and gains a soft shadow when scrolled.
 */
export function Header() {
  const { config } = useDesign();
  const { overlay } = useHeaderChrome();
  const scrolled = useScrolled(8);
  const { user, isAuthed, logout } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
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

  const onSearch = (q: string) => {
    if (!q) return;
    pushRecent(q);
    setSearchOpen(false);
    navigate(`/catalog?q=${encodeURIComponent(q)}`);
  };

  const variant = config.layout.headerVariant;
  const recent = searchOpen ? readRecent() : [];
  const menuColumns = megaMenu.map((col) => ({ ...col, items: col.items.filter((it) => !it.auth || isAuthed) })).filter((col) => col.items.length > 0);
  const roleLinks = [
    ...(user?.eduManager ? [{ label: nav.manager, to: '/manager' }] : []),
    ...(isAuthed && user?.companyCode ? [{ label: nav.companyEdu, to: '/my/company-training' }] : []),
  ];
  const transparent = overlay && !scrolled && !menuOpen && !searchOpen;
  const loginHref = `/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`;
  const cta = isAuthed ? { label: nav.myRoom, to: '/my' } : { label: nav.apply, to: '/support/inquiry/new' };
  const panelMotion = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };

  return (
    <>
      <a href="#main" className={styles.skip}>{common.skipToContent}</a>
      <AnnouncementBar />
      <header className={cx(styles.header, variant === 'compact' && styles.compact, variant === 'centered' && styles.centered, transparent && styles.transparent, scrolled && styles.scrolled)} data-scrolled={scrolled || undefined}>
        <div className={styles.inner}>
          <Brand />
          <nav aria-label={nav.mainMenu} className={styles.gnb}>
            {primaryNav.map((item) => {
              const current = item.match(location.pathname, location.search);
              // Plain Link: NavLink ignores the query string, so every /catalog?competency=… entry would claim aria-current on /catalog.
              return (
                <Link key={item.to} to={item.to} className={cx(styles.navLink, current && styles.current)} aria-current={current ? 'page' : undefined}>
                  {item.label}
                  {current ? <motion.span layoutId="gnb-indicator" className={styles.indicator} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 40 }} /> : null}
                </Link>
              );
            })}
          </nav>
          <div className={styles.util}>
            <IconButton icon="search" label={nav.search} plain className={cx(styles.utilIcon, searchOpen && styles.utilIconOn)} aria-expanded={searchOpen} aria-controls={searchId} onClick={() => { setMenuOpen(false); setSearchOpen((v) => !v); }} />
            {isAuthed && user ? (
              <span className={styles.member}><span className={styles.avatar} aria-hidden="true">{user.name.charAt(0)}</span><span className={styles.memberName}>{user.name} {nav.memberSuffix}</span><button type="button" className={styles.utilLink} onClick={() => void logout('user')}>{nav.logout}</button></span>
            ) : (
              <Link to={loginHref} className={styles.utilLink}>{nav.login}</Link>
            )}
            <Link to={cta.to} className={styles.cta}>{cta.label}</Link>
            <IconButton icon="menu" label={nav.allMenu} plain className={cx(styles.utilIcon, styles.desktopMenu, menuOpen && styles.utilIconOn)} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => { setSearchOpen(false); setMenuOpen((v) => !v); }} />
            <IconButton icon="menu" label={nav.allMenu} plain className={cx(styles.utilIcon, styles.drawerBtn)} aria-expanded={drawerOpen} aria-controls={drawerId} onClick={() => setDrawerOpen(true)} />
          </div>
        </div>

        <AnimatePresence>
          {menuOpen ? (
            <>
              <motion.div key="scrim" className={styles.scrim} variants={fadeVariants} initial="hidden" animate="show" exit="exit" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <motion.div key="mega" id={menuId} ref={megaRef} className={styles.panel} role="dialog" aria-modal="true" aria-label={nav.allMenu} tabIndex={-1} {...panelMotion} transition={{ duration: 0.24, ease: EASE }}>
                <div className={styles.panelInner}>
                  <div className={styles.panelTop}><h2>{nav.allMenu}</h2><IconButton icon="close" label={nav.closeMenu} onClick={() => setMenuOpen(false)} /></div>
                  <div className={styles.megaGrid}>
                    <div className={styles.megaNav}>
                      {primaryNav.map((item) => (
                        <Link key={item.to} to={item.to} className={styles.megaNavItem}><IconTile icon={item.icon} tone={item.tone} size="sm" /><span className={styles.itemLabel}>{item.label}</span><Icon name="chevron-right" size={16} className={styles.chev} /></Link>
                      ))}
                    </div>
                    <div className={styles.megaCols}>
                      {menuColumns.map((col) => (
                        <div key={col.title} className={styles.col}>
                          <h3>{col.title}</h3>
                          {col.items.map((it) => <Link key={it.to} to={it.to}>{it.label}</Link>)}
                          {col.title === '참여·지원' && roleLinks.map((r) => <Link key={r.to} to={r.to}>{r.label}</Link>)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.panelFoot}>
                    {isAuthed && user ? (
                      <><b>{user.name} {nav.memberSuffix}</b><Button variant="secondary" size="sm" onClick={() => void logout('user')}>{nav.logout}</Button></>
                    ) : (
                      <><span>{nav.guestTitle}</span><Button size="sm" to={loginHref}>{nav.login}</Button><Button variant="secondary" size="sm" to="/auth/signup/terms">{nav.signup}</Button></>
                    )}
                    <span className={styles.footLinks}>
                      {config.links.liveClassUrl ? <a href={config.links.liveClassUrl} target="_blank" rel="noopener noreferrer">{footerCopy.links.academy} <Icon name="arrow-up-right" size={14} /><span className="sr-only"> ({common.external})</span></a> : null}
                      {config.links.axisUrl ? <a href={config.links.axisUrl} target="_blank" rel="noopener noreferrer">{footerCopy.links.axis} <Icon name="arrow-up-right" size={14} /><span className="sr-only"> ({common.external})</span></a> : null}
                    </span>
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
              <motion.div key="search" id={searchId} ref={searchRef} className={styles.panel} role="dialog" aria-modal="true" aria-label={nav.search} tabIndex={-1} {...panelMotion} transition={{ duration: 0.22, ease: EASE }}>
                <div className={cx(styles.panelInner, styles.searchInner)}>
                  <div className={styles.panelTop}><h2>{nav.searchTitle}</h2><IconButton icon="close" label={nav.closeSearch} onClick={() => setSearchOpen(false)} /></div>
                  <SearchField id={`${searchId}-q`} name="q" size="lg" label={nav.search} placeholder={nav.searchPlaceholder} submitLabel={nav.searchSubmit} clearLabel={nav.clearSearch} onSearch={onSearch} autoFocus />
                  <div className={styles.searchCols}>
                    <div>
                      <h3>{nav.recentSearch}</h3>
                      {recent.length === 0 ? <p className={styles.searchEmpty}>{nav.noRecentSearch}</p> : (
                        <div className={styles.recentList}>{recent.map((q) => <Link key={q} className={styles.recentChip} to={`/catalog?q=${encodeURIComponent(q)}`}><Icon name="clock" size={13} />{q}</Link>)}</div>
                      )}
                    </div>
                    <div>
                      <h3>{nav.quickExplore}</h3>
                      <div className={styles.quick}>
                        {primaryNav.slice(1, 5).map((item) => <Link key={item.to} to={item.to} className={styles.quickItem}><IconTile icon={item.icon} tone={item.tone} size="sm" />{item.label}</Link>)}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {drawerOpen ? (
          <div className={styles.drawer} id={drawerId}>
            <motion.div className={styles.drawerScrim} variants={fadeVariants} initial="hidden" animate="show" exit="exit" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <motion.div ref={drawerRef} className={styles.drawerPanel} role="dialog" aria-modal="true" aria-label={nav.allMenu} tabIndex={-1} initial={reduced ? { opacity: 0 } : { x: '100%' }} animate={reduced ? { opacity: 1 } : { x: 0 }} exit={reduced ? { opacity: 0 } : { x: '100%' }} transition={{ duration: 0.3, ease: EASE }}>
              <div className={styles.drawerHead}><Brand compact /><IconButton icon="close" label={nav.closeMenu} onClick={() => setDrawerOpen(false)} /></div>
              <div className={styles.drawerBody}>
                <div className={styles.drawerAccount}>
                  {isAuthed && user ? (
                    <>
                      <span className={styles.avatarLg} aria-hidden="true">{user.name.charAt(0)}</span>
                      <div><small>{nav.welcome}</small><b>{user.name} {nav.memberSuffix}</b></div>
                      <Button variant="secondary" size="sm" onClick={() => void logout('user')}>{nav.logout}</Button>
                    </>
                  ) : (
                    <>
                      <p>{nav.guestTitle}</p>
                      <div className={styles.drawerAccountBtns}>
                        <Button size="sm" to={loginHref}>{nav.login}</Button>
                        <Button variant="secondary" size="sm" to="/auth/signup/terms">{nav.signup}</Button>
                      </div>
                    </>
                  )}
                </div>
                <nav className={styles.drawerNav} aria-label={nav.mainMenu}>
                  {primaryNav.map((item, i) => {
                    const current = item.match(location.pathname, location.search);
                    return (
                      <motion.div key={item.to} initial={reduced ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : 0.08 + i * 0.03, duration: 0.28, ease: EASE }}>
                        <Link to={item.to} className={cx(styles.drawerItem, current && styles.drawerItemOn)} aria-current={current ? 'page' : undefined}>
                          <IconTile icon={item.icon} tone={item.tone} size="sm" />
                          <span className={styles.itemLabel}>{item.label}</span>
                          <Icon name="chevron-right" size={18} className={styles.chev} />
                        </Link>
                      </motion.div>
                    );
                  })}
                </nav>
                <div className={styles.groups}>
                  {menuColumns.map((col) => {
                    const open = openGroup === col.title;
                    const gid = `${drawerId}-${col.title}`;
                    return (
                      <div key={col.title} className={styles.group}>
                        <button type="button" className={styles.groupBtn} aria-expanded={open} aria-controls={gid} onClick={() => setOpenGroup(open ? null : col.title)}>
                          {col.title}<Icon name="chevron-down" size={18} className={cx(styles.groupChev, open && styles.groupChevOn)} />
                        </button>
                        <AnimatePresence initial={false}>
                          {open ? (
                            <motion.div id={gid} className={styles.groupBody} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.24, ease: EASE }}>
                              <div className={styles.groupLinks}>
                                {col.items.map((it) => <Link key={it.to} to={it.to}>{it.label}</Link>)}
                                {col.title === '참여·지원' && roleLinks.map((r) => <Link key={r.to} to={r.to}>{r.label}</Link>)}
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={styles.drawerFoot}>
                <Button block to={cta.to} iconRight={<Icon name="arrow" size={16} />}>{cta.label}</Button>
                <div className={styles.drawerLinks}>
                  {config.links.axisUrl ? <a href={config.links.axisUrl} target="_blank" rel="noopener noreferrer">{footerCopy.links.axis}</a> : null}
                  <Link to="/terms">{footerCopy.legal.terms}</Link>
                  <Link to="/privacy">{footerCopy.legal.privacy}</Link>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
