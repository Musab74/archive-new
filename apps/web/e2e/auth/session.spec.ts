/**
 * 세션·동시접속 (mypage/login_status.php, function.js LogInCheck; docs/learner-parity/auth.md §2.3).
 *
 * - Single session: a second login of the same learner in another browser replaces the LoginIng row; the first browser's next 60 s
 *   poll answers N and shows the 「다른 곳에서 사용 중입니다.」 notice (the browser clock is advanced with page.clock, the API is real).
 * - Token renewal: the access token lives 15 minutes (ACCESS_TOKEN_TTL_SEC=900). The poll must renew it through the refresh cookie
 *   instead of signing the learner out. Always checked with a simulated expiry (the first poll answers 401); checked against a REAL
 *   expiry when the API runs with a short TTL:
 *
 *     E2E_API_ACCESS_TOKEN_TTL_SEC=20 node e2e/stack.mjs restart-api --skip-build
 *     nice -n 10 npm run test:e2e -- auth/session.spec.ts -g "real expiry"
 *     node e2e/stack.mjs restart-api --skip-build            # back to the production 900 s
 */
import { test, expect, hidePopups } from '../support/test';
import { isLocal } from '../support/pageChecks';
import { loadStack } from '../support/stack';
import { LEARNER_PASSWORD } from '../support/accounts';
import { loginViaApi, loginViaUi } from '../support/login';
import { count, isPhone, resetMember } from './authHelpers';

test.use({ area: 'auth' });

const ID = 'xauthsess01';
const KICK_TITLE = '다른 곳에서 사용 중입니다.';
const KICK_BODY = '동일 아이디로 접속된 다른 기기나 브라우저가 있습니다. 기존 접속을 종료한 뒤 다시 시도해 주세요.';

test('second login elsewhere ends the first session: the next 60 s poll shows the kick-out notice', async ({ page, browser, checks, db }) => {
  await resetMember(ID);
  await page.clock.install();
  await hidePopups(page);
  await loginViaUi(page, ID, { expectPath: '/home' });
  await page.goto('/my/profile');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  const first = await db.scalar<string>('SELECT SessionID FROM LoginIng WHERE ID = ?', [ID]);
  // a poll while alone answers Y and touches the row (login_status.php:33-39)
  const okPoll = page.waitForResponse((r) => r.url().endsWith('/v1/auth/session'));
  await page.clock.runFor(61_000);
  expect(await (await okPoll).json()).toEqual({ status: 'Y' });

  // another browser (own cookies, own IP) signs in as the same learner
  const other = await browser.newContext({ baseURL: loadStack().baseURL, extraHTTPHeaders: { 'X-Forwarded-For': '10.77.250.9' } });
  await other.route((url) => !isLocal(url.href), (route) => route.abort('blockedbyclient'));
  try {
    const otherPage = await other.newPage();
    const r = await otherPage.request.post('/v1/auth/login', { data: { id: ID, password: LEARNER_PASSWORD, device: 'PC' } });
    expect(r.status()).toBe(200);
    const second = await db.scalar<string>('SELECT SessionID FROM LoginIng WHERE ID = ?', [ID]);
    expect(second).not.toBe(first);
    expect(await count('SELECT COUNT(*) FROM LoginIng WHERE ID = ?', [ID])).toBe(1);

    // first browser: next poll → N → kick-out notice, signed out locally
    const poll = page.waitForResponse((res) => res.url().endsWith('/v1/auth/session'));
    await page.clock.runFor(61_000);
    expect(await (await poll).json()).toEqual({ status: 'N' });
    const modal = page.getByRole('dialog', { name: KICK_TITLE });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(KICK_BODY);
    await checks.checkpoint('kicked-out');
    // the kicked browser's logout must not remove the new session's row
    expect(await db.scalar<string>('SELECT SessionID FROM LoginIng WHERE ID = ?', [ID])).toBe(second);
    // the second browser keeps working
    await otherPage.goto('/home');
    await expect(otherPage.getByText('세션일').first()).toBeAttached();
    const s = await otherPage.request.get('/v1/auth/session', { headers: { Authorization: `Bearer ${(await r.json()).accessToken}` } });
    expect(await s.json()).toEqual({ status: 'Y' });
    // 다시 로그인 → login form with the page as next
    await modal.getByRole('button', { name: '다시 로그인' }).click();
    await expect(page).toHaveURL(/\/auth\/login\?next=%2F/);
  } finally {
    await other.close();
  }
});

