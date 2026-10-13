import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MediaAsset } from '@ainex/contracts';
import styles from '../Admin.module.css';
import { designApi } from '../../../shared/api/endpoints/design';
import { Modal } from '../../../shared/ui/Modal';
import { AButton, Callout } from '../../../shared/ui/admin';
import { cx } from '../../../shared/utils/format';
import { adm } from '../strings';

export function useMediaLibrary(page = 1, size = 48) {
  return useQuery({ queryKey: ['design', 'media', page, size], queryFn: ({ signal }) => designApi.media(page, size, signal), staleTime: 30_000 });
}

export const fmtBytes = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

/** Modal grid to pick an uploaded image (logo / favicon / hero). */
export function MediaPicker({ open, onClose, onPick, title, selectedId }: { open: boolean; onClose: () => void; onPick: (asset: MediaAsset) => void; title: string; selectedId?: string | null }) {
  const q = useMediaLibrary();
  const [picked, setPicked] = useState<MediaAsset | null>(null);
  const items = q.data?.items ?? [];
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg" actions={<><AButton onClick={onClose}>{adm.common.cancel}</AButton><AButton variant="primary" disabled={!picked} onClick={() => { if (picked) { onPick(picked); onClose(); } }}>{adm.common.apply}</AButton></>}>
      {q.isError ? <Callout tone="warn">목록을 불러오지 못했습니다.</Callout> : items.length === 0 && !q.isPending ? <Callout>업로드된 이미지가 없습니다. 미디어 라이브러리에서 먼저 업로드해 주세요.</Callout> : (
        <div className={styles.mediaGrid} role="listbox" aria-label={title}>
          {items.map((a) => (
            <button key={a.id} type="button" role="option" aria-selected={(picked?.id ?? selectedId) === a.id} className={cx(styles.mediaCard, (picked?.id ?? selectedId) === a.id && styles.picked)} onClick={() => setPicked(a)} onDoubleClick={() => { onPick(a); onClose(); }} style={{ textAlign: 'left', padding: 0 }}>
              <div className={styles.mediaThumb}><img src={a.url} alt={a.alt || a.originalName} loading="lazy" /></div>
              <div className={styles.mediaMeta}><b title={a.originalName}>{a.originalName}</b><span>{a.width && a.height ? `${a.width}×${a.height} · ` : ''}{fmtBytes(a.size)}</span></div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
