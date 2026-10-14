import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DesignVersionMeta } from '@ainex/contracts';
import styles from '../../Admin.module.css';
import { designApi } from '../../../../shared/api/endpoints/design';
import { AButton, Callout, Card, ConfirmDialog, DataTable, JsonViewer, StatusBadge, type Column } from '../../../../shared/ui/admin';
import { useAdminMutation } from '../../useAdminMutation';
import { useDesignStudio } from '../DesignStudioContext';
import { MiniSite } from '../ThemePreviewCard';
import { diffConfigs, isHex } from '../designHelpers';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';

const Val = ({ v }: { v: string }) => (isHex(v) ? <span><span className={styles.colorChip} style={{ background: v }} />{v}</span> : <span>{v || <span className="muted">{tr('(없음)', '(none)')}</span>}</span>);

export default function VersionsPage() {
  const { draft, live, adopt, refetchLive } = useDesignStudio();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['design', 'versions'], queryFn: ({ signal }) => designApi.versions(signal) });
  const [sel, setSel] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const snap = useQuery({ queryKey: ['design', 'version', sel], queryFn: ({ signal }) => designApi.version(sel as number, signal), enabled: sel !== null });
  const restore = useAdminMutation({ fn: (n: number) => designApi.restore(n), success: (r) => adm.design.versions.restored(r.versionNumber), onSuccess: async () => { setConfirm(null); void qc.invalidateQueries({ queryKey: ['design'] }); refetchLive(); const d = await designApi.draft(); adopt(d.config, d.baseVersion); } });
  const v = adm.design.versions;
  const cols: Column<DesignVersionMeta>[] = [
    { key: 'versionNumber', header: v.cols.n, align: 'right', sortable: true, render: (r) => <b>v{r.versionNumber} {live?.versionNumber === r.versionNumber ? <StatusBadge tone="ok">{tr('게시 중', 'Live')}</StatusBadge> : null}</b> },
    { key: 'publishedAt', header: v.cols.at, nowrap: true, sortable: true, render: (r) => r.publishedAt.replace('T', ' ').slice(0, 19) },
    { key: 'publishedBy', header: v.cols.by },
    { key: 'description', header: v.cols.desc, render: (r) => r.description || <span className="muted">—</span> },
    { key: 'checksum', header: v.cols.checksum, render: (r) => <span className="mono muted" style={{ fontSize: 11 }}>{r.checksum.slice(0, 12)}</span> },
    { key: '_act', header: '', width: 120, render: (r) => <AButton size="xs" variant={live?.versionNumber === r.versionNumber ? 'default' : 'primary'} onClick={(e) => { e.stopPropagation(); setConfirm(r.versionNumber); }} disabled={live?.versionNumber === r.versionNumber}>{v.restore}</AButton> },
  ];
  const diff = snap.data && draft ? diffConfigs(snap.data.config, draft) : [];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
      <Card title={adm.design.nav.versions}><DataTable columns={cols} rows={list.data} rowKey={(r) => r.versionNumber} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} onRowClick={(r) => setSel(r.versionNumber)} selectedKey={sel} dense size={20} /></Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sel === null ? <Callout>{tr('버전을 선택하면 스냅샷과 현재 초안과의 차이를 보여줍니다.', 'Select a version to see its snapshot and the diff against the current draft.')}</Callout> : snap.isPending ? <Callout>{adm.common.loading}</Callout> : snap.isError ? <Callout tone="warn">{tr('스냅샷을 불러오지 못했습니다.', 'Could not load the snapshot.')}</Callout> : snap.data ? (
          <>
            <Card title={`${v.snapshot} · v${snap.data.versionNumber}`} aside={<AButton size="sm" variant="primary" onClick={() => setConfirm(snap.data.versionNumber)} disabled={live?.versionNumber === snap.data.versionNumber}>{v.restore}</AButton>}>
              <MiniSite config={snap.data.config} />
              <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{snap.data.publishedBy} · {snap.data.publishedAt.replace('T', ' ').slice(0, 19)} · {snap.data.description || '—'}</p>
            </Card>
            <Card title={`${v.diff} (${diff.length})`}>
              {diff.length ? (
                <div className="tableWrap" style={{ overflow: 'auto' }}>
                  <table className={styles.diffTable} style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead><tr><th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--c-line-2)' }}>{v.diffCols.path}</th><th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--c-line-2)' }}>{v.diffCols.version}</th><th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--c-line-2)' }}>{v.diffCols.draft}</th></tr></thead>
                    <tbody>{diff.map((d) => <tr key={d.path}><td style={{ padding: 6, borderBottom: '1px solid var(--c-line-2)' }} className="mono">{d.path}</td><td style={{ padding: 6, borderBottom: '1px solid var(--c-line-2)' }}><Val v={d.a} /></td><td style={{ padding: 6, borderBottom: '1px solid var(--c-line-2)' }}><Val v={d.b} /></td></tr>)}</tbody>
                  </table>
                </div>
              ) : <Callout tone="ok">{v.noDiff}</Callout>}
            </Card>
            <details><summary style={{ fontSize: 13, cursor: 'pointer' }}>{tr('전체 설정 JSON', 'Full config JSON')}</summary><div className="u-mt-8"><JsonViewer value={snap.data.config} /></div></details>
          </>
        ) : null}
      </div>
      <ConfirmDialog open={confirm !== null} title={`${v.restore} · v${confirm ?? ''}`} body={v.restoreBody} tone="warn" confirmLabel={v.restore} loading={restore.isPending} onCancel={() => setConfirm(null)} onConfirm={() => confirm !== null && restore.mutate(confirm)} />
    </div>
  );
}
