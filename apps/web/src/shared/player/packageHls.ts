/**
 * Packaged (Type A) lessons keep their own page and player script (`/contents/<lesson>/<NN>/index.html`, source set from
 * main.js). When the API sends `chapter.hlsMap` (`/contents/<mp4>` → published master), this swaps each <video> in the
 * same-origin frame to its HLS version: hls.js loaded INTO the frame (its own realm, so MediaSource and the page's
 * event handlers stay together), native HLS where the browser has it, the original MP4 for anything not mapped.
 * The page's own `video.load()` calls are routed through the map, so section videos switched by the package swap too.
 */
export const PACKAGE_HLS_SCRIPT = '/vendor/hls-1.5.17.min.js';
const HLS_TYPE = 'application/vnd.apple.mpegurl';
const HLS_OPTIONS = { enableWorker: false, maxBufferLength: 30, maxMaxBufferLength: 60, backBufferLength: 30, capLevelToPlayerSize: true };

type HlsInstance = { loadSource(u: string): void; attachMedia(v: HTMLMediaElement): void; destroy(): void };
type HlsInstance2 = HlsInstance & { on(ev: string, cb: (e: unknown, d: { fatal?: boolean }) => void): void };
type HlsCtor = { new (o: object): HlsInstance2; isSupported(): boolean; Events: { ERROR: string } };
type WiredVideo = HTMLVideoElement & { __hlsWired?: boolean; __hls?: HlsInstance | null };

/** The map entry for a source as the page wrote it (relative to the frame's URL), or null. */
export function packageHlsUrl(map: Record<string, string>, src: string | null | undefined, baseHref: string): string | null {
  if (!src || src === '#') return null;
  let pathname: string;
  try { pathname = new URL(src, baseHref).pathname; } catch { return null; }
  try { pathname = decodeURIComponent(pathname); } catch { /* keep as is */ }
  return map[pathname] ?? null;
}

function sourceOf(v: HTMLVideoElement): string | null {
  return v.querySelector('source')?.getAttribute('src') || v.getAttribute('src') || v.currentSrc || null;
}

function wire(v: WiredVideo, win: Window & { Hls?: HlsCtor }, doc: Document, map: Record<string, string>) {
  if (v.__hlsWired) return;
  v.__hlsWired = true;
  const nativeLoad = HTMLMediaElement.prototype.load;
  const drop = () => { v.__hls?.destroy(); v.__hls = null; };
  /** Any HLS failure → the package's own MP4 (still in <source>), so the lesson always plays. */
  const toMp4 = () => { drop(); v.removeAttribute('src'); nativeLoad.call(v); };
  const swap = (): boolean => {
    const url = packageHlsUrl(map, sourceOf(v), doc.baseURI);
    if (!url) return false;
    const t = v.currentTime;
    const wasPlaying = !v.paused;
    drop();
    // hls.js first wherever it runs: recent Chrome answers canPlayType(HLS) = "maybe" but its built-in player cannot
    // play these fMP4 byte-range renditions (MEDIA_ERR_SRC_NOT_SUPPORTED). Native HLS only without MSE (iOS Safari).
    if (win.Hls?.isSupported()) { const h = new win.Hls(HLS_OPTIONS); h.on(win.Hls.Events.ERROR, (_e: unknown, d: { fatal?: boolean }) => { if (d?.fatal) toMp4(); }); h.loadSource(url); h.attachMedia(v); v.__hls = h; }
    else if (v.canPlayType(HLS_TYPE)) { v.src = url; v.addEventListener('error', toMp4, { once: true }); }
    else return false;
    v.addEventListener('loadedmetadata', () => { if (t > 0) v.currentTime = t; if (wasPlaying) void v.play().catch(() => undefined); }, { once: true });
    return true;
  };
  // the package calls load() after changing <source>; route it through the map
  v.load = () => { if (!swap()) { drop(); v.removeAttribute('src'); nativeLoad.call(v); } };
  swap();
}

/** Call on every frame load (each section page is a new document). No-op without a map or a same-origin frame. */
export function attachPackageHls(iframe: HTMLIFrameElement | null, map: Record<string, string> | null | undefined): void {
  if (!iframe || !map || !Object.keys(map).length) return;
  let win: (Window & { Hls?: HlsCtor }) | null = null;
  let doc: Document | null = null;
  try { win = iframe.contentWindow as Window & { Hls?: HlsCtor }; doc = iframe.contentDocument; } catch { return; }
  if (!win || !doc) return;
  const d = doc, w = win;
  const run = () => d.querySelectorAll('video').forEach((v) => wire(v as WiredVideo, w, d, map));
  // load hls.js into the frame wherever MSE exists (desktop browsers, Android); without MSE only native HLS can play
  const hasMse = 'MediaSource' in w || 'ManagedMediaSource' in w;
  if (w.Hls || !hasMse) { run(); return; }
  const s = d.createElement('script');
  s.src = PACKAGE_HLS_SCRIPT;
  s.onload = run;
  s.onerror = run; // no hls.js: native HLS where it exists, else the MP4 keeps playing
  (d.head ?? d.documentElement).appendChild(s);
}

type PrimedWindow = Window & { Hls?: HlsCtor; HTMLMediaElement: typeof HTMLMediaElement; __hlsPrimed?: boolean };

/**
 * Install the swap BEFORE the package's own script runs, so not a byte of the MP4 is fetched: watch the frame for each
 * new document (every section page is one) while it is still parsing, start loading hls.js into it, and route
 * `video.load()` through the map from the first call. Returns a stop function. attachPackageHls on the load event stays
 * as the safety net (wiring is idempotent).
 */
export function primePackageFrame(iframe: HTMLIFrameElement | null, map: Record<string, string> | null | undefined): () => void {
  if (!iframe || !map || !Object.keys(map).length) return () => undefined;
  let lastDoc: Document | null = null;
  const tick = () => {
    let w: PrimedWindow | null = null; let d: Document | null = null;
    try { w = iframe.contentWindow as PrimedWindow | null; d = iframe.contentDocument; } catch { return; }
    if (!w || !d || d === lastDoc || d.readyState === 'complete' || w.__hlsPrimed) return;
    if (!/\/contents\//.test(d.URL)) return; // about:blank before navigation
    lastDoc = d; w.__hlsPrimed = true;
    const doc = d, win = w;
    const proto = win.HTMLMediaElement.prototype;
    const nativeLoad = proto.load;
    const hasMse = 'MediaSource' in win || 'ManagedMediaSource' in win;
    const waiting: WiredVideo[] = [];
    let ready = !!win.Hls || !hasMse;
    if (!ready) {
      const s = doc.createElement('script');
      s.src = PACKAGE_HLS_SCRIPT;
      const go = () => { ready = true; waiting.splice(0).forEach((v) => wire(v, win, doc, map)); };
      s.onload = go; s.onerror = go;
      (doc.head ?? doc.documentElement).appendChild(s);
    }
    proto.load = function (this: HTMLMediaElement) {
      const v = this as WiredVideo;
      if (v.__hlsWired || !packageHlsUrl(map, sourceOf(v as HTMLVideoElement), doc.baseURI)) return nativeLoad.call(this);
      if (ready) wire(v, win, doc, map); else if (!waiting.includes(v)) waiting.push(v); // nothing is fetched until hls.js is in
    };
  };
  const id = setInterval(tick, 10);
  tick();
  return () => clearInterval(id);
}
