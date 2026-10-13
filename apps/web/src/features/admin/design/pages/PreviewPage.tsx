import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import styles from '../../Admin.module.css';
import { designApi } from '../../../../shared/api/endpoints/design';
import { AButton, ASelect, Callout, Card, TabStrip } from '../../../../shared/ui/admin';
import { useDesignStudio } from '../DesignStudioContext';
import { adm } from '../../strings';

const VIEWPORTS = [{ key: '1440', label: '데스크톱 1440' }, { key: '1024', label: '태블릿 1024' }, { key: '768', label: '태블릿 768' }, { key: '390', label: '모바일 390' }];
const PAGES = [{ value: '/', label: '메인 /' }, { value: '/catalog', label: '콘텐츠 탐색 /catalog' }, { value: '/ai-zone', label: 'AI ZONE /ai-zone' }];

/** Public site origin that renders the preview (same origin → postMessage live updates work). */
export function previewOrigin(): string {
  const env = (import.meta.env?.VITE_PUBLIC_WEB_URL as string | undefined)?.replace(/\/+$/, '');
  return env || window.location.origin;
}
export function previewUrl(origin: string, page: string, token: string): string { return `${origin}${page}?designPreview=${encodeURIComponent(token)}`; }

export default function PreviewPage() {
  const { draft } = useDesignStudio();
  const [vp, setVp] = useState('1440');
  const [page, setPage] = useState('/');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const token = useQuery({ queryKey: ['design', 'preview-token'], queryFn: () => designApi.previewToken(), staleTime: 50 * 60_000 });
  const origin = previewOrigin();
  const url = token.data ? previewUrl(origin, page, token.data.token) : null;

  const push = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !draft) return;
    try { win.postMessage({ type: 'design:preview', config: draft }, origin); } catch { /* cross-origin */ }
  }, [draft, origin]);

  // The DesignProvider in the iframe posts {type:'design:ready'}; push the draft then and on every change.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.origin === origin && (e.data as { type?: string } | null)?.type === 'design:ready') { setReady(true); push(); } };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [origin, push]);
  useEffect(() => { if (ready) push(); }, [draft, ready, push]);

  const width = Number(vp);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <TabStrip label={adm.design.preview.viewport} items={VIEWPORTS} value={vp} onChange={setVp} />
          <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>{adm.design.preview.page}<ASelect value={page} onChange={(e) => { setPage(e.target.value); setReady(false); }} options={PAGES} style={{ width: 220 }} /></label>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <AButton size="sm" onClick={() => { setReady(false); void token.refetch(); }} loading={token.isFetching}>{adm.design.preview.refresh}</AButton>
            {url ? <AButton size="sm" onClick={() => window.open(url, '_blank', 'noopener')}>{adm.design.preview.open} ↗</AButton> : null}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{adm.design.preview.note}{origin !== window.location.origin ? ` (미리보기 출처 ${origin} — 다른 출처라 초안 즉시 반영은 비활성화)` : ''}</p>
      </Card>
      {token.isError ? <Callout tone="warn">미리보기 토큰을 발급하지 못했습니다.</Callout> : null}
      <div className={styles.previewFrame}>
        <div className={styles.device} style={{ width: width + 20, maxWidth: '100%' }}>
          {url ? <iframe ref={iframeRef} key={url} title={`${adm.design.nav.preview} ${vp}`} src={url} style={{ height: width < 500 ? 844 : 760 }} onLoad={() => { setReady(true); push(); }} /> : <div style={{ height: 400 }} />}
        </div>
      </div>
    </div>
  );
}
