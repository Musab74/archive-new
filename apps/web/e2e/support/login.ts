/**
 * Sign-in helpers.
 *
 * - `loginViaUi(page, id)`: types into /auth/login like a learner and waits for the routed page (the real flow, incl. the
 *   PC/Mobile device the SPA derives from the user agent).
 * - `loginViaApi(page, id)`: POST /v1/auth/login through the page's own request context — the httpOnly refresh cookie lands in
 *   the browser context, so the SPA restores the session on the next navigation (fast; use it when login is not under test).
 * - `loginStaffViaApi(page, id)`: the same for the staff console (/v1/auth/admin/login).
 *
 * Both write what the real login writes (Member.LastLogin, LoginHistory, LoginIng) and are counted by the API's login limit
 * (10/min per IP + id): the e2e `test` fixture gives every test its own X-Forwarded-For, so separate tests never share a bucket.
 */
import { expect, type Page } from '@playwright/test';
import { ACCOUNTS, LEARNER_PASSWORD, STAFF_PASSWORD, type AccountId } from './accounts';

export interface LoginResult { accessToken: string; expiresIn: number; next: string; user: { id: string; name: string; eduManager: boolean; testId: boolean; companyCode: string } }

/** Where routeForNext() (src/shared/auth/roles.ts) sends each `next`. */
export const NEXT_PATH: Record<string, string> = {
  terms: '/auth/first-terms', password: '/auth/password-change', 'assessment-grant': '/my/assessment', 'pre-assessment': '/assessment/pre', classroom: '/my', home: '/home',
};

export async function loginViaApi(page: Page, id: AccountId | string, password = LEARNER_PASSWORD, device: 'PC' | 'MOBILE' = 'PC'): Promise<LoginResult> {
  const res = await page.request.post('/v1/auth/login', { data: { id, password, device } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`login ${id} failed: ${res.status()} ${JSON.stringify(body)}`);
  return body as LoginResult;
}

export async function loginStaffViaApi(page: Page, id = 'admin01', password = STAFF_PASSWORD, secondFactor?: string) {
  const res = await page.request.post('/v1/auth/admin/login', { data: { id, password, ...(secondFactor ? { secondFactor } : {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`staff login ${id} failed: ${res.status()} ${JSON.stringify(body)}`);
  return body as { accessToken: string; admin: { id: string } };
}

/** Fills the login form; with `expectPath` (default: the account's routed page) waits until the SPA navigated there. */
export async function loginViaUi(page: Page, id: AccountId | string, opts: { password?: string; expectPath?: string | RegExp | null; next?: string } = {}): Promise<void> {
  const password = opts.password ?? LEARNER_PASSWORD;
  await page.goto(`/auth/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ''}`);
  await page.locator('#login-id').fill(id);
  await page.locator('#login-pw').fill(password);
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  const acct = (ACCOUNTS as Record<string, { next: string | null }>)[id];
  const want = opts.expectPath !== undefined ? opts.expectPath : acct?.next ? NEXT_PATH[acct.next] : null;
  if (want) await expect(page).toHaveURL(typeof want === 'string' ? new RegExp(`${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`) : want);
}

/** Signs in through the API, then opens `path` (the SPA picks the session up from the refresh cookie). */
export async function openAs(page: Page, id: AccountId | string, path: string, password = LEARNER_PASSWORD): Promise<LoginResult> {
  const r = await loginViaApi(page, id, password, page.viewportSize() && page.viewportSize()!.width < 768 ? 'MOBILE' : 'PC');
  await page.goto(path);
  return r;
}
