/**
 * 로그인 (public/member/login.html + login_ok.php, m/ copy) end to end: routing of every fixture state, the refused states and their
 * PHP messages, the separate empty-field messages, the 10-per-minute limit, Replace_Check_XSS2 passwords, the rows a login writes
 * (Member.LastLogin, LoginHistory with Device PC/Mobile, one LoginIng row) and logout. Reference: docs/learner-parity/auth.md §2.1–2.3.
 */
import { test, expect, hidePopups } from '../support/test';
import { ACCOUNTS, LEARNER_PASSWORD, type AccountId } from '../support/accounts';
import { NEXT_PATH, loginViaApi, loginViaUi } from '../support/login';
import { LOGIN_MESSAGES, SPECIAL, count, isPhone, loginFormMessage, logoutViaHeader, openSiteMenu, resetMember, submitLogin } from './authHelpers';

test.use({ area: 'auth' });

/** Every routed state (login_ok.php:69-88 order): terms → password → grant → pre-assessment → TestID classroom → home. */
const ROUTED: Array<{ id: AccountId; heading: RegExp | string }> = [
  { id: 'e2elearn01', heading: '이어서 학습하기' },
  { id: 'mgr01', heading: '이어서 학습하기' },
  { id: 'e2emgr01', heading: '이어서 학습하기' },
  { id: 'test01', heading: /테스트원님의 학습실/ },
  { id: 'e2etest02', heading: /테스트이님의 학습실/ },
  { id: 'e2eterms01', heading: '필수동의 항목에 동의해 주세요.' },
  { id: 'e2epw01', heading: '비밀번호를 변경해 주세요.' },
  { id: 'e2epre01', heading: /사전/ },
  { id: 'user01', heading: /사전/ },
  { id: 'e2egrant01', heading: /진단/ },
];

for (const { id, heading } of ROUTED) {
  const acct = ACCOUNTS[id];
  test(`login routes ${id} (${acct.next}) to ${NEXT_PATH[acct.next!]}`, async ({ page, checks, db }) => {
    // assessment/post.spec.ts consumes this POST grant when it runs first; the routing state needs it ACTIVE
    if (id === 'e2egrant01') await db.exec("UPDATE AssessmentAccessGrant SET Status = 'ACTIVE', ConsumedAt = NULL, ExpiresAt = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE LearnerID = ? AND AssessmentType = 'POST'", [acct.id]);
    await hidePopups(page);
    await loginViaUi(page, id);
    await expect(page.locator('main').getByText(heading).first()).toBeVisible();
    await checks.checkpoint(`routed-${acct.next}-${id}`);
  });
}

test('TopLogin: home keeps the page the learner came from; a pending step keeps it as next', async ({ page, checks }) => {
  await hidePopups(page);
  await loginViaUi(page, 'e2elearn01', { next: '/catalog', expectPath: '/catalog' });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.context().clearCookies();
  await hidePopups(page);
  await loginViaUi(page, 'e2eterms01', { next: '/catalog', expectPath: /\/auth\/first-terms\?next=%2Fcatalog$/ });
  // an unsafe next (other origin) is ignored: home
  await page.context().clearCookies();
  await hidePopups(page);
  await loginViaUi(page, 'e2elearn01', { next: 'https://example.com/', expectPath: '/home' });
  await checks.checkpoint('login-next-home');
});

const REFUSED: Array<{ id: AccountId; status: number; message: string }> = [
  { id: 'e2eout01', status: 403, message: LOGIN_MESSAGES.withdrawn },
  { id: 'e2enouse01', status: 401, message: LOGIN_MESSAGES.invalid },
  { id: 'e2esleep01', status: 403, message: LOGIN_MESSAGES.dormant },
  { id: 'sleep01', status: 403, message: LOGIN_MESSAGES.dormant },
];

for (const { id, status, message } of REFUSED) {
  test(`login refused for ${id}: PHP message, nothing recorded`, async ({ page, checks, db }) => {
    expect(ACCOUNTS[id].loginError).toBe(message);
    checks.allow(/\/v1\/auth\/login$/, status);
    const before = await count('SELECT COUNT(*) FROM LoginHistory WHERE ID = ?', [id]);
    const last = await db.scalar<string | null>('SELECT LastLogin FROM Member WHERE ID = ?', [id]);
    await page.goto('/auth/login');
    const res = page.waitForResponse((r) => r.url().endsWith('/v1/auth/login'));
    await submitLogin(page, id, LEARNER_PASSWORD);
    expect((await res).status()).toBe(status);
    await expect(loginFormMessage(page)).toHaveText(message);
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(await count('SELECT COUNT(*) FROM LoginHistory WHERE ID = ?', [id])).toBe(before);
    expect(await count('SELECT COUNT(*) FROM LoginIng WHERE ID = ?', [id])).toBe(0);
    expect(await db.scalar<string | null>('SELECT LastLogin FROM Member WHERE ID = ?', [id])).toBe(last);
    await checks.checkpoint(`refused-${id}`);
  });
}

