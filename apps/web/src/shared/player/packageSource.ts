/**
 * Packaged-HTML ("Type A") content support — pure helpers, no React.
 *
 * The legacy player embeds packaged content in an iframe and tries to read the package's own playhead
 * (`.time1 .playerText`, "mm:ss"). When it cannot, it posts a wall-clock based `ProgressTime` which the server
 * treats as a synthetic position (POST /v1/player/progress uses `progressTime` when `positionSec` is 0 and
 * credits min(positionΔ, wallΔ+5), so elapsed seconds are credited like real watching).
 *
 * - `parsePlayhead` — "mm:ss" / "hh:mm:ss" → seconds (null when unparseable).
 * - `readPlayhead` — looks for a playhead inside a same-origin iframe document.
 * - `ElapsedCounter` — whole seconds that advance only while running (and, when configured, visible and not idle; fake-timer friendly).
 * - `normalizeArchiveLastStudy` / `packageLastStudy` — the LastStudy each save posts for a package (its current section page).
 */

/** Chapters served as packaged HTML: `contentsType === 'A'` or an .html/.htm URL. */
export function isPackageChapter(chapter: { contentsType?: string | null; url?: string | null; mobileUrl?: string | null }): boolean {
  if ((chapter.contentsType ?? '').trim().toUpperCase() === 'A') return true;
  const url = (chapter.url ?? chapter.mobileUrl ?? '').split(/[?#]/)[0];
  return /\.html?$/i.test(url);
}

/** "05:09" → 309, "1:02:03" → 3723; anything else → null. Mirrors the PHP `hhmmssToSec` but rejects non-numeric parts. */
export function parsePlayhead(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length !== 2 && parts.length !== 3) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p.trim()) ? Number(p.trim()) : NaN));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [a, b, c] = nums;
  const sec = parts.length === 3 ? a * 3600 + b * 60 + c : a * 60 + b;
  return sec >= 0 ? sec : null;
}

const PLAYHEAD_SELECTORS = ['.time1 .playerText', '.playerText', '[data-current-time]'] as const;

/**
 * Reads the current playhead from a packaged player's document, in priority order:
 * `.time1 .playerText` / `.playerText` (text "mm:ss"), `[data-current-time]` (attribute or text),
 * then any <video>/<audio> `currentTime`. Returns null when nothing usable is found.
 * The caller handles cross-origin access errors (contentDocument throws / is null).
 */
export function readPlayhead(doc: Document | null | undefined): number | null {
  if (!doc) return null;
  for (const sel of PLAYHEAD_SELECTORS) {
    const el = doc.querySelector(sel);
    if (!el) continue;
    const attr = el.getAttribute('data-current-time');
    if (attr != null) {
      const n = Number(attr);
      if (Number.isFinite(n) && n >= 0) return Math.floor(n);
      const parsed = parsePlayhead(attr);
      if (parsed !== null) return parsed;
    }
    const parsed = parsePlayhead(el.textContent);
    if (parsed !== null) return parsed;
  }
  const media = doc.querySelector('video, audio') as HTMLMediaElement | null;
  if (media && Number.isFinite(media.currentTime) && media.currentTime > 0) return Math.floor(media.currentTime);
  return null;
}

/** Safely reads a same-origin iframe's document; null when cross-origin or not loaded. */
export function iframeDocument(iframe: HTMLIFrameElement | null | undefined): Document | null {
  if (!iframe) return null;
  try { return iframe.contentDocument ?? iframe.contentWindow?.document ?? null; } catch { return null; }
}

export const PACKAGE_IDLE_MS = 120_000;

export interface ElapsedCounterOptions {
  /** No pointer/keyboard activity for this long pauses the counter (default 120 s; 0 = never, as in player2.php). */
  idleMs?: number;
  /** Called once per credited second with the new total. */
  onSecond?: (totalSec: number) => void;
  /** Initial visibility (default true). */
  visible?: boolean;
}

