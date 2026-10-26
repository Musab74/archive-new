/**
 * Site chrome by role (archive/include/header.html, main_navigation.html, footer.html → Header / Footer), the Live Class SSO launch
 * (openLiveClass: login check, then LIVE_CLASS_URL?token=<PHP-shaped JWT>; PC new tab, mobile same window — the harness aborts the
 * off-site request, it is only inspected) and the home popup (popup/include_popup.php: 오늘 하루 창 열지 않기 until 23:59:59, never
 * on the login page). Reference: docs/learner-parity/auth.md §2.13, catalog.md §7–8.
 */
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, hidePopups, dismissPopups } from '../support/test';
import { loginViaApi } from '../support/login';
import { isPhone, jwtPayload, openSiteMenu } from './authHelpers';

test.use({ area: 'auth' });

async function headerAccount(page: Page, info: TestInfo) {
  // desktop: the account sits in the header bar; phone: inside the 전체메뉴 drawer
  return isPhone(info) ? openSiteMenu(page) : page.locator('header');
}

test('guest chrome: 로그인 / 회원가입, 수강신청 CTA, no member-only menu items, SiteInfomation footer', async ({ page, checks }, info) => {
  await hidePopups(page);
  await page.goto('/catalog');
  if (!isPhone(info)) {
    await expect(page.locator('header').getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/auth/login?next=%2Fcatalog');
    await expect(page.locator('header').getByRole('link', { name: '수강신청' })).toHaveAttribute('href', '/support/inquiry/new');
  }
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('에이치알디이');
  await expect(footer).toContainText('1811-9530');
  await expect(footer).toContainText('help@example.com');
  await expect(footer).toContainText('경기도 용인시');
  await expect(footer).toContainText('Copyright AINEX');
  await expect(footer.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
  await expect(footer.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute('href', '/privacy');
  await checks.checkpoint('chrome-guest');
  const menu = await openSiteMenu(page);
  await expect(menu.getByText('로그인하고 학습을 이어가세요')).toBeVisible();
  await expect(menu.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/auth/login?next=%2Fcatalog');
  await expect(menu.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', '/auth/signup/terms');
  // groups whose items are all members-only are left out (진단·추천, 나의 학습실); 참여·지원 drops 만족도조사
  for (const group of ['진단·추천', '나의 학습실']) await expect(isPhone(info) ? menu.getByRole('button', { name: group, exact: true }) : menu.getByRole('heading', { name: group, exact: true })).toHaveCount(0);
  if (isPhone(info)) await menu.getByRole('button', { name: '참여·지원', exact: true }).click();
  await expect(menu.getByRole('link', { name: '공지사항' })).toBeVisible();
  for (const memberOnly of ['만족도조사', '기업 교육담당자', '기업자체교육']) await expect(menu.getByRole('link', { name: memberOnly, exact: true })).toHaveCount(0);
  for (const memberOnly of ['사전역량진단', '회원·이용정보', '나의 학습실 홈', '기업 교육담당자', '기업자체교육']) await expect(menu.getByRole('link', { name: memberOnly, exact: true })).toHaveCount(0);
  await checks.checkpoint('chrome-guest-menu');
});

test('learner chrome: name + 로그아웃, 나의 학습실 CTA, member menu items and 기업자체교육, no manager link', async ({ page, checks }, info) => {
  await hidePopups(page);
  await loginViaApi(page, 'e2elearn01');
  await page.goto('/catalog');
  const account = await headerAccount(page, info);
  await expect(account.getByText('김학습 님').first()).toBeVisible();
  await expect(account.getByRole('button', { name: '로그아웃' }).first()).toBeVisible();
  if (!isPhone(info)) {
    await expect(page.locator('header').getByRole('link', { name: '나의 학습실' })).toHaveAttribute('href', '/my');
    await openSiteMenu(page);
  }
  const menu = page.getByRole('dialog', { name: '전체메뉴' });
  if (isPhone(info)) {
    await expect(menu.getByRole('link', { name: '나의 학습실' }).last()).toHaveAttribute('href', '/my');
    await menu.getByRole('button', { name: '나의 학습실', exact: true }).click();
    await expect(menu.getByRole('link', { name: '회원·이용정보' })).toHaveAttribute('href', '/my/profile');
    await menu.getByRole('button', { name: '참여·지원', exact: true }).click();
  } else {
    await expect(menu.getByRole('link', { name: '회원·이용정보' })).toHaveAttribute('href', '/my/profile');
    await expect(menu.getByRole('link', { name: '사전역량진단' })).toHaveAttribute('href', '/assessment/pre');
  }
  await expect(menu.getByRole('link', { name: '기업자체교육' })).toHaveAttribute('href', '/my/company-training');
  await expect(menu.getByRole('link', { name: '기업 교육담당자' })).toHaveCount(0);
  await checks.checkpoint('chrome-learner-menu');
});

test('manager chrome: the 기업 교육담당자 entry appears for EduManager=Y', async ({ page, checks }, info) => {
  await hidePopups(page);
  await loginViaApi(page, 'e2emgr01');
  await page.goto('/catalog');
  const menu = await openSiteMenu(page);
  if (isPhone(info)) await menu.getByRole('button', { name: '참여·지원', exact: true }).click();
  await expect(menu.getByRole('link', { name: '기업 교육담당자' })).toHaveAttribute('href', '/manager');
  await expect(menu.getByText('강담당 님').first()).toBeVisible();
  await checks.checkpoint('chrome-manager-menu');
  await menu.getByRole('link', { name: '기업 교육담당자' }).click();
  await expect(page).toHaveURL(/\/manager$/);
});

test('Live Class: guests are sent to login; a learner gets LIVE_CLASS_URL?token=<PHP SSO JWT> (PC new tab, phone same window)', async ({ page, checks, db }, info) => {
  await hidePopups(page);
  await page.goto('/live');
  await expect(page.locator('main').getByRole('link', { name: '라이브 입장은 로그인 후 이용할 수 있습니다.' })).toHaveAttribute('href', '/auth/login?next=%2Flive');
  await loginViaApi(page, 'e2emgr01', undefined, isPhone(info) ? 'MOBILE' : 'PC');
  await page.goto('/live');
  const launched: string[] = [];
  page.context().on('request', (r) => { if (r.url().startsWith('https://live.hrdeedu.co.kr')) launched.push(r.url()); });
  await checks.checkpoint('live');
  // read the entry answer on the way through (on phones the page leaves right after it)
  let body: { launchUrl: string } | null = null;
  await page.route('**/v1/support/live/entry', async (route) => {
    const res = await route.fetch();
    body = (await res.json()) as { launchUrl: string };
    await route.fulfill({ response: res });
  });
  const popup = isPhone(info) ? null : page.context().waitForEvent('page');
  await page.getByRole('button', { name: '라이브 클래스 입장' }).click();
  await expect.poll(() => body).not.toBeNull();
  await expect.poll(() => launched.length).toBeGreaterThan(0);
  expect(launched[0]).toBe(new URL(body!.launchUrl).href); // the browser adds the '/' path; same address as the PHP 'https://live.hrdeedu.co.kr?token='
  expect(body!.launchUrl).toMatch(/^https:\/\/live\.hrdeedu\.co\.kr\?token=[\w-]+\.[\w-]+\.[\w-]+$/);
  const url = new URL(body!.launchUrl);
  expect(`${url.origin}${url.pathname}`).toBe('https://live.hrdeedu.co.kr/');
  expect([...url.searchParams.keys()]).toEqual(['token']);
  const claims = jwtPayload(url.searchParams.get('token')!);
  const email = await db.scalar<string>(`SELECT ${db.aesDec('Email')} FROM Member WHERE ID = 'e2emgr01'`);
  expect(claims).toMatchObject({ user_id: 'e2emgr01', name: '강담당', email, member_type: 'M', dept: 'M', role: 'manager', platform: 'hrde_archive', iss: 'https://www.hrdeedu.co.kr', aud: 'https://live.hrdeedu.co.kr' });
  expect(Number(claims.exp) - Number(claims.iat)).toBe(7 * 24 * 3600);
  if (popup) {
    const tab = await popup; // PC: a new tab (archive/include/header.html openLiveClass → window.open(url, '_blank'))
    expect(await tab.evaluate(() => window.opener)).toBeNull();
    await expect(page).toHaveURL(/\/live$/);
    await expect(page.getByText('새 창을 열지 못했습니다. 팝업 허용 상태를 확인한 뒤 다시 입장해 주세요.')).toHaveCount(0);
  } else {
    // phone: the same window goes to the live site (m/m_archive/include/top_header.html → location.href)
    expect(page.context().pages()).toHaveLength(1);
  }
});

test('Live Class token (POST /auth/sso/live-token) is the same PHP payload; a plain learner gets role member', async ({ page }) => {
  const { accessToken } = await loginViaApi(page, 'e2elearn01');
  const r = await page.request.post('/v1/auth/sso/live-token', { headers: { Authorization: `Bearer ${accessToken}` } });
  expect(r.status()).toBe(200);
  const { token, launchUrl } = (await r.json()) as { token: string; launchUrl: string };
  expect(launchUrl).toBe(`https://live.hrdeedu.co.kr?token=${token}`);
  expect(Object.keys(jwtPayload(token))).toEqual(['user_id', 'name', 'email', 'iat', 'exp', 'member_type', 'dept', 'role', 'platform', 'iss', 'aud', 'device']);
  expect(jwtPayload(token)).toMatchObject({ user_id: 'e2elearn01', role: 'member', device: 'desktop' });
});

test('home popup: shown on public pages, 오늘 하루 창 열지 않기 sets Popup<idx> until 23:59:59, never on the login page', async ({ page, checks }) => {
  await page.goto('/auth/login');
  await expect(page.locator('#login-id')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('알림 팝업', { exact: true })).toHaveCount(0);
  await checks.checkpoint('login-no-popup');
  await page.goto('/');
  const layer = page.getByRole('dialog', { name: '[E2E] 신규 과정 오픈 안내' });
  await expect(layer).toBeVisible();
  await expect(page.getByRole('dialog', { name: '[E2E] 지난 팝업' })).toHaveCount(0); // EndDate yesterday
  await checks.checkpoint('home-popup');
  // 닫기 hides it for this page view only
  expect(await dismissPopups(page)).toBe(1);
  await page.goto('/catalog');
  await expect(layer).toBeVisible();
  // 오늘 하루 창 열지 않기
  await layer.getByLabel('오늘 하루 창 열지 않기').click(); // the layer closes on change (CloseLayerDay)
  await expect(layer).toHaveCount(0);
  const cookie = (await page.context().cookies()).find((c) => c.name === 'Popup9801');
  expect(cookie?.value).toBe('1');
  const expires = new Date(cookie!.expires * 1000);
  const now = new Date();
  expect(expires.getFullYear()).toBe(now.getFullYear());
  expect([expires.getMonth(), expires.getDate(), expires.getHours(), expires.getMinutes(), expires.getSeconds()]).toEqual([now.getMonth(), now.getDate(), 23, 59, 59]);
  expect(await page.evaluate(() => localStorage.getItem('hrde_hide_Popup9801'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(layer).toHaveCount(0);
  // signed-in learners see it too (header.html includes the popups for every visitor) — a fresh browser state
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await loginViaApi(page, 'e2elearn01');
  await page.goto('/catalog');
  await expect(layer).toBeVisible();
});
