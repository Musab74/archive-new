import { NavLink, Outlet } from 'react-router-dom';
import styles from './Manager.module.css';
import { Header } from '../../shared/ui/Header';
import { Footer } from '../../shared/ui/Footer';
import { PageTransition } from '../../shared/motion/PageTransition';
import { ManagerProvider, useManager } from './ManagerContext';
import { mgr } from './strings';
import { AppSelect } from '../../shared/ui/AppSelect';

const nav = [
  { to: '/manager', label: mgr.nav.overview, end: true },
  { to: '/manager/trainees', label: mgr.nav.trainees },
  { to: '/manager/completion', label: mgr.nav.completion },
  { to: '/manager/payments', label: mgr.nav.payments },
  { to: '/manager/nudge', label: mgr.nav.nudge },
  { to: '/manager/reports', label: mgr.nav.reports },
];

function CompanySelector() {
  const { companies, companyCode, setCompanyCode, loading, error, company } = useManager();
  return (
    <div className={styles.company}>
      <label htmlFor="mgr-company">{mgr.company.label}</label>
      <AppSelect id="mgr-company" value={companyCode} onValueChange={setCompanyCode} disabled={!!error} loading={loading} icon="building"
        options={[{ value: '', label: loading ? '불러오는 중…' : mgr.company.all }, ...companies.map((c) => ({ value: c.companyCode, label: c.companyName ?? c.companyCode }))]} />
      <small>{error ? mgr.company.none : company ? `${company.companyCode} · ${mgr.company.trainees(company.trainees)}` : companies.length ? `${companies.length}개 기업 · 전체 합계` : loading ? '' : mgr.company.none}</small>
    </div>
  );
}

/** 기업 교육담당자 shell (AR-21): public header/footer + side navigation with the company selector. */
export default function ManagerShell() {
  return (
    <ManagerProvider>
      <div className={styles.shell}>
        <Header />
        <main id="main" className={styles.main} tabIndex={-1}>
          <div className={styles.room}>
            <aside className={styles.side}>
              <h2>{mgr.title}</h2>
              <CompanySelector />
              <nav aria-label={mgr.title}>{nav.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}</nav>
            </aside>
            <div className={styles.content}><PageTransition><Outlet /></PageTransition></div>
          </div>
        </main>
        <Footer />
      </div>
    </ManagerProvider>
  );
}
