/**
 * Helpers of the 고객지원 specs (not a spec file).
 *
 * 보안코드: the API signs a token holding a keyed hash of the five digits (support/captcha.ts) with a key derived from
 * AUTH_JWT_SECRET. The e2e launcher sets a fixed dummy secret (stack.mjs), so the spec can recover the digits of the picture it was
 * shown by trying the 100,000 codes against the hash — the real form flow (picture → typed digits → one-time check) stays intact.
 */
import { createHmac } from 'node:crypto';
import path from 'node:path';
import type { Page, Response } from '@playwright/test';
import { loadStack } from '../support/stack';

/** stack.mjs: AUTH_JWT_SECRET = 'e2e-auth-jwt-secret-'.padEnd(48, 'x') (test-only value, never a real secret). */
const CAPTCHA_KEY = createHmac('sha256', 'e2e-auth-jwt-secret-'.padEnd(48, 'x')).update('ainex-support-captcha-v1').digest();

export function solveCaptcha(token: string): string {
  const [body] = token.split('.');
  const claims = JSON.parse(Buffer.from(body!, 'base64url').toString('utf8')) as { n: string; h: string };
  for (let i = 0; i < 100_000; i++) {
    const code = String(i).padStart(5, '0');
    if (createHmac('sha256', CAPTCHA_KEY).update(`${claims.n}:${code}`).digest('base64url') === claims.h) return code;
  }
  throw new Error('captcha token not issued by this stack');
}

/** Remembers every 보안코드 picture the page loaded (GET /v1/support/captcha) so the spec can type the current one. */
export class CaptchaTracker {
  readonly tokens: string[] = [];
  constructor(page: Page) {
    page.on('response', (r: Response) => {
      if (!/\/v1\/support\/captcha\?/.test(r.url()) || r.status() !== 200) return;
      void r.json().then((b: { token?: string }) => { if (b.token) this.tokens.push(b.token); }).catch(() => undefined);
    });
  }
  get count(): number { return this.tokens.length; }
  latest(): string {
    const t = this.tokens[this.tokens.length - 1];
    if (!t) throw new Error('no 보안코드 picture loaded yet');
    return t;
  }
  /** The digits of the picture currently shown. */
  code(): string { return solveCaptcha(this.latest()); }
}

/** Absolute path of a file the API wrote under the run folder's HRDE_UPLOAD_DIR (never /vod/upload). */
export function uploadedFile(folder: string, stored: string): string {
  const dir = loadStack().stateDirs.HRDE_UPLOAD_DIR!;
  if (!dir.startsWith(loadStack().runDir)) throw new Error(`upload dir ${dir} is outside the run folder`);
  return path.join(dir, folder, stored);
}

/** A one-page PDF (valid header/trailer) for upload tests. */
export function tinyPdf(text = 'E2E'): Buffer {
  const body = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R>>endobj\n4 0 obj<</Length 30>>stream\nBT /F1 12 Tf 20 50 Td (${text}) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

/** Decodes the payload of a JWT (no verification — only to read what the API put in it). */
export function jwtPayload(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
}
