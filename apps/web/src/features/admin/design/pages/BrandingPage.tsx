import { useState } from 'react';
import type { MediaAsset } from '@ainex/contracts';
import styles from '../../Admin.module.css';
import { AButton, AInput, Card, FieldRow } from '../../../../shared/ui/admin';
import { useDesignStudio } from '../DesignStudioContext';
import { MediaPicker, useMediaLibrary } from '../MediaPicker';
import { adm } from '../../strings';

type Slot = 'logoAssetId' | 'faviconAssetId' | 'heroAssetId';

function AssetField({ slot, label, value, onPick, onClear, disabled, assets }: { slot: Slot; label: string; value: string | null; onPick: () => void; onClear: () => void; disabled: boolean; assets: MediaAsset[] }) {
  const asset = value ? assets.find((a) => a.id === value) : null;
  return (
    <FieldRow label={label} help={value && !asset ? `id ${value}` : undefined}>
      <div className={styles.assetPick}>
        {asset ? <img src={asset.url} alt={asset.alt || asset.originalName} /> : <div className="ph">{adm.design.branding.none}</div>}
        <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
          <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset ? asset.originalName : value ?? '—'}</b>
          {asset ? <span className="muted">{asset.width && asset.height ? `${asset.width}×${asset.height}` : asset.mimeType}</span> : null}
        </div>
        <AButton size="sm" onClick={onPick} disabled={disabled} data-slot={slot}>{adm.design.branding.pick}</AButton>
        <AButton size="sm" variant="ghost" onClick={onClear} disabled={disabled || !value}>{adm.design.branding.clear}</AButton>
      </div>
    </FieldRow>
  );
}

export default function BrandingPage() {
  const { draft, update, canWrite } = useDesignStudio();
  const media = useMediaLibrary();
  const [picking, setPicking] = useState<Slot | null>(null);
  if (!draft) return null;
  const b = draft.branding;
  const t = adm.design.branding;
  const set = (patch: Partial<typeof b>) => update((d) => ({ ...d, branding: { ...d.branding, ...patch } }));
  const assets = media.data?.items ?? [];
  const slotLabel: Record<Slot, string> = { logoAssetId: t.logo, faviconAssetId: t.favicon, heroAssetId: t.hero };
  return (
    <Card title={adm.design.nav.branding}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
        <FieldRow label={t.siteName} htmlFor="br-name" required><AInput id="br-name" value={b.siteName} onChange={(e) => set({ siteName: e.target.value })} maxLength={60} disabled={!canWrite} invalid={!b.siteName.trim()} /></FieldRow>
        <FieldRow label={t.tagline} htmlFor="br-tag"><AInput id="br-tag" value={b.tagline} onChange={(e) => set({ tagline: e.target.value })} maxLength={120} disabled={!canWrite} /></FieldRow>
        <AssetField slot="logoAssetId" label={t.logo} value={b.logoAssetId} assets={assets} onPick={() => setPicking('logoAssetId')} onClear={() => set({ logoAssetId: null })} disabled={!canWrite} />
        <FieldRow label={t.logoAlt} htmlFor="br-alt" help="스크린리더가 읽는 로고 설명 (예: 회사명)"><AInput id="br-alt" value={b.logoAlt} onChange={(e) => set({ logoAlt: e.target.value })} maxLength={120} disabled={!canWrite} /></FieldRow>
        <AssetField slot="faviconAssetId" label={t.favicon} value={b.faviconAssetId} assets={assets} onPick={() => setPicking('faviconAssetId')} onClear={() => set({ faviconAssetId: null })} disabled={!canWrite} />
        <AssetField slot="heroAssetId" label={t.hero} value={b.heroAssetId} assets={assets} onPick={() => setPicking('heroAssetId')} onClear={() => set({ heroAssetId: null })} disabled={!canWrite} />
      </div>
      <MediaPicker open={picking !== null} onClose={() => setPicking(null)} title={`${slotLabel[picking ?? 'logoAssetId']} ${t.pick}`} selectedId={picking ? b[picking] : null} onPick={(a) => { if (picking) set({ [picking]: a.id } as Partial<typeof b>); }} />
    </Card>
  );
}
