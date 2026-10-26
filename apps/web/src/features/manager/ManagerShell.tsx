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

/** sections/manager-company-filter-ui.php: "사업장 전체 / 사업장" select, shown only for managers with 2+ companies. */
function CompanySelector() {
  const { companies, companyCode, setCompanyCode, loading, error, company, multiCompany } = useManager();
  if (error) return <div className={styles.company}><small>{mgr.company.none}</small></div>;
  if (!loading && !multiCompany) {
    const only = companies[0];
    return only ? <div className={styles.company}><label>{mgr.company.label}</label><b>{only.companyName}</b><small>{only.companyCode} · {mgr.company.trainees(only.trainees)}</small></div> : null;
  }
  return (
    <div className={styles.company}>
      <label htmlFor="mgr-company">{mgr.company.label}</label>
      <AppSelect id="mgr-company" value={companyCode} onValueChange={setCompanyCode} loading={loading} icon="building"
        options={[{ value: '', label: loading ? '불러오는 중…' : mgr.company.all }, ...companies.map((c) => ({ value: c.companyCode, label: c.companyName }))]} />
      <small>{company ? `${company.companyCode} · ${mgr.company.trainees(company.trainees)}${company.primary ? ` · ${mgr.company.primary}` : ''}` : companies.length ? `${companies.length}개 기업 · 전체 합계` : ''}</small>
    </div>
  );
}

/** 기업 교육담당자 shell (AR-21): public header/footer + side navigation with the 사업장 selector. */
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
