/**
 * 초기 비밀번호 변경 / 나중에 변경하기 / 회원정보 비밀번호 변경 (mypage/pass_first_change_ok.php, m/…/pwd_first_change.html,
 * myinfo_ok.php), 회원정보 (memberinfo.html: only the e-mail is editable, mobile read-only), 수신 동의 (term_state_update.php) and
 * the 약관·개인정보 pages (etc/include/*.html with the SiteInfomation values). Reference: docs/learner-parity/auth.md §2.9–2.12.
 */
import { test, expect, hidePopups } from '../support/test';
import { LEARNER_PASSWORD } from '../support/accounts';
import { loginViaApi, loginViaUi } from '../support/login';
import { HASH_1111, NEW_PASSWORDS, resetMember } from './authHelpers';

test.use({ area: 'auth' });

const RULE = '비밀번호는 영문, 숫자, 특수문자 중 2개 이상의 조합으로 10자 이상 또는 3개 이상의 조합으로 8자 이상 사용하세요.';
const REPEAT = '비밀번호에 6자 이상의 연속 또는 반복 문자 및 숫자를 사용하실 수 없습니다.';

async function fillChange(page: import('@playwright/test').Page, current: string, pw: string, pw2 = pw) {
  await page.locator('#pc-cur').fill(current);
  await page.locator('#pc-pw').fill(pw);
  await page.locator('#pc-pw2').fill(pw2);
  await page.getByRole('button', { name: '변경하고 계속하기' }).click();
}

