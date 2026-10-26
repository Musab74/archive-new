import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from './SitePopups.module.css';
import { chromeApi, type SitePopup } from '../../shared/api/endpoints/chrome';
import { Icon } from '../../shared/ui/Icon';
import { popup as copy } from '../../shared/strings/ko';

/** popup_view.php mobile detection (User-Agent), so a phone gets the saved mobile image / size / position. */
const MOBILE_UA = /(iPod|iPhone|Android|BlackBerry|SymbianOS|SCH-M\d+|Opera Mini|Windows CE|Nokia|SonyEricsson|webOS|PalmOS)/;
export const isMobileAgent = (ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent) => MOBILE_UA.test(ua);

/** include_popup.php hrdePopupTodayKey(): local 'YYYY-MM-DD'. */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const cookieName = (idx: number) => `Popup${idx}`;

/** isPopupHiddenToday(): cookie Popup<idx> set (≠ '' / '0'), or the local/session storage key holds today's date. */
export function isHiddenToday(idx: number, now = new Date()): boolean {
  const name = cookieName(idx);
  const c = document.cookie.split('; ').find((x) => x.split('=')[0] === name)?.split('=')[1];
  if (c && c !== '0') return true;
  const key = `hrde_hide_${name}`;
  for (const store of [safeStorage('local'), safeStorage('session')]) {
    const v = store?.getItem(key);
    if (v === todayKey(now)) return true;
    if (v) store?.removeItem(key);
  }
  return false;
}

/** hidePopupToday(): cookie until 23:59:59 today + both storages (Safari / in-app browsers drop some cookies). */
export function hideToday(idx: number, now = new Date()): void {
  const name = cookieName(idx);
  const expire = new Date(now);
  expire.setHours(23, 59, 59, 999);
  const maxAge = Math.max(1, Math.floor((expire.getTime() - now.getTime()) / 1000));
  document.cookie = `${name}=1; expires=${expire.toUTCString()}; max-age=${maxAge}; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  for (const store of [safeStorage('local'), safeStorage('session')]) store?.setItem(`hrde_hide_${name}`, todayKey(now));
}

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
}

/** A link target the popup may open: http(s) or a site path; `javascript:` links from the old admin are not executed. */
const safeUrl = (url: string) => (/^(https?:)?\/\//i.test(url) || url.startsWith('/') ? url : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url) ? `https://${url}` : null);

function PopupLayer({ p, mobile, onClose }: { p: SitePopup; mobile: boolean; onClose: (today: boolean) => void }) {
  const box = mobile && p.mobile ? p.mobile : p;
  const mapName = `links-popup-${p.idx}`;
  const areas = p.links.filter((l) => l.area.trim() && safeUrl(l.url));
  const single = !areas.length && p.links.length === 1 ? safeUrl(p.links[0]!.url) : null;
  const img = box.imageUrl ? <img src={box.imageUrl} alt={p.title} useMap={areas.length ? `#${mapName}` : undefined} /> : <span className={styles.fallback}>{p.title}</span>;
  // popup_view.php: position:fixed at the saved left/top, width + 6 (border/padding), max-width 100vw − 20 px; kept inside the viewport
  const vw = typeof window === 'undefined' ? 1920 : window.innerWidth;
  const width = Math.min(box.width + 6, vw - 20);
  const left = Math.max(10, Math.min(box.left, vw - width - 10));
  return (
    <div className={styles.layer} role="dialog" aria-label={p.title || copy.region} style={{ left, top: Math.max(0, box.top), width }}>
      {areas.length ? (
        <map name={mapName}>
          {areas.map((l) => <area key={l.num} shape="rect" coords={l.area} href={safeUrl(l.url)!} target="_blank" rel="noopener noreferrer" alt={p.title} />)}
        </map>
      ) : null}
      {single ? <a href={single} target="_blank" rel="noopener noreferrer">{img}</a> : img}
      <div className={styles.bar}>
        <label><input type="checkbox" onChange={(e) => { if (e.target.checked) onClose(true); }} /> {copy.hideToday}</label>
        <button type="button" onClick={() => onClose(false)} aria-label={copy.close}><Icon name="close" size={16} /></button>
      </div>
    </div>
  );
}

/**
 * popup/include_popup.php: every active popup (UseYN=Y, EndDate ≥ today), oldest first, at its saved position; 오늘 하루 창 열지 않기
 * hides it until midnight; never on the login page (the login form must stay unobstructed).
 */
export function SitePopups() {
  const { pathname } = useLocation();
  const onLogin = pathname.startsWith('/auth/login');
  const list = useQuery({ queryKey: ['site', 'popups'], queryFn: ({ signal }) => chromeApi.popups(signal), staleTime: 10 * 60_000, retry: false, enabled: !onLogin });
  const [closed, setClosed] = useState<number[]>([]);
  if (onLogin || !Array.isArray(list.data)) return null;
  const mobile = isMobileAgent();
  const shown = list.data.filter((p) => !closed.includes(p.idx) && !isHiddenToday(p.idx));
  if (!shown.length) return null;
  return (
    <div className={styles.root} aria-label={copy.region}>
      {shown.map((p) => <PopupLayer key={p.idx} p={p} mobile={mobile} onClose={(today) => { if (today) hideToday(p.idx); setClosed((c) => [...c, p.idx]); }} />)}
    </div>
  );
}
