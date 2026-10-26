/**
 * The `test` every e2e spec imports (instead of @playwright/test):
 *
 *   import { test, expect } from '../support/test';
 *   test.describe('myroom', () => { test.use({ area: 'myroom' }); ... });
 *
 * Fixtures:
 * - `checks` (auto): PageChecks for the page — console errors / failed requests fail the test at the end; `checks.checkpoint(name)` =
 *   overflow assertion + screenshot into <run>/screenshots/<project>/<area>/.
 * - `area` (option): screenshot sub-folder, default 'misc'.
 * - `db`: the local test DB helper (support/db.ts).
 * - `noExternal` (auto): every request that is not http://127.0.0.1 is aborted (listed in `checks.external`) — the browser can never
 *   touch timeless.uz, api.timeless.uz, the PHP site (hrdeedu.co.kr) or a provider, even through a legacy link or popup.
 * - `extraHTTPHeaders`: a per-test X-Forwarded-For (10.77.x.y). The API trusts one proxy hop, so each test gets its own
 *   throttle bucket (global 120 req/min per IP, login 10/min per IP+id) and LoginHistory/LoginIng show that address.
 */
import { test as base, expect, type Page } from '@playwright/test';
import { PageChecks, isLocal } from './pageChecks';
import { db } from './db';
import { loadStack } from './stack';

function testIp(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return `10.77.${(h >>> 8) & 0xff}.${Math.max(1, h & 0xfe)}`;
}

export interface E2EFixtures { checks: PageChecks; area: string; db: typeof db; clientIp: string; noExternal: void }
interface E2EWorkerFixtures { dbPool: void }

export const test = base.extend<E2EFixtures, E2EWorkerFixtures>({
  // One pool per worker process, closed at worker teardown.
  dbPool: [async ({}, use) => { await use(); await db.close(); }, { scope: 'worker', auto: true }],
  area: ['misc', { option: true }],
  clientIp: async ({}, use, testInfo) => { await use(testIp(`${testInfo.testId}|${testInfo.project.name}|${testInfo.retry}|${testInfo.repeatEachIndex}`)); },
  extraHTTPHeaders: async ({ clientIp }, use) => { await use({ 'X-Forwarded-For': clientIp }); },
  // Never let the browser reach anything but the local stack (live site, PHP site, NICE/mOTP, CDNs): aborted as blocked-by-client
  // and listed in checks.external, so a spec can assert that a legacy link was requested without ever loading it.
  noExternal: [async ({ context }, use) => {
    await context.route((url) => !isLocal(url.href), (route) => route.abort('blockedbyclient'));
    await use();
  }, { auto: true }],
  checks: [async ({ page, area }, use, testInfo) => {
    const checks = new PageChecks(page, testInfo, area);
    await use(checks);
    if (testInfo.status === testInfo.expectedStatus) checks.assertClean();
  }, { auto: true }],
  db: async ({}, use) => { await use(db); },
});

export { expect };

/** Fixture popups (fixtures/seed.sql): 9801 is active until +30 days, 9802 expired yesterday. */
export const ACTIVE_POPUPS = [9801];

/**
 * Hides the site popups for this browser context the way 「오늘 하루 창 열지 않기」 does (cookie Popup<idx>=1), so they do not cover
 * the page under test. Call before the first navigation. Specs that test the popup itself simply do not call it.
 */
export async function hidePopups(page: Page, idxs: number[] = ACTIVE_POPUPS): Promise<void> {
  const host = new URL(loadStack().baseURL).hostname;
  await page.context().addCookies(idxs.map((idx) => ({ name: `Popup${idx}`, value: '1', domain: host, path: '/', sameSite: 'Lax' as const })));
}

/** Closes every open site popup (알림 팝업 layers) with its 닫기 button; returns how many were closed. */
export async function dismissPopups(page: Page): Promise<number> {
  const region = page.getByLabel('알림 팝업', { exact: true });
  let closed = 0;
  for (let i = 0; i < 5; i++) {
    const btn = region.getByRole('button', { name: '닫기', exact: true }).first();
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.click();
    closed++;
  }
  return closed;
}
