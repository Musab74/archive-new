import { Outlet, useLocation } from 'react-router-dom';
import styles from './Support.module.css';
import { Tabs } from '../../shared/ui/Tabs';
import { Breadcrumb } from '../../shared/ui/Breadcrumb';
import { Button } from '../../shared/ui/Button';
import { support as copy, nav } from '../../shared/strings/ko';

/** AR-19 고객지원 shell: breadcrumb, hero, tab bar, outlet, contact strip. */
export default function SupportLayout() {
  const { pathname } = useLocation();
  const current = copy.tabs.find((t) => pathname.startsWith(t.to))?.key ?? 'guide';
  const tabItems = copy.tabs.map((t) => ({ key: t.key, label: t.label, to: t.to }));
  return (
    <>
      <section className={`band ${styles.hero}`}>
        <Breadcrumb items={[{ label: nav.archive, to: '/' }, { label: copy.crumb }]} />
        <span className="eyebrow">{copy.heroEyebrow}</span>
        <h1>{copy.heroTitle}</h1>
        <p>{copy.heroLead}</p>
      </section>
      <div className={styles.body}>
        <Tabs items={tabItems} value={current} label={copy.crumb} />
        <div style={{ paddingTop: 26 }}>
          <Outlet />
        </div>
        <div className={styles.contact}>
          <strong>{copy.contact.phone}</strong>
          <p>{copy.contact.hours}<br />{copy.contact.email}</p>
          <div className={styles.links}>
            <Button variant="secondary" square size="sm" to="/support/remote">{copy.remote.title}</Button>
            <Button variant="secondary" square size="sm" to="/auth/find-id">로그인·계정찾기</Button>
          </div>
        </div>
      </div>
    </>
  );
}