test('wrong password, unknown id and a differently-cased id (BINARY(ID)) get the same PHP message', async ({ page, checks }) => {
  checks.allow(/\/v1\/auth\/login$/, 401);
  await page.goto('/auth/login');
  for (const [id, pw] of [['e2elearn01', '2222'], ['nobody0001', LEARNER_PASSWORD], ['E2ELEARN01', LEARNER_PASSWORD]] as const) {
    const res = page.waitForResponse((r) => r.url().endsWith('/v1/auth/login'));
    await submitLogin(page, id, pw);
    expect((await res).status()).toBe(401);
    await expect(loginFormMessage(page)).toHaveText(LOGIN_MESSAGES.invalid);
  }
  await checks.checkpoint('login-wrong-password');
});

test('empty id / empty password: separate messages, no request sent (function.js LoginSubmit)', async ({ page, checks }) => {
  let posted = 0;
  page.on('request', (r) => { if (r.url().endsWith('/v1/auth/login')) posted++; });
  await page.goto('/auth/login');
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  await expect(loginFormMessage(page)).toHaveText('아이디를 입력하세요.');
  await page.locator('#login-id').fill('   ');
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  await expect(loginFormMessage(page)).toHaveText('아이디를 입력하세요.');
  await page.locator('#login-id').fill('e2elearn01');
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
  await expect(loginFormMessage(page)).toHaveText('비밀번호를 입력하세요.');
  await expect(page.locator('#login-pw')).toBeFocused();
  expect(posted).toBe(0);
  await checks.checkpoint('login-empty-fields');
});

test('login limit: 10 attempts per minute per (IP, id); the 11th is refused even with the right password, other ids still work', async ({ page, checks, db }) => {
  const id = 'xauthlimit01';
  await resetMember(id);
  checks.allow(/\/v1\/auth\/login$/, 401).allow(/\/v1\/auth\/login$/, 429);
  await page.goto('/auth/login');
  for (let i = 1; i <= 10; i++) {
    const res = page.waitForResponse((r) => r.url().endsWith('/v1/auth/login'));
    await submitLogin(page, id, `wrong${i}`);
    expect((await res).status(), `attempt ${i}`).toBe(401);
  }
  const res = page.waitForResponse((r) => r.url().endsWith('/v1/auth/login'));
  await submitLogin(page, id, LEARNER_PASSWORD);
  expect((await res).status()).toBe(429);
  await expect(loginFormMessage(page)).toHaveText(LOGIN_MESSAGES.tooMany);
  expect(await count('SELECT COUNT(*) FROM LoginIng WHERE ID = ?', [id])).toBe(0);
  await checks.checkpoint('login-limit');
  // the bucket is (IP, id): a colleague behind the same office IP is not locked out
  await hidePopups(page);
  await submitLogin(page, 'xauthout01', LEARNER_PASSWORD);
  await expect(page).toHaveURL(/\/home$/);
  await db.exec('DELETE FROM LoginIng WHERE ID = ?', ['xauthout01']);
});

for (const id of ['xauthq01', 'xauthq02'] as const) {
  test(`password with ' " \\ -- / type is checked in the Replace_Check_XSS2 form (${id})`, async ({ page, checks, db }) => {
    const { password, hash } = SPECIAL[id];
    await resetMember(id, { Pwd: hash });
    await hidePopups(page);
    await loginViaUi(page, id, { password, expectPath: '/home' });
    await expect(page.getByText('이어서 학습하기').first()).toBeVisible();
    await checks.checkpoint(`special-password-${id}`);
    expect(await db.scalar<string>('SELECT Pwd FROM Member WHERE ID = ?', [id])).toBe(hash); // login never rewrites the hash
  });
}

test('Replace_Check_XSS2 equivalence: the PHP login also accepts the password without the stripped "--" / "type"', async ({ page }) => {
  // PHP drops "--" and "type" before hashing, so these typed variants hash to the same stored value (login_ok.php behaviour, kept).
  await resetMember('xauthq01', { Pwd: SPECIAL.xauthq01.hash });
  await resetMember('xauthq02', { Pwd: SPECIAL.xauthq02.hash });
  expect((await loginViaApi(page, 'xauthq01', `Ab'cd"ef\\ghij1!`)).next).toBe('home');
  expect((await loginViaApi(page, 'xauthq02', 'Hex2026!')).next).toBe('home');
  // …but a password that differs in a kept character does not
  const r = await page.request.post('/v1/auth/login', { data: { id: 'xauthq01', password: `Ab"cd'ef\\gh--ij1!`, device: 'PC' } });
  expect(r.status()).toBe(401);
});