test('초기 비밀번호 변경: CheckPassword rule, current password, PHP hash stored, PassChange=Y without EditDate', async ({ page, checks, db }) => {
  const id = 'xauthpw01';
  await resetMember(id, { PassChange: 'N', EditDate: null });
  checks.allow(/\/v1\/auth\/password\/change$/, 400);
  await hidePopups(page);
  await loginViaUi(page, id, { expectPath: '/auth/password-change' });
  await expect(page.getByText('처음 안내받은 비밀번호 또는 문자로 받은 임시 비밀번호를 입력해 주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '나중에 변경하기' })).toBeVisible();
  await expect(page.getByText('나중에 변경하면 이 브라우저에서는 90일 동안 비밀번호 변경 안내를 건너뜁니다.')).toBeVisible();
  await checks.checkpoint('password-first-change');
  const alert = page.locator('form').getByRole('alert');
  await page.getByRole('button', { name: '변경하고 계속하기' }).click();
  await expect(alert).toHaveText('필수 항목을 입력해 주세요.');
  await fillChange(page, LEARNER_PASSWORD, 'abcd1234');
  await expect(alert).toHaveText(RULE);
  await fillChange(page, LEARNER_PASSWORD, 'aaaaaa12!b');
  await expect(alert).toHaveText(REPEAT);
  await fillChange(page, LEARNER_PASSWORD, NEW_PASSWORDS.quoted.password, 'Different#2026');
  await expect(alert).toHaveText('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
  // wrong current password: the API refuses, nothing changes
  const bad = page.waitForResponse((r) => r.url().endsWith('/v1/auth/password/change'));
  await fillChange(page, '9999', NEW_PASSWORDS.quoted.password);
  expect((await bad).status()).toBe(400);
  await expect(alert).toHaveText('현재 비밀번호를 확인해 주세요.');
  expect(await db.scalar('SELECT Pwd FROM Member WHERE ID = ?', [id])).toBe(HASH_1111);

  const ok = page.waitForResponse((r) => r.url().endsWith('/v1/auth/password/change'));
  await fillChange(page, LEARNER_PASSWORD, NEW_PASSWORDS.quoted.password);
  expect(await (await ok).json()).toEqual({ ok: true, firstChange: true });
  await expect(page.getByText('비밀번호가 변경되었습니다.')).toBeVisible();
  await expect(page).toHaveURL(/\/home$/); // no pending 사전진단 → main (pass_first_change_ok.php → function.js:2279-2282)
  expect(await db.one('SELECT Pwd, PassChange, EditDate FROM Member WHERE ID = ?', [id])).toEqual({ Pwd: NEW_PASSWORDS.quoted.hash, PassChange: 'Y', EditDate: null });
  // the stored form is the PHP one, so the typed password logs in (here and on the PHP site)
  expect((await loginViaApi(page, id, NEW_PASSWORDS.quoted.password)).next).toBe('home');
  await resetMember(id, { PassChange: 'N', EditDate: null });
});

test('나중에 변경하기 (m/ pwd_first_change.html): continues to the main page, the next login skips the step, PassChange stays N', async ({ page, checks, db }) => {
  const id = 'xauthpw01';
  await resetMember(id, { PassChange: 'N', EditDate: null });
  await hidePopups(page);
  await loginViaUi(page, id, { expectPath: '/auth/password-change' });
  const routing = page.waitForResponse((r) => r.url().includes('/v1/members/me/routing'));
  await page.getByRole('button', { name: '나중에 변경하기' }).click();
  expect(new URL((await routing).url()).searchParams.get('skipPassword')).toBe('1');
  await expect(page).toHaveURL(/\/home$/);
  await checks.checkpoint('password-later-home');
  expect(await db.scalar('SELECT PassChange FROM Member WHERE ID = ?', [id])).toBe('N');
  // next login in this browser: login_ok answers password, the skip sends the learner on (m/…/login_ok.php:77-84)
  await page.context().clearCookies();
  await hidePopups(page);
  await loginViaUi(page, id, { expectPath: '/home' });
  // 회원·이용정보 still reminds that the first change is pending
  await page.goto('/my/profile');
  await expect(page.getByRole('alert').filter({ hasText: '최초 비밀번호 변경이 필요합니다.' })).toBeVisible();
  // another browser without the skip is asked again
  const fresh = await page.context().browser()!.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const r = await fresh.request.post('/v1/auth/login', { data: { id, password: LEARNER_PASSWORD, device: 'PC' }, headers: { 'X-Forwarded-For': '10.77.251.3' } });
    expect((await r.json()).next).toBe('password');
  } finally { await fresh.close(); }
});

test('a reload of the password page keeps the 임시 비밀번호 state (flags restored with the session)', async ({ page, checks }) => {
  const id = 'xauthpw01';
  await resetMember(id, { PassChange: 'N', EditDate: null });
  await hidePopups(page);
  await loginViaApi(page, id);
  await page.goto('/auth/password-change'); // boot: POST /auth/refresh (flags) then GET /auth/me (no flags)
  await expect(page.getByRole('button', { name: '나중에 변경하기' })).toBeVisible();
  await expect(page.getByText('처음 안내받은 비밀번호 또는 문자로 받은 임시 비밀번호를 입력해 주세요.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '나중에 변경하기' })).toBeVisible();
  await checks.checkpoint('password-first-change-reloaded');
});

test('나중에 변경하기 with a pending 사전역량진단 goes to the 진단 (m/m_public/member/login_ok.php:78-81)', async ({ page, db }) => {
  // e2epre01 has an active enrollment without 사전진단; give it a temporary password for this test only
  await db.exec("UPDATE Member SET PassChange = 'N' WHERE ID = 'e2epre01'");
  try {
    await hidePopups(page);
    await loginViaUi(page, 'e2epre01', { expectPath: '/auth/password-change' });
    await page.getByRole('button', { name: '나중에 변경하기' }).click();
    await expect(page).toHaveURL(/\/assessment\/pre$/);
  } finally {
    await db.exec("UPDATE Member SET PassChange = 'Y' WHERE ID = 'e2epre01'");
  }
});

test('비밀번호 변경 from 회원정보 (myinfo_ok.php): no 나중에 button, EditDate written', async ({ page, checks, db }) => {
  const id = 'xauthpw03';
  await resetMember(id, { PassChange: 'Y', EditDate: null });
  await hidePopups(page);
  await loginViaApi(page, id);
  await page.goto('/my/profile');
  await page.getByRole('link', { name: '변경', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/password-change$/);
  await expect(page.getByRole('button', { name: '나중에 변경하기' })).toHaveCount(0);
  await checks.checkpoint('password-change-normal');
  const ok = page.waitForResponse((r) => r.url().endsWith('/v1/auth/password/change'));
  await fillChange(page, LEARNER_PASSWORD, NEW_PASSWORDS.plain.password);
  expect(await (await ok).json()).toEqual({ ok: true, firstChange: false });
  await expect(page.getByText('비밀번호가 변경되었습니다.')).toBeVisible();
  const m = await db.one<{ Pwd: string; PassChange: string; fresh: number }>('SELECT Pwd, PassChange, EditDate >= NOW() - INTERVAL 1 MINUTE AS fresh FROM Member WHERE ID = ?', [id]);
  expect(m).toEqual({ Pwd: NEW_PASSWORDS.plain.hash, PassChange: 'Y', fresh: 1 });
  await resetMember(id, { PassChange: 'Y', EditDate: null });
});

test('회원정보: mobile read-only, only the e-mail can change (PHP chkEmail), saved AES with EditDate', async ({ page, checks, db }) => {
  const id = 'xauthprof01';
  await db.exec(`UPDATE Member SET Email = HEX(AES_ENCRYPT(?, 'test-enc-key')), EditDate = NULL WHERE ID = ?`, ['xauthprof01@e2e.example', id]);
  checks.allow(/\/v1\/members\/me$/, 400);
  await hidePopups(page);
  await loginViaApi(page, id);
  await page.goto('/my/profile');
  const table = page.locator('main table').first();
  await expect(table).toContainText('xauthprof01');
  await expect(table).toContainText('정보일');
  await expect(table).toContainText('010-7790-1006');
  await expect(table).toContainText('본인인증 후 변경');
  await expect(table).toContainText('휴대폰 번호는 본인인증 정보입니다. 정정이 필요하면 고객지원에 문의해 주세요.');
  await expect(table).toContainText('xauthprof01@e2e.example');
  await expect(table).toContainText('인증팀 / 대리');
  await expect(table).toContainText('E2E 인증상사');
  await checks.checkpoint('profile');
  await page.getByRole('button', { name: '이메일 변경' }).first().click();
  const form = page.locator('main form');
  await expect(form.getByRole('textbox')).toHaveCount(1); // e-mail only: no mobile / 부서 / 직위 inputs
  await form.getByLabel('이메일').fill('a+b@example.com');
  await form.getByRole('button', { name: '변경사항 저장' }).click();
  await expect(form.getByRole('alert')).toHaveText('이메일을 정확하게 입력하세요.');
  await checks.checkpoint('profile-email-edit');
  const save = page.waitForResponse((r) => r.url().endsWith('/v1/members/me') && r.request().method() === 'PATCH');
  await form.getByLabel('이메일').fill('changed.mail@e2e.example');
  await form.getByRole('button', { name: '변경사항 저장' }).click();
  const res = await save;
  expect(res.request().postDataJSON()).toEqual({ email: 'changed.mail@e2e.example' });
  expect(res.status()).toBe(200);
  await expect(page.getByText('회원정보가 변경되었습니다.')).toBeVisible();
  await expect(table).toContainText('changed.mail@e2e.example');
  const m = await db.one(`SELECT ${db.aesDec('Email')} AS email, ${db.aesDec('Mobile')} AS mobile, EditDate >= NOW() - INTERVAL 1 MINUTE AS fresh FROM Member WHERE ID = ?`, [id]);
  expect(m).toEqual({ email: 'changed.mail@e2e.example', mobile: '010-7790-1006', fresh: 1 });
});

test('PATCH /members/me: mobile (and any non-profile field) is rejected, the stored mobile is kept', async ({ page, db }) => {
  const id = 'xauthprof01';
  const { accessToken } = await loginViaApi(page, id);
  const auth = { Authorization: `Bearer ${accessToken}` };
  for (const data of [{ mobile: '010-1111-2222' }, { email: 'ok@e2e.example', mobile: '010-1111-2222' }, { name: '바꾼이름' }]) {
    const r = await page.request.patch('/v1/members/me', { data, headers: auth });
    expect(r.status(), JSON.stringify(data)).toBe(400);
    expect((await r.json()).error.code).toBe('VALIDATION');
  }
  const bad = await page.request.patch('/v1/members/me', { data: { email: 'a+b@example.com' }, headers: auth });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error.message).toBe('이메일을 정확하게 입력하세요.');
  expect(await db.one(`SELECT Name, ${db.aesDec('Mobile')} AS mobile FROM Member WHERE ID = ?`, [id])).toEqual({ Name: '정보일', mobile: '010-7790-1006' });
});

test('수신·동의 설정: the switches write Mailling / Marketing with their dates (term_state_update.php)', async ({ page, checks, db }) => {
  const id = 'xauthprof01';
  await db.exec("UPDATE Member SET Mailling = 'N', MailingDate = NULL, Marketing = 'N', MarketingDate = NULL WHERE ID = ?", [id]);
  await hidePopups(page);
  await loginViaApi(page, id);
  await page.goto('/my/profile');
  const sending = page.getByRole('switch', { name: '수강확인 SMS · 알림톡 · 메일 수신' });
  const marketing = page.getByRole('switch', { name: '교육 소식(마케팅) 수신' });
  await expect(sending).toHaveAttribute('aria-checked', 'false');
  const t1 = page.waitForResponse((r) => r.url().endsWith('/v1/members/me/terms'));
  await sending.click();
  expect((await t1).request().postDataJSON()).toEqual({ mandatory: true, sending: true, marketing: 'N' });
  await expect(sending).toHaveAttribute('aria-checked', 'true');
  const t2 = page.waitForResponse((r) => r.url().endsWith('/v1/members/me/terms'));
  await marketing.click();
  expect((await t2).request().postDataJSON()).toEqual({ mandatory: true, sending: true, marketing: 'Y' });
  await expect(marketing).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('이메일 · SMS')).toBeVisible();
  await checks.checkpoint('profile-consents');
  expect(await db.one('SELECT Mailling, MailingDate IS NOT NULL AS d1, Marketing, MarketingDate IS NOT NULL AS d2, Mandatory FROM Member WHERE ID = ?', [id])).toEqual({ Mailling: 'Y', d1: 1, Marketing: 'Y', d2: 1, Mandatory: 'Y' });
});

test('필수동의 재동의 (after_join_terms.html → term_state_update.php): Mandatory=Y + dates, then the rest of the login routing', async ({ page, checks, db }) => {
  const id = 'e2eterms01';
  await db.exec("UPDATE Member SET Mandatory = 'N', MandatoryDate = NULL, Mailling = NULL, MailingDate = NULL, Marketing = 'N', MarketingDate = NULL WHERE ID = ?", [id]);
  await hidePopups(page);
  await loginViaUi(page, id, { expectPath: '/auth/first-terms' });
  await page.getByRole('button', { name: '동의하기' }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText('이용약관에 동의하여야 회원가입이 가능합니다.');
  await page.getByLabel(/이용약관 동의/).check();
  await page.getByLabel(/개인정보 수집 및 이용 동의/).check();
  await page.getByLabel(/개인정보 제3자 제공 동의/).check();
  await page.getByLabel('이메일', { exact: true }).check(); // 마케팅 이메일 only → E
  await checks.checkpoint('first-terms');
  const post = page.waitForResponse((r) => r.url().endsWith('/v1/members/me/terms'));
  await page.getByRole('button', { name: '동의하기' }).click();
  expect((await post).request().postDataJSON()).toEqual({ mandatory: true, sending: false, marketing: 'E' });
  await expect(page).toHaveURL(/\/home$/);
  expect(await db.one('SELECT Mandatory, MandatoryDate IS NOT NULL AS d0, Mailling, MailingDate IS NOT NULL AS d1, Marketing, MarketingDate IS NOT NULL AS d2 FROM Member WHERE ID = ?', [id]))
    .toEqual({ Mandatory: 'Y', d0: 1, Mailling: 'N', d1: 1, Marketing: 'E', d2: 1 });
  await db.exec("UPDATE Member SET Mandatory = 'N', MandatoryDate = NULL WHERE ID = ?", [id]); // fixture state for the routing spec
});

test('필수동의 + 임시 비밀번호 together: terms first, then the password step, then 나중에 → main (login_ok.php:69-74 order)', async ({ page, db }) => {
  const id = 'xauthpw01';
  await resetMember(id, { PassChange: 'N', Mandatory: 'N', EditDate: null });
  try {
    await hidePopups(page);
    await loginViaUi(page, id, { expectPath: '/auth/first-terms' });
    await page.getByLabel('모두 동의(선택 정보 포함)').check();
    await page.getByRole('button', { name: '동의하기' }).click();
    await expect(page).toHaveURL(/\/auth\/password-change$/); // term_state_update.php: pwchg=N → 비밀번호 변경
    await expect(page.getByRole('button', { name: '나중에 변경하기' })).toBeVisible();
    await page.getByRole('button', { name: '나중에 변경하기' }).click();
    await expect(page).toHaveURL(/\/home$/);
    expect(await db.one('SELECT Mandatory, Mailling, Marketing, PassChange FROM Member WHERE ID = ?', [id])).toEqual({ Mandatory: 'Y', Mailling: 'Y', Marketing: 'Y', PassChange: 'N' });
  } finally {
    await resetMember(id, { PassChange: 'N', Mandatory: 'Y', EditDate: null });
  }
});

test('약관·개인정보: the PHP full text with the SiteInfomation values, tabs and 시행일', async ({ page, checks }) => {
  await hidePopups(page);
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1, name: '이용약관' })).toBeVisible();
  await expect(page.getByText('시행일 2023-07-25')).toBeVisible();
  for (const h of ['제 1 장 총칙', '제 2 장 회원의 권리와 의무', '제 3 장 교육원의 역할', '제 4 장 서비스 관리', '부칙']) await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  await expect(page.getByText('제 1조 목적')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '목차' }).or(page.getByRole('complementary', { name: '목차' }))).toBeVisible();
  await checks.checkpoint('terms');
  await page.getByRole('link', { name: '개인정보처리방침' }).first().click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1, name: '개인정보처리방침' })).toBeVisible();
  const body = page.locator('main');
  await expect(body).toContainText('에이치알디이(이하 "교육원"이라 합니다)');
  await expect(body).toContainText('전화 : 1811-9530');
  await expect(body).toContainText('이메일주소 : help@example.com');
  await expect(body).not.toContainText('{{');
  for (const h of ['1. 수집하는 개인정보의 항목', '6. 개인정보 제공', '10. 개인정보에 관한 민원 서비스']) await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  await checks.checkpoint('privacy');
});
