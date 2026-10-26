/**
 * Helpers shared by the 나의학습실 and 교육담당자 specs (e2e/myroom, e2e/manager).
 *
 * - `authed(page, token)`: GET/POST through the page's request context with the session's access token (the token openAs()
 *   returned — same LoginIng session as the browser, so the SPA is not logged out).
 * - `pdfText(bytes)`: the text an FPDF/pdf-lib page draws (FlateDecode content streams, UCS-2 hex strings of the Type0 font),
 *   one line per Tj — enough to assert the printed name, course, hours and dates without a PDF library.
 * - `fileNameOf(res)`: the RFC 5987 `filename*` of a Content-Disposition (falls back to the plain `filename`).
 */
import zlib from 'node:zlib';
import type { APIResponse, Page } from '@playwright/test';

export function authed(page: Page, token: string) {
  const headers = { authorization: `Bearer ${token}` };
  return {
    get: (path: string) => page.request.get(path, { headers }),
    post: (path: string, data?: unknown) => page.request.post(path, { headers, data }),
    delete: (path: string) => page.request.delete(path, { headers }),
  };
}

export function fileNameOf(res: APIResponse): string {
  const cd = res.headers()['content-disposition'] ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) return decodeURIComponent(star[1]);
  return /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? '';
}

export function dispositionType(res: APIResponse): string {
  return (res.headers()['content-disposition'] ?? '').split(';')[0].trim().toLowerCase();
}

/** Text drawn on every page of a PDF (inflated content streams; <hex> strings decoded as UCS-2, (literal) strings as-is). */
export function pdfText(bytes: Buffer): string {
  const s = bytes.toString('latin1');
  const out: string[] = [];
  const re = /<<([^]*?)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const dict = m[1];
    if (/\/Subtype\s*\/Image/.test(dict)) continue;
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    if (end < 0) break;
    let body = bytes.subarray(start, end);
    if (/\/FlateDecode/.test(dict)) {
      try { body = zlib.inflateSync(body); } catch { continue; }
    }
    const text = body.toString('latin1');
    for (const t of text.matchAll(/(<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^\\)])*)\))\s*Tj/g)) {
      if (t[2] !== undefined) {
        const hex = t[2].replace(/\s+/g, '');
        let r = '';
        for (let i = 0; i + 4 <= hex.length; i += 4) r += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
        out.push(r);
      } else out.push(t[3].replace(/\\([()\\])/g, '$1'));
    }
  }
  return out.join('\n');
}

/**
 * Waits for the tab the SPA opens for a PDF (window.open, then location = blob: URL). The headless shell has no PDF viewer, so
 * the blob navigation may turn into a download of that tab instead — both count. Returns the blob URL (or the download's URL).
 */
export async function popupUrl(page: Page, action: () => Promise<unknown>): Promise<string> {
  const popup = page.waitForEvent('popup');
  await action();
  const p = await popup;
  const never = new Promise<string>(() => undefined);
  const url = await Promise.race([
    p.waitForURL(/^blob:/, { timeout: 15_000 }).then(() => p.url(), () => never), // rejects when the navigation becomes a download
    p.waitForEvent('download', { timeout: 15_000 }).then((d) => d.url()),
  ]).catch(() => (p.isClosed() ? 'closed' : p.url()));
  if (!p.isClosed()) await p.close();
  return url;
}

/** KST today as YYYY-MM-DD (the API and the DB run in Asia/Seoul). */
export function kstDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

/** Entries of a ZIP (xlsx) by name — stored or deflated members, central directory based. Enough to read sheet / style XML. */
export function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28); const extraLen = buf.readUInt16LE(p + 30); const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    out.set(name, method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/**
 * The API's own xlsx reader (apps/api/src/modules/admin/courses-xlsx.ts readXlsx, compiled into the API tree's dist/ by
 * `stack.mjs up`), so the spec reads the export exactly like the admin upload screens read a sheet.
 */
export async function apiXlsxReader(): Promise<(buf: Buffer) => { rows: Map<number, Record<string, string>>; maxRow: number }> {
  const { createRequire } = await import('node:module');
  const path = await import('node:path');
  const { loadStack } = await import('../support/stack');
  const tree = (loadStack() as unknown as { apiTree: string }).apiTree;
  const req = createRequire(path.join(tree, 'apps/api/package.json'));
  return (req(path.join(tree, 'apps/api/dist/modules/admin/courses-xlsx.js')) as { readXlsx: (b: Buffer) => { rows: Map<number, Record<string, string>>; maxRow: number } }).readXlsx;
}
