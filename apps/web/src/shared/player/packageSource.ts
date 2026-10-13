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
 * - `ElapsedCounter` — whole seconds that advance only while running, visible and not idle (fake-timer friendly).
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
  /** No pointer/keyboard activity for this long pauses the counter (default 120 s). */
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
    if (this.running) this.idleTimer = setTimeout(() => { this.idle = true; this.idleTimer = null; this.sync(); }, this.idleMs);
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
