import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import styles from '../Admin.module.css';
import { AButton, AdminPage, Callout, StatusBadge } from '../../../shared/ui/admin';
import { StateBlock } from '../../../shared/ui/StateBlock';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { DesignStudioProvider, useDesignStudio } from './DesignStudioContext';
import { PublishDialog } from './PublishDialog';
import { adm } from '../strings';

const NAV: { key: string; to: string; end?: boolean }[] = [
  { key: 'overview', to: '/admin/design', end: true }, { key: 'presets', to: '/admin/design/presets' }, { key: 'tokens', to: '/admin/design/tokens' }, { key: 'typography', to: '/admin/design/typography' }, { key: 'branding', to: '/admin/design/branding' },
  { key: 'media', to: '/admin/design/media' }, { key: 'layout', to: '/admin/design/layout' }, { key: 'links', to: '/admin/design/links' }, { key: 'preview', to: '/admin/design/preview' }, { key: 'versions', to: '/admin/design/versions' }, { key: 'audit', to: '/admin/design/audit' },
];

function Bar() {
  const { server, dirty, canWrite, saveState, issues, save, discard, reload, loading } = useDesignStudio();
  const [publishOpen, setPublishOpen] = useState(false);
  const errors = issues.filter((i) => i.level === 'error').length;
  return (
    <>
      <div className={styles.dsBar} role="toolbar" aria-label={adm.design.title}>
        <span className={styles.grow}>
          {server ? <>{adm.design.overview.baseVersion} v{server.baseVersion} · {adm.design.overview.updatedBy} {server.updatedBy} · {server.updatedAt.replace('T', ' ').slice(0, 19)}</> : loading ? adm.common.loading : null}
          {dirty ? <span className={styles.dsDirty}> · {adm.design.dirty}</span> : null}
          {errors ? <> · <StatusBadge tone="danger">{adm.design.overview.errors(errors)}</StatusBadge></> : null}
        </span>
        {saveState === 'conflict' ? <AButton variant="danger" onClick={() => void reload()}>{adm.design.actions.reload}</AButton> : null}
        <AButton onClick={discard} disabled={!dirty}>{adm.design.actions.discard}</AButton>
        <AButton to="/admin/design/preview">{adm.design.actions.preview}</AButton>
        <AButton variant="primary" onClick={() => void save()} disabled={!canWrite || !dirty || saveState === 'saving'} loading={saveState === 'saving'} title={canWrite ? undefined : adm.readOnly}>{adm.design.actions.save}</AButton>
        <AButton variant="primary" onClick={() => setPublishOpen(true)} disabled={!canWrite || !server} title={canWrite ? undefined : adm.readOnly}>{adm.design.actions.publish}</AButton>
      </div>
      {saveState === 'conflict' ? <Callout tone="warn" className="u-mb-8">{adm.design.conflict}</Callout> : null}
      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
    </>
  );
}

function Body() {
  const { draft, loading, error, reload } = useDesignStudio();
  const location = useLocation();
  return (
    <AdminPage title={adm.design.title} lead={adm.design.lead}>
      <div className={styles.ds}>
        <nav className={styles.dsNav} aria-label={adm.design.title}>
          {NAV.map((n) => <NavLink key={n.key} to={n.to} end={n.end}>{adm.design.nav[n.key as keyof typeof adm.design.nav]}</NavLink>)}
        </nav>
        <div className={styles.dsMain}>
          <Bar />
          {error ? <StateBlock code="LIST_ERROR" center onRetry={() => void reload()} /> : loading || !draft ? <Skeleton lines={8} /> : <div key={location.pathname}><Outlet /></div>}
        </div>
      </div>
    </AdminPage>
  );
}

/** /admin/design/* — provider + side nav + save/publish bar. */
export default function DesignLayout() {
  return <DesignStudioProvider><Body /></DesignStudioProvider>;
}
