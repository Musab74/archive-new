import { useRef, useState, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MediaAsset } from '@ainex/contracts';
import styles from '../../Admin.module.css';
import { designApi } from '../../../../shared/api/endpoints/design';
import { isAppError } from '../../../../shared/api/client';
import { useToast } from '../../../../app/providers/ToastProvider';
import { AButton, AInput, Callout, Card, ConfirmDialog, StatusBadge } from '../../../../shared/ui/admin';
import { cx } from '../../../../shared/utils/format';
import { useAdminMutation } from '../../useAdminMutation';
import { useDesignStudio } from '../DesignStudioContext';
import { fmtBytes, useMediaLibrary } from '../MediaPicker';
import { adm } from '../../strings';
import { tr } from '../../../../shared/i18n/adminLang';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico,.svg';

/** Usage badges: which branding slot (draft / live) references the asset. */
export function usageOf(id: string, draft: { logoAssetId: string | null; faviconAssetId: string | null; heroAssetId: string | null } | null, live: typeof draft): string[] {
  const u = adm.design.media.usage;
  const out: string[] = [];
  if (draft?.logoAssetId === id) out.push(u.draftLogo);
  if (draft?.faviconAssetId === id) out.push(u.draftFavicon);
  if (draft?.heroAssetId === id) out.push(u.draftHero);
  if (live?.logoAssetId === id) out.push(u.liveLogo);
  if (live?.faviconAssetId === id) out.push(u.liveFavicon);
  if (live?.heroAssetId === id) out.push(u.liveHero);
  return out;
}

function MediaCard({ a, usage, canWrite, onDelete }: { a: MediaAsset; usage: string[]; canWrite: boolean; onDelete: () => void }) {
  const [alt, setAlt] = useState(a.alt);
  const save = useAdminMutation({ fn: (v: string) => designApi.updateMediaAlt(a.id, v), invalidate: [['design', 'media']], success: adm.design.media.altSaved });
  return (
    <div className={styles.mediaCard}>
      <div className={styles.mediaThumb}><img src={a.url} alt={a.alt || a.originalName} loading="lazy" /></div>
      <div className={styles.mediaMeta}>
        <b title={a.originalName}>{a.originalName}</b>
        <span>{a.width && a.height ? `${a.width}×${a.height} · ` : ''}{fmtBytes(a.size)} · {a.mimeType.replace('image/', '')}</span>
        <span>{a.createdBy} · {a.createdAt.replace('T', ' ').slice(0, 16)}</span>
        {usage.length ? <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{usage.map((u) => <StatusBadge key={u} tone={u.startsWith(tr('게시', 'Live')) ? 'ok' : 'info'}>{u}</StatusBadge>)}</span> : null}
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span className="sr-only">{adm.design.media.alt}</span><AInput value={alt} onChange={(e) => setAlt(e.target.value)} placeholder={adm.design.media.alt} maxLength={120} disabled={!canWrite} style={{ height: 28, fontSize: 12 }} /><AButton size="xs" onClick={() => save.mutate(alt)} disabled={!canWrite || alt === a.alt} loading={save.isPending}>{adm.common.save}</AButton></label>
      </div>
      <div className={styles.mediaActions}>
        <AButton size="xs" onClick={() => { void navigator.clipboard?.writeText(a.url); }}>{tr('URL 복사', 'Copy URL')}</AButton>
        <AButton size="xs" variant="danger" onClick={onDelete} disabled={!canWrite || usage.length > 0} title={usage.length ? adm.design.media.inUse : undefined}>{adm.common.delete}</AButton>
      </div>
    </div>
  );
}

export default function MediaPage() {
  const { draft, live, canWrite } = useDesignStudio();
  const q = useMediaLibrary();
  const qc = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [del, setDel] = useState<MediaAsset | null>(null);
  const remove = useAdminMutation({ fn: (id: string) => designApi.deleteMedia(id), invalidate: [['design', 'media']], success: adm.design.media.deleted, onSuccess: () => setDel(null), onError: (err) => { setDel(null); toast(isAppError(err) && err.status === 409 ? adm.design.media.inUse : isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' }); } });

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(ico|svg)$/i.test(f.name));
    if (!list.length) return;
    setUploading(list.length);
    for (const f of list) {
      try { await designApi.uploadMedia(f, f.name.replace(/\.[^.]+$/, '')); toast(`${f.name}: ${adm.design.media.uploaded}`, { tone: 'ok' }); } catch (err) { toast(`${f.name}: ${isAppError(err) ? err.message : adm.common.failed}`, { tone: 'danger', duration: 8000 }); }
      setUploading((n) => n - 1);
    }
    void qc.invalidateQueries({ queryKey: ['design', 'media'] });
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (!canWrite) return; void upload(e.dataTransfer.files); };
  const items = q.data?.items ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title={adm.design.media.title} aside={<span className="muted" style={{ fontSize: 12 }}>{adm.common.total(q.data?.total ?? 0)}</span>}>
        <div className={cx(styles.drop, over && styles.over)} role="button" tabIndex={canWrite ? 0 : -1} aria-disabled={!canWrite} onClick={() => canWrite && inputRef.current?.click()} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canWrite) inputRef.current?.click(); }} onDragOver={(e) => { e.preventDefault(); if (canWrite) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
          <b>{uploading ? tr(`업로드 중… (${uploading})`, `Uploading… (${uploading})`) : adm.design.media.drop}</b><br /><span>{adm.design.media.hint}</span>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
        </div>
        {!canWrite ? <Callout tone="warn" className="u-mt-8">{adm.readOnly}</Callout> : null}
      </Card>
      {q.isError ? <Callout tone="warn">{tr('목록을 불러오지 못했습니다.', 'Could not load the list.')}</Callout> : items.length === 0 && !q.isPending ? <Callout>{tr('업로드된 이미지가 없습니다.', 'No images uploaded yet.')}</Callout> : (
        <div className={styles.mediaGrid}>
          {items.map((a) => <MediaCard key={a.id} a={a} usage={usageOf(a.id, draft?.branding ?? null, live?.config.branding ?? null)} canWrite={canWrite} onDelete={() => setDel(a)} />)}
        </div>
      )}
      <ConfirmDialog open={!!del} title={`${adm.common.delete} · ${del?.originalName ?? ''}`} body={adm.design.media.deleteBody} tone="danger" confirmLabel={adm.common.delete} loading={remove.isPending} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} />
    </div>
  );
}