/**
 * Counts whole elapsed seconds while `running && visible && !idle`, mirroring the PHP wall-clock
 * ProgressTime fallback but only for time the learner is plausibly in front of the content.
 * Uses setInterval(1 s) + an idle setTimeout, so vitest fake timers drive it deterministically.
 */
export class ElapsedCounter {
  private total = 0;
  private running = false;
  private visible: boolean;
  private idle = false;
  private readonly idleMs: number;
  private readonly onSecond?: (totalSec: number) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: ElapsedCounterOptions = {}) {
    this.idleMs = opts.idleMs ?? PACKAGE_IDLE_MS;
    this.onSecond = opts.onSecond;
    this.visible = opts.visible ?? true;
  }

  get seconds(): number { return this.total; }
  get isCounting(): boolean { return this.timer !== null; }
  get isIdle(): boolean { return this.idle; }

  /** Start (or resume) counting; also counts as activity. */
  start(): void { this.running = true; this.sync(); this.activity(); } // interval first so the idle timeout never pre-empts a due second
  stop(): void { this.running = false; this.clearIdle(); this.sync(); }
  setVisible(visible: boolean): void { this.visible = visible; this.sync(); }
  /** Pointer / keyboard activity (or an advancing playhead): clears idle and re-arms the idle timeout. */
  activity(): void {
    this.idle = false;
    this.clearIdle();
    if (this.running && this.idleMs > 0) this.idleTimer = setTimeout(() => { this.idle = true; this.idleTimer = null; this.sync(); }, this.idleMs);
    this.sync();
  }
  reset(): void { this.total = 0; }
  dispose(): void { this.running = false; this.clearIdle(); this.sync(); }

  private sync(): void {
    const should = this.running && this.visible && !this.idle;
    if (should && this.timer === null) {
      this.timer = setInterval(() => { this.total += 1; this.onSecond?.(this.total); }, 1000);
    } else if (!should && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  private clearIdle(): void { if (this.idleTimer !== null) { clearTimeout(this.idleTimer); this.idleTimer = null; } }
}

export type PackageSource = 'playhead' | 'elapsed';

/**
 * The position pair a type-A tick carries. With a detected playhead the real position is sent and
 * `progressTime` stays 0 (identical to the video path). Without one, `positionSec` is 0 and
 * `progressTime = resumeBase + elapsed` — the API substitutes it as a synthetic position, and the base keeps
 * it monotonic across sessions so the server's positionΔ credit keeps accruing from where the last session stopped.
 */
export function packageTickPosition(playheadSec: number | null, elapsedSec: number, resumeBaseSec: number): { positionSec: number; progressTime: number } {
  if (playheadSec !== null && playheadSec > 0) return { positionSec: Math.floor(playheadSec), progressTime: 0 };
  return { positionSec: 0, progressTime: Math.max(0, Math.floor(resumeBaseSec)) + Math.max(0, Math.floor(elapsedSec)) };
}

/**
 * window.normalizeArchiveLastStudy (player2.php:3388-3407): pathname only, one leading `/contents` stripped, '' for blank/root.
 * `https://host/contents/D/01/02/index.html?x=1` → `/D/01/02/index.html`.
 */
export function normalizeArchiveLastStudy(raw: string | null | undefined): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s || s === 'blank') return '';
  let path = s;
  if (/^https?:\/\//i.test(s)) { try { path = new URL(s).pathname || ''; } catch { path = s; } }
  else if (/^\/\//.test(s)) { try { path = new URL('https:' + s).pathname || ''; } catch { path = s; } }
  path = path.split(/[?#]/)[0];
  if (!path || path === '/') return '';
  if (path.indexOf('/contents') === 0) {
    if (path === '/contents' || path === '/contents/') return '';
    path = path.substring('/contents'.length);
    if (!path) return '';
    if (path.charAt(0) !== '/') path = '/' + path;
  }
  return path === '/' ? '' : path;
}

/**
 * getTypeALastStudyForPC (player2.php:3427-3446): the frame's current pathname (each section page is its own document),
 * else its src attribute, else the chapter's own page — normalised; 'blank' when nothing is known. Max 150 chars (column size).
 */
export function packageLastStudy(iframe: HTMLIFrameElement | null | undefined, defaultPage: string | null | undefined): string {
  let raw = '';
  try { raw = iframe?.contentWindow?.location?.pathname ?? ''; } catch { raw = ''; }
  if (!raw && iframe) { try { raw = new URL(iframe.getAttribute('src') || iframe.src || '', window.location.href).pathname; } catch { raw = ''; } }
  const v = normalizeArchiveLastStudy(raw) || normalizeArchiveLastStudy(defaultPage);
  return (v || 'blank').slice(0, 150);
}

/**
 * The auto-next helper player2.php injects into every packaged section page (player2.php:1187-1247, verbatim): after the
 * package's own completeStudy() it moves to the next page (`._nextBtn`, or gotoMenu(currentPageNo+1)); on the last page it
 * posts `{type:'completed'}` to the player (which PHP does not act on either).
 */
export const TYPE_A_AUTONEXT_SCRIPT = "(function(){"
  + "if(window.__hrdeTypeAAutoNextInstalled)return;"
  + "window.__hrdeTypeAAutoNextInstalled=true;"
  + "function hasNext(){"
  + "try{if(window.contentsData&&contentsData.menus&&typeof window.currentPageNo!=='undefined'){return Number(currentPageNo)+1<contentsData.menus.length;}}catch(e){}"
  + "try{if(window.contents&&typeof window.targetNumber!=='undefined'&&typeof contents.lastNo!=='undefined'){return Number(targetNumber)<Number(contents.lastNo)-1;}}catch(e){}"
  + "return !!document.querySelector('._nextBtn');"
  + "}"
  + "function goNext(){"
  + "if(!hasNext()){try{parent.postMessage({type:'completed',source:'hrde-type-a-autonext'},'*');}catch(e){}return;}"
  + "var btn=document.querySelector('._nextBtn');"
  + "if(btn){btn.click();return;}"
  + "try{if(typeof window.gotoMenu==='function'&&typeof window.currentPageNo!=='undefined'){window.gotoMenu(Number(currentPageNo)+1);}}catch(e){}"
  + "}"
  + "function wrapCompleteStudy(){"
  + "if(typeof window.completeStudy!=='function'||window.completeStudy.__hrdeAutoNextWrapped)return false;"
  + "var original=window.completeStudy;"
  + "window.completeStudy=function(){var result=original.apply(this,arguments);setTimeout(goNext,500);return result;};"
  + "window.completeStudy.__hrdeAutoNextWrapped=true;"
  + "return true;"
  + "}"
  + "wrapCompleteStudy();"
  + "var tries=0;"
  + "var timer=setInterval(function(){if(wrapCompleteStudy()||++tries>40)clearInterval(timer);},250);"
  + "})();";

/** tryInstallTypeAAutoNext: true once the helper is in this document (idempotent per document); false when not reachable yet. */
export function installTypeAAutoNext(doc: Document | null | undefined): boolean {
  try {
    if (!doc || !doc.documentElement) return false;
    if (doc.querySelector('script[data-hrde-type-a-autonext]')) return true;
    const script = doc.createElement('script');
    script.setAttribute('data-hrde-type-a-autonext', 'true');
    script.text = TYPE_A_AUTONEXT_SCRIPT;
    (doc.head || doc.documentElement).appendChild(script);
    return true;
  } catch { return false; }
}

/** Asia/Seoul calendar day (player2.php hrdeSeoulYmd) — the 8-hour count restarts when it changes. */
export function seoulYmd(now: Date = new Date()): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); } catch { return now.toISOString().slice(0, 10); }
}
