import { useEffect, useState } from 'react';
import { AButton } from '../../../../shared/ui/admin';
import { useToast } from '../../../../app/providers/ToastProvider';
import { tr } from '../../../../shared/i18n/adminLang';

/**
 * The contents_read.php player popups as an inline preview:
 *  - FlashPlayer(url)        → flase_player.php: iframe of FlashServerURL + url (https:// kept as is)
 *  - MoviePlayer(url, 'A')   → movie_player.php: <video> of MovieServerURL + url;  MoviePlayer(url2, 'B') → iframe of the raw 예비 URL
 *  - MobilePlayer(url, 'A')  → mobile_player.php: <video> of MobileServerURL + url (https:// kept), 이전/다음 차시 stepping
 *    MobilePlayer(url2, 'B') → iframe of the raw URL
 * The IE8 / IE edge compatibility toggle of flase_player.php only affected Internet Explorer and has no effect in current browsers.
 */
export type PlayerKind = 'flash' | 'movie' | 'mobile';
export interface Player { kind: PlayerKind; sel: 'A' | 'B'; url: string }
export interface Servers { flash: string; movie: string; mobile: string }

export function playerSrc(p: Player, servers: Servers | undefined): string {
  if (p.sel === 'B') return p.url;
  if (/^https?:\/\//i.test(p.url)) return p.url;
  const base = (servers?.[p.kind] ?? '').replace(/\/+$/, '');
  return `${base}${p.url.startsWith('/') ? '' : '/'}${p.url}`;
}
export const playerIsVideo = (p: Player) => p.kind !== 'flash' && p.sel === 'A';

/** mobile_player.php changeVideo(): …/NN.mp4 → …/(NN±1).mp4 zero-padded to 2 digits. */
export function stepMp4(src: string, next: boolean): { ok: true; url: string } | { ok: false; message: string } {
  const m = /\/(\d+)\.mp4$/.exec(src);
  if (!m) return { ok: false, message: '영상 경로를 인식할 수 없습니다.' };
  const n = parseInt(m[1]!, 10) + (next ? 1 : -1);
  if (n < 1) return { ok: false, message: '이전 차시가 없습니다.' };
  return { ok: true, url: src.replace(/\/\d+\.mp4$/, `/${String(n).padStart(2, '0')}.mp4`) };
}

/**
 * The PHP popup checked the next file with fetch(HEAD) on its own origin. From this console the contents server is another
 * origin, so the check loads the video metadata instead (no CORS needed): true when it loads, false on error / 8 s timeout.
 */
export function probeVideo(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(false); return; }
    const v = document.createElement('video');
    let done = false;
    const finish = (ok: boolean) => { if (done) return; done = true; v.removeAttribute('src'); v.load?.(); resolve(ok); };
    const timer = setTimeout(() => finish(false), timeoutMs);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { clearTimeout(timer); finish(true); };
    v.onerror = () => { clearTimeout(timer); finish(false); };
    v.src = url;
  });
}

export function PlayerView({ player, servers }: { player: Player; servers: Servers | undefined }) {
  const { toast } = useToast();
  const first = playerSrc(player, servers);
  const [src, setSrc] = useState(first);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSrc(first); }, [first]);
  const step = async (next: boolean) => {
    const r = stepMp4(src, next);
    if (!r.ok) { toast(r.message, { tone: 'danger' }); return; }
    setBusy(true);
    const ok = await probeVideo(r.url);
    setBusy(false);
    if (ok) setSrc(r.url); else toast(next ? '마지막 차시입니다.' : '이전 차시가 없습니다.', { tone: 'danger' });
  };
  if (!playerIsVideo(player)) {
    return <iframe key={src} src={src} title={tr('컨텐츠 미리보기', 'Content preview')} style={{ width: '100%', height: player.kind === 'flash' ? 560 : 420, border: 0, background: '#fff' }} allow="autoplay; fullscreen" allowFullScreen />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <video key={src} src={src} controls autoPlay preload="metadata" style={{ width: '100%', background: '#000', borderRadius: 4 }} />
      {player.kind === 'mobile' ? (
        <>
          <div className="mono" style={{ fontSize: 12, fontWeight: 700, wordBreak: 'break-all' }}>URL: {src}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <AButton size="sm" loading={busy} onClick={() => void step(false)}>{tr('◀ 이전 차시', '◀ Previous')}</AButton>
            <AButton size="sm" loading={busy} onClick={() => void step(true)}>{tr('다음 차시 ▶', 'Next ▶')}</AButton>
          </div>
        </>
      ) : <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{src}</div>}
    </div>
  );
}