test('a reload after being replaced elsewhere comes back as a guest (refresh answers OTHER_SESSION)', async ({ page, browser, checks }) => {
  await resetMember(ID);
  checks.allow(/\/v1\/auth\/refresh$/, 401);
  await hidePopups(page);
  await loginViaApi(page, ID);
  await page.goto('/my/profile');
  await expect(page.locator('main').getByText('세션일').first()).toBeVisible();
  const other = await browser.newContext({ baseURL: loadStack().baseURL, extraHTTPHeaders: { 'X-Forwarded-For': '10.77.250.10' } });
  try {
    expect((await other.request.post('/v1/auth/login', { data: { id: ID, password: LEARNER_PASSWORD, device: 'PC' } })).status()).toBe(200);
  } finally { await other.close(); }
  const refresh = page.waitForResponse((r) => r.url().endsWith('/v1/auth/refresh'));
  await page.reload();
  const res = await refresh;
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe('OTHER_SESSION');
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fmy%2Fprofile$/);
  await checks.checkpoint('replaced-reload');
});

test('the poll renews an expired 15-minute access token through the refresh cookie (simulated expiry)', async ({ page, checks }) => {
  await resetMember(ID);
  checks.allow(/\/v1\/auth\/session$/, 401);
  await page.clock.install();
  await hidePopups(page);
  await loginViaUi(page, ID, { expectPath: '/home' });
  // the next session poll answers what the API answers for an expired access token
  let faked = 0;
  await page.route('**/v1/auth/session', async (route) => {
    if (faked++ === 0) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SESSION_EXPIRED', message: '로그인이 필요합니다.' } }) });
    return route.fallback();
  });
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/v1/auth/refresh') && r.request().method() === 'POST');
  const retried = page.waitForResponse((r) => r.url().endsWith('/v1/auth/session') && r.status() === 200);
  await page.clock.runFor(61_000);
  expect((await refreshed).status()).toBe(200);
  expect(await (await retried).json()).toEqual({ status: 'Y' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/my/profile');
  await expect(page.locator('main').getByText('세션일').first()).toBeVisible();
  await checks.checkpoint('token-renewed-simulated');
});

test('real expiry: the poll renews the access token after ACCESS_TOKEN_TTL_SEC (run with E2E_API_ACCESS_TOKEN_TTL_SEC=20)', async ({ page, checks }) => {
  await resetMember(ID);
  await hidePopups(page);
  const login = page.waitForResponse((r) => r.url().endsWith('/v1/auth/login'));
  await page.goto('/auth/login');
  await page.locator('#login-id').fill(ID);
  await page.locator('#login-pw').fill(LEARNER_PASSWORD);
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  const { expiresIn } = (await (await login).json()) as { expiresIn: number };
  test.skip(expiresIn > 60, `API runs with ACCESS_TOKEN_TTL_SEC=${expiresIn}; restart it with E2E_API_ACCESS_TOKEN_TTL_SEC=20 to check a real expiry`);
  await expect(page).toHaveURL(/\/home$/);
  checks.allow(/\/v1\/auth\/session$/, 401);
  await page.waitForTimeout((expiresIn + 2) * 1000); // the API's own clock must pass the token's exp
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/v1/auth/refresh') && r.request().method() === 'POST');
  const expired = page.waitForResponse((r) => r.url().endsWith('/v1/auth/session') && r.status() === 401);
  const retried = page.waitForResponse((r) => r.url().endsWith('/v1/auth/session') && r.status() === 200);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // same tick the 60 s timer runs
  expect((await expired).status()).toBe(401);
  expect((await refreshed).status()).toBe(200);
  expect(await (await retried).json()).toEqual({ status: 'Y' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: '나의 학습실' }).first().click();
  await expect(page).toHaveURL(/\/my$/);
  await checks.checkpoint('token-renewed-real');
});

test('real expiry: logout after ACCESS_TOKEN_TTL_SEC still signs out (run with E2E_API_ACCESS_TOKEN_TTL_SEC=20)', async ({ page, checks }, info) => {
  await resetMember(ID);
  await hidePopups(page);
  const { expiresIn } = await loginViaApi(page, ID);
  test.skip(expiresIn > 60, `API runs with ACCESS_TOKEN_TTL_SEC=${expiresIn}; restart it with E2E_API_ACCESS_TOKEN_TTL_SEC=20 to check a real expiry`);
  checks.allow(/\/v1\/auth\/(logout|session)$/, 401);
  await page.goto('/home');
  await expect(page.locator('main').getByText('이어서 학습하기').first()).toBeVisible();
  await page.waitForTimeout((expiresIn + 2) * 1000);
  const statuses: number[] = [];
  page.on('response', (r) => { if (r.url().endsWith('/v1/auth/logout')) statuses.push(r.status()); });
  if (isPhone(info)) {
    await page.getByRole('button', { name: '전체메뉴' }).filter({ visible: true }).first().click();
    await page.getByRole('dialog', { name: '전체메뉴' }).getByRole('button', { name: '로그아웃' }).click();
  } else {
    await page.locator('header').getByRole('button', { name: '로그아웃' }).click();
  }
  await expect.poll(() => statuses).toEqual([401, 200]);
  await expect.poll(() => count('SELECT COUNT(*) FROM LoginIng WHERE ID = ?', [ID])).toBe(0);
  await page.goto('/my/profile');
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fmy%2Fprofile$/);
});
