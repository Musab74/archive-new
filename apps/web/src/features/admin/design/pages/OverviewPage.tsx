import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AButton, Callout, Card, DescList, StatusBadge } from '../../../../shared/ui/admin';
import { useDesignStudio } from '../DesignStudioContext';
import { MiniSite, Swatches } from '../ThemePreviewCard';
import { PublishDialog, IssueList } from '../PublishDialog';
import { diffConfigs } from '../designHelpers';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';

export default function DesignOverviewPage() {
  const { draft, server, live, dirty, issues, canWrite } = useDesignStudio();
  const [publishOpen, setPublishOpen] = useState(false);
  if (!draft || !server) return null;
  const o = adm.design.overview;
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.length - errors;
  const changedVsLive = live ? diffConfigs(live.config, draft).length : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Card title={o.active} aside={live ? <StatusBadge tone="ok">v{live.versionNumber}</StatusBadge> : <StatusBadge>—</StatusBadge>}>
        {live ? <><MiniSite config={live.config} /><div className="u-mt-8"><DescList items={[[o.publishedAt, live.publishedAt?.replace('T', ' ').slice(0, 19)], ['ETag', <span key="e" className="mono">{live.etag}</span>], [tr('프리셋', 'Preset'), live.config.presetId], [tr('테마', 'Theme'), <Swatches key="s" theme={live.config.theme} />]]} /></div></> : <Callout>{tr('게시된 디자인을 불러오지 못했습니다 (GET /public/design).', 'Could not load the published design (GET /public/design).')}</Callout>}
      </Card>
      <Card title={o.draft} aside={dirty ? <StatusBadge tone="warn">{adm.design.dirty}</StatusBadge> : <StatusBadge tone="info">{tr('저장됨', 'Saved')}</StatusBadge>}>
        <MiniSite config={draft} />
        <div className="u-mt-8"><DescList items={[[o.baseVersion, `v${server.baseVersion}`], [o.updatedBy, `${server.updatedBy} · ${server.updatedAt.replace('T', ' ').slice(0, 19)}`], [tr('프리셋', 'Preset'), draft.presetId], [tr('테마', 'Theme'), <Swatches key="s" theme={draft.theme} />], [tr('게시본과 차이', 'Changes vs live'), changedVsLive === null ? '—' : changedVsLive ? <Link key="d" to="/admin/design/versions">{tr(`${changedVsLive}개 토큰 변경`, `${changedVsLive} token${changedVsLive === 1 ? '' : 's'} changed`)}</Link> : tr('없음', 'None')]]} /></div>
      </Card>
      <Card title={o.issues} aside={errors ? <StatusBadge tone="danger">{o.errors(errors)}</StatusBadge> : <StatusBadge tone="ok">{o.noIssues}</StatusBadge>}>
        <IssueList issues={issues} />
        {warnings ? <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{o.warnings(warnings)} · {adm.design.publish.warnings}</p> : null}
        <div className="u-mt-16" style={{ display: 'flex', gap: 8 }}><AButton variant="primary" onClick={() => setPublishOpen(true)} disabled={!canWrite} title={canWrite ? undefined : adm.readOnly}>{adm.design.actions.publish}</AButton><AButton to="/admin/design/tokens">{adm.design.nav.tokens}</AButton></div>
      </Card>
      <Card title={o.quick}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['presets', 'tokens', 'typography', 'branding', 'media', 'layout', 'links', 'preview', 'versions', 'audit'] as const).map((k) => <AButton key={k} size="sm" to={`/admin/design/${k}`}>{adm.design.nav[k]}</AButton>)}
        </div>
        <Callout className="u-mt-16">{adm.design.lead}</Callout>
      </Card>
      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
    </div>
  );
}
