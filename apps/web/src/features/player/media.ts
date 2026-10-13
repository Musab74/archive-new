/** Resolves a chapter URL from the API ("/contents/D00001/01.mp4") against VITE_MEDIA_BASE (media origin) when set. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const base = ((import.meta.env?.VITE_MEDIA_BASE as string | undefined) ?? '').replace(/\/+$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

/** Legacy PHP identity-verification popup (interim until the SPA has its own 본인인증 flow). */
export const IDENTITY_POPUP_URL = 'https://www.hrdeedu.co.kr/player/motp.php';

/**
 * Packaged-HTML (type A) chapter URL: picks `mobileUrl` on narrow viewports (≤768px, like the PHP user-agent switch),
 * resolves it like media, and appends `resume=<sec>` the way player2.php did so packages that honour it can seek.
 */
export function resolvePackageUrl(chapter: { url?: string | null; mobileUrl?: string | null }, resumeSec: number, mobile: boolean): string | null {
  const raw = (mobile ? chapter.mobileUrl || chapter.url : chapter.url || chapter.mobileUrl) ?? null;
  const base = resolveMediaUrl(raw);
  if (!base) return null;
  const sec = Math.max(0, Math.floor(resumeSec || 0));
  if (sec <= 0) return base;
  const [pathAndQuery, hash] = base.split('#', 2);
  const joined = `${pathAndQuery}${pathAndQuery.includes('?') ? '&' : '?'}resume=${sec}`;
  return hash !== undefined ? `${joined}#${hash}` : joined;
}

/** Narrow-viewport check for the package URL choice; false in non-browser environments. */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try { return window.matchMedia('(max-width: 768px)').matches; } catch { return false; }
}
