/**
 * Per-page checks every e2e spec runs: console errors, uncaught page errors, failed requests (network failures and HTTP ≥ 400 on
 * same-origin /v1, /contents, /upload, /media, /contents-hls and app assets), horizontal overflow, and one full-page screenshot
 * per page per viewport into <run>/screenshots/<project>/<area>/<name>.png.
 *
 *   test('…', async ({ page, checks }) => {
 *     checks.allow(/\/v1\/my\/certificates\/9401$/);        // a 403 this scenario expects
 *     await page.goto('/my');
 *     await checks.checkpoint('my-dashboard');               // overflow + screenshot (+ waits for the network to settle)
 *     ...                                                     // checks.assertClean() runs automatically after the test
 *   });
 *
 * Allowed by default: the guest session probe (POST /v1/auth/refresh → 401 without a refresh cookie) and the browser's own
 * "Failed to load resource" console line for any response that is itself allowed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { screenshotRoot } from './stack';

export interface Problem { kind: 'console' | 'pageerror' | 'requestfailed' | 'http'; text: string; url?: string; status?: number; page: string }

/** Expected noise. `/v1/auth/refresh` 401 = the SPA asking whether a guest has a session (no refresh cookie yet). */
export const DEFAULT_ALLOWED: Array<{ url?: RegExp; status?: number; text?: RegExp }> = [
  { url: /\/v1\/auth\/refresh$/, status: 401 },
];

/** The local e2e stack (http://127.0.0.1:<port>) plus data:/blob: URLs; everything else is external. */
export function isLocal(url: string): boolean {
  if (/^(data|blob|about):/.test(url)) return true;
  try { return new URL(url).hostname === '127.0.0.1'; } catch { return false; }
}

const slug = (s: string) => s.normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'page';

export class PageChecks {
  readonly problems: Problem[] = [];
  /** Requests to anything but the local stack, blocked by the `test` fixture (legacy PHP links, NICE/mOTP popups, CDNs). */
  readonly external: string[] = [];
  private readonly allowed = [...DEFAULT_ALLOWED];
  private readonly shots = new Set<string>();

  constructor(private readonly pg: Page, private readonly info: TestInfo, private readonly area: string) {
    pg.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      const loc = msg.location()?.url ?? '';
      // Chromium echoes every failed response as a console error; the response itself is judged by the 'response' handler.
      if (/^Failed to load resource: the server responded with a status of \d+/.test(text)) {
        if (this.isAllowed(loc, Number(/status of (\d+)/.exec(text)?.[1]), text)) return;
        if (this.isTracked(loc)) return;
      }
      if (/ERR_BLOCKED_BY_CLIENT/.test(text) && loc && !isLocal(loc)) return; // the external request itself is listed in `external`
      if (this.isAllowed(loc, undefined, text)) return;
      this.problems.push({ kind: 'console', text, url: loc, page: pg.url() });
    });
    pg.on('pageerror', (err) => {
      if (this.isAllowed(undefined, undefined, err.message)) return;
      this.problems.push({ kind: 'pageerror', text: `${err.name}: ${err.message}`, page: pg.url() });
    });
    pg.on('requestfailed', (req) => {
      const failure = req.failure()?.errorText ?? 'failed';
      if (/ERR_BLOCKED_BY_CLIENT/.test(failure) && !isLocal(req.url())) { this.external.push(req.url()); return; }
      // Navigations/aborts the app itself causes (route change, closed player) are not failures.
      if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(failure)) return;
      if (this.isAllowed(req.url(), undefined, failure)) return;
      this.problems.push({ kind: 'requestfailed', text: `${req.method()} ${failure}`, url: req.url(), page: pg.url() });
    });
    pg.on('response', (res) => {
      const url = res.url();
      if (!this.isTracked(url) || res.status() < 400) return;
      if (this.isAllowed(url, res.status())) return;
      this.problems.push({ kind: 'http', text: `${res.request().method()} ${res.status()} ${res.statusText()}`, url, status: res.status(), page: pg.url() });
    });
  }

  /** Expect a failure in this test (URL regex, optional status / message regex). */
  allow(url: RegExp, status?: number, text?: RegExp): this {
    this.allowed.push({ url, status, text });
    return this;
  }

  /** Same-origin requests the checks judge (third-party fonts etc. are out of scope). */
  private isTracked(url: string): boolean {
    try {
      const u = new URL(url);
      return u.origin === new URL(this.pg.url() || 'http://127.0.0.1').origin || /^\/(v1|contents|upload|media|contents-hls|assets)\//.test(u.pathname);
    } catch { return false; }
  }

  private isAllowed(url?: string, status?: number, text?: string): boolean {
    return this.allowed.some((a) => (!a.url || (url !== undefined && a.url.test(url))) && (a.status === undefined || a.status === status) && (!a.text || (text !== undefined && a.text.test(text))) && (a.url || a.text));
  }

  /** No element wider than the viewport: documentElement.scrollWidth ≤ innerWidth (+1 px rounding). Lists the widest offenders. */
  async assertNoHorizontalOverflow(label = this.pg.url()): Promise<void> {
    const r = await this.pg.evaluate(() => {
      const vw = window.innerWidth;
      const sw = document.documentElement.scrollWidth;
      const offenders: string[] = [];
      if (sw > vw + 1) {
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const b = el.getBoundingClientRect();
          if (b.right > vw + 1 && b.width > 0) {
            const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
            offenders.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls} right=${Math.round(b.right)}`);
            if (offenders.length >= 8) break;
          }
        }
      }
      return { vw, sw, offenders };
    });
    expect(r.sw, `horizontal overflow on ${label}: scrollWidth ${r.sw} > viewport ${r.vw}\n${r.offenders.join('\n')}`).toBeLessThanOrEqual(r.vw + 1);
  }

  /** Full-page screenshot into <run>/screenshots/<project>/<area>/<name>.png (unique per test; returns the path). */
  async screenshot(name: string): Promise<string> {
    let base = slug(name);
    for (let i = 2; this.shots.has(base); i++) base = `${slug(name)}-${i}`;
    this.shots.add(base);
    const file = path.join(screenshotRoot(), this.info.project.name, slug(this.area), `${base}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await this.pg.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    return file;
  }

  /** The standard per-page step: let the network settle, assert no overflow, take the screenshot. */
  async checkpoint(name: string, opts: { overflow?: boolean; settle?: boolean } = {}): Promise<string> {
    if (opts.settle !== false) await this.pg.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    if (opts.overflow !== false) await this.assertNoHorizontalOverflow(name);
    return this.screenshot(name);
  }

  /** Fails with every console error / failed request seen so far (runs automatically at the end of each test). */
  assertClean(): void {
    if (!this.problems.length) return;
    const lines = this.problems.map((p) => `  [${p.kind}] ${p.text}${p.url ? ` ${p.url}` : ''}  (on ${p.page})`);
    throw new Error(`console errors / failed requests:\n${lines.join('\n')}`);
  }
}