test('a login writes LastLogin, one LoginHistory row (Device PC / Mobile, IP, UA) and replaces the LoginIng row', async ({ page, checks, db, clientIp }, info) => {
  const id = 'xauthout01';
  await resetMember(id);
  const before = await count('SELECT COUNT(*) FROM LoginHistory WHERE ID = ?', [id]);
  await hidePopups(page);
  await loginViaUi(page, id, { expectPath: '/home' });
  const ua = await page.evaluate(() => navigator.userAgent);
  const lh = await db.one<{ Device: string; IP: string; UserAgent: string; fresh: number }>(
    'SELECT Device, IP, UserAgent, RegDate >= NOW() - INTERVAL 1 MINUTE AS fresh FROM LoginHistory WHERE ID = ? ORDER BY idx DESC LIMIT 1', [id]);
  expect(await count('SELECT COUNT(*) FROM LoginHistory WHERE ID = ?', [id])).toBe(before + 1);
  expect(lh).toMatchObject({ Device: isPhone(info) ? 'Mobile' : 'PC', IP: clientIp, UserAgent: ua.slice(0, 255), fresh: 1 });
  const m = await db.one<{ LastLoginIP: string; fresh: number }>('SELECT LastLoginIP, LastLogin >= NOW() - INTERVAL 1 MINUTE AS fresh FROM Member WHERE ID = ?', [id]);
  expect(m).toEqual({ LastLoginIP: clientIp, fresh: 1 });
  const ing = await db.query<{ SessionID: string; IP: string }>('SELECT SessionID, IP FROM LoginIng WHERE ID = ?', [id]);
  expect(ing).toHaveLength(1);
  expect(ing[0]!.IP).toBe(clientIp);
  await checks.checkpoint('login-recorded');
  // a second login (same learner, another session) deletes the old LoginIng row and inserts its own (login_ok.php:99-108)
  await loginViaApi(page, id);
  const ing2 = await db.query<{ SessionID: string }>('SELECT SessionID FROM LoginIng WHERE ID = ?', [id]);
  expect(ing2).toHaveLength(1);
  expect(ing2[0]!.SessionID).not.toBe(ing[0]!.SessionID);
});

test('logout: LoginIng row deleted, refresh cookie gone, back to the main page as a guest; 아이디 저장 keeps the id', async ({ page, checks, db }, info) => {
  const id = 'xauthout01';
  await resetMember(id);
  await hidePopups(page);
  await page.goto('/auth/login');
  await page.getByText('아이디 저장').click();
  await submitLogin(page, id, LEARNER_PASSWORD);
  await expect(page).toHaveURL(/\/home$/);
  expect(await count('SELECT COUNT(*) FROM LoginIng WHERE ID = ?', [id])).toBe(1);
  const out = page.waitForResponse((r) => r.url().endsWith('/v1/auth/logout'));
  await logoutViaHeader(page, info);
  expect((await out).status()).toBe(200);
  await expect(page.getByText('로그아웃되었습니다. 서버에 저장된 학습기록은 유지됩니다.')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => count('SELECT COUNT(*) FROM LoginIng WHERE ID = ?', [id])).toBe(0);
  await checks.checkpoint('logged-out');
  // a reload stays signed out (the httpOnly refresh cookie was cleared; the boot refresh answers 401)
  await page.reload();
  const menu = await openSiteMenu(page);
  await expect(menu.getByText('로그인하고 학습을 이어가세요')).toBeVisible();
  await expect(menu.getByRole('button', { name: '로그아웃' })).toHaveCount(0);
  expect((await page.context().cookies()).find((c) => c.name === 'ainex_rt')).toBeUndefined();
  // 아이디 저장: the login form starts with the id and the password field focused
  await page.goto('/auth/login');
  await expect(page.locator('#login-id')).toHaveValue(id);
  await expect(page.locator('#login-pw')).toBeFocused();
});

test('an authenticated learner opening /auth/login is sent on (login_not_check.php)', async ({ page }) => {
  await hidePopups(page);
  await loginViaApi(page, 'xauthout01');
  await page.goto('/auth/login?next=/catalog');
  await expect(page).toHaveURL(/\/catalog$/);
  await page.goto('/auth/login');
  await expect(page).toHaveURL(/\/home$/);
});

test('logout while the 15-minute access token has expired still signs out (token renewed, LoginIng row deleted, cookie cleared)', async ({ page, checks, db }, info) => {
  const id = 'xauthout01';
  await resetMember(id);
  checks.allow(/\/v1\/auth\/logout$/, 401);
  await hidePopups(page);
  await loginViaUi(page, id, { expectPath: '/home' });
  // the first logout request carries what an expired access token looks like to the API
  let first = true;
  await page.route('**/v1/auth/logout', async (route) => {
    if (!first) return route.fallback();
    first = false;
    return route.continue({ headers: { ...route.request().headers(), authorization: 'Bearer expired.access.token' } });
  });
  const statuses: number[] = [];
  page.on('response', (r) => { if (r.url().endsWith('/v1/auth/logout')) statuses.push(r.status()); });
  await logoutViaHeader(page, info);
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => statuses).toEqual([401, 200]);
  await expect.poll(() => count('SELECT COUNT(*) FROM LoginIng WHERE ID = ?', [id])).toBe(0);
  expect((await page.context().cookies()).find((c) => c.name === 'ainex_rt')).toBeUndefined();
  await page.goto('/my/profile');
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fmy%2Fprofile$/); // really signed out: the reload finds no session
  await checks.checkpoint('logout-expired-token');
  expect(await db.scalar('SELECT COUNT(*) FROM LoginIng WHERE ID = ?', [id])).toBe(0);
});
