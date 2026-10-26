import { lazy, Suspense, useMemo, useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import styles from './Layouts.module.css';
import { Header } from '../../shared/ui/Header';
import { Footer } from '../../shared/ui/Footer';
import { PageTransition } from '../../shared/motion/PageTransition';
import { Icon } from '../../shared/ui/Icon';
import { nav, placeholders, my as myCopy } from '../../shared/strings/ko';
import { cx } from '../../shared/utils/format';
import { Skeleton } from '../../shared/ui/Skeleton';
import { HeaderChromeContext } from '../../shared/ui/headerChrome';
import { SiteVisitCounter } from '../../features/admin/pages/site-cms/SiteVisitCounter';
import { SiteChrome } from './SiteChrome';
/** sections/correction-notice-popup.php ran on every 나의학습실 page: lazy so other layouts do not load it. */
const CorrectionNoticePopup = lazy(() => import('../../features/my/CorrectionNoticePopup'));

const ManagerShell = lazy(() => import('../../features/manager/ManagerShell'));
const AdminShell = lazy(() => import('../../features/admin/pages/site/AdminShellParity'));
const shellFallback = <div className="section" aria-busy="true"><Skeleton height={28} width="40%" /><Skeleton lines={5} /></div>;

function Shell({ wide }: { wide?: boolean }) {
  const [overlay, setOverlay] = useState(false);
  const chrome = useMemo(() => ({ overlay, setOverlay }), [overlay]);
  return (
    <HeaderChromeContext.Provider value={chrome}>
      <div className={styles.shell}>
        <Header />
        <main id="main" className={cx(styles.main, styles.frame, wide && styles.wide)} tabIndex={-1}>
          <PageTransition><Outlet /></PageTransition>
        </main>
        <Footer />
        <SiteVisitCounter />
        <SiteChrome />
      </div>
    </HeaderChromeContext.Provider>
  );
}

/** Public pages: header + 1200 px frame + footer. */
export function PublicLayout() { return <Shell />; }
/** Auth flows share the public chrome (AR-20 keeps the header/footer on login/signup). */
export function AuthLayout() { return <Shell />; }
/** Signed-in learner pages (학습 홈, 진단, 로드맵, 만족도조사). */
export function LearnerLayout() { return <Shell />; }

const myNav = [
  { to: '/my', label: myCopy.nav.home, end: true },
  { to: '/my/records', label: myCopy.nav.records },
  { to: '/my/certificates', label: myCopy.nav.certificates },
  { to: '/my/saved', label: myCopy.nav.saved },
  { to: '/my/report', label: myCopy.nav.report },
  { to: '/my/ranking', label: myCopy.nav.ranking },
  { to: '/my/assessment', label: myCopy.nav.assessment },
  { to: '/my/company-training', label: myCopy.nav.company },
  { to: '/live', label: myCopy.nav.live },
  { to: '/my/surveys', label: myCopy.nav.surveys },
  { to: '/my/tickets', label: myCopy.nav.tickets },
  { to: '/my/profile', label: myCopy.nav.profile },
];

/** 나의 학습실: side navigation + content. */
export function MyRoomLayout() {
  return (
    <div className={styles.shell}>
      <Header />
      <main id="main" className={styles.main} tabIndex={-1}>
        <div className={styles.room}>
          <aside className={styles.side}>
            <h2>{nav.myRoom}</h2>
            <nav aria-label={nav.myRoom}>
              {myNav.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}
              {/* public/include/mypage_header.html:616-622 법정교육바로가기 (new window) */}
              <a href={myCopy.nav.legalEduUrl} target="_blank" rel="noopener noreferrer">{myCopy.nav.legalEdu} ↗</a>
            </nav>
          </aside>
          <div className={styles.roomMain}><PageTransition><Outlet /></PageTransition></div>
          <Suspense fallback={null}><CorrectionNoticePopup /></Suspense>
        </div>
      </main>
      <Footer />
      <SiteVisitCounter />
      <SiteChrome />
    </div>
  );
}

/** 기업 교육담당자 (AR-21): the shell (company selector + side nav) lives in a lazy chunk. */
export function ManagerLayout() {
  return <Suspense fallback={shellFallback}><ManagerShell /></Suspense>;
}

/** Admin console shell (sidebar grouped by grant letter, top bar with countdown) — lazy chunk, no marketing chrome. */
export function AdminLayout() {
  return <Suspense fallback={shellFallback}><AdminShell /></Suspense>;
}

/** Learning window (AR-06): dark, no header/footer, a thin bar with a back link. */
export function PlayerLayout() {
  return (
    <div className={styles.player}>
      <div className={styles.playerBar} role="banner">
        <Link to="/home"><Icon name="arrow-left" size={18} /> {placeholders.home}</Link>
      </div>
      <main id="main" className={styles.playerMain} tabIndex={-1}><Outlet /></main>
    </div>
  );
}
