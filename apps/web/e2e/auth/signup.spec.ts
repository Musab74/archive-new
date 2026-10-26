/**
 * 회원가입 (join_terms.html → join_info.html → join_ok.php; id_check.php, recomid_check.php, company_search.php) end to end.
 * NICE 휴대폰 본인인증 is BLOCKED, so with the production switch FEATURE_SIGNUP_WITHOUT_IDENTITY=false the signup answers
 * IDENTITY_REQUIRED and the screen links to the existing site's join page (never followed). The full join_ok.php write is checked
 * only when the API runs with the test switch on:
 *
 *   E2E_API_FEATURE_SIGNUP_WITHOUT_IDENTITY=true node e2e/stack.mjs restart-api --skip-build
 *   nice -n 10 npm run test:e2e -- auth/signup.spec.ts
 *   node e2e/stack.mjs restart-api --skip-build            # back to the production value
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { loginViaApi, loginViaUi } from '../support/login';
import { NEW_PASSWORDS, count, randomIp } from './authHelpers';

test.use({ area: 'auth' });
// POST /members/signup allows 5 per 10 minutes per IP and the default per-test address is the same on every run: a fresh address
// per test keeps the file re-runnable.
test.use({ extraHTTPHeaders: async ({}, use) => { await use({ 'X-Forwarded-For': randomIp() }); } });

const IDENTITY_MESSAGE = '휴대폰 본인인증은 현재 기존 사이트에서만 진행할 수 있습니다. 기존 사이트에서 회원가입해 주세요.';
const LEGACY_JOIN = 'https://hrdeedu.co.kr/public/member/join_terms.html';

/** Unique per run (6–20 letters/digits, xauth prefix) so the specs re-run on a used DB. */
const uniqueId = () => `xauthj${Date.now().toString(36).slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
const uniqueMobile = () => `010-79${String(Math.floor(Math.random() * 100)).padStart(2, '0')}-${String(Date.now() % 10000).padStart(4, '0')}`;

/** IDENTITY_REQUIRED (503) = production switch; VALIDATION (400, the id rule) = FEATURE_SIGNUP_WITHOUT_IDENTITY on. */
async function signupWithoutIdentityEnabled(request: APIRequestContext): Promise<boolean> {
  const r = await request.post('/v1/members/signup', { data: { id: 'ab', password: 'x', name: 'x', email: 'x', mobile: '010-0000-0000', consents: { mandatory: true } } });
  return r.status() === 400;
}

async function agreeRequired(page: Page) {
  await page.getByLabel(/이용약관 동의/).check();
  await page.getByLabel(/개인정보 수집 및 이용 동의/).check();
  await page.getByLabel(/개인정보 제3자 제공 동의/).check();
}

test('약관 동의: the five PHP consent items start unchecked, each required item has its own message, 보기 shows the full text', async ({ page, checks }) => {
  await hidePopups(page);
  await page.goto('/auth/signup/terms');
  const labels = ['이용약관 동의 (필수)', '개인정보 수집 및 이용 동의 (필수)', '개인정보 제3자 제공 동의 (필수)', '수강확인 SMS · 알림톡 · 메일 수신 동의 (선택)', '교육 소식(마케팅) 수신 동의 (선택)'];
  for (const l of labels) await expect(page.getByLabel(l, { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('이메일', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('SMS', { exact: true })).not.toBeChecked();
  await expect(page.getByText('*비동의 시 수강진도나 수료에 관한 안내가 되지 않습니다.')).toBeVisible();
  await checks.checkpoint('signup-terms');

  const next = page.getByRole('button', { name: '동의하고 다음' });
  await next.click();
  await expect(page.getByRole('alert')).toHaveText('이용약관에 동의하여야 회원가입이 가능합니다.');
  await page.getByLabel(/이용약관 동의/).check();
  await next.click();
  await expect(page.getByRole('alert')).toHaveText('개인정보 수집 및 이용에 동의하여야 회원가입이 가능합니다.');
  await page.getByLabel(/개인정보 수집 및 이용 동의/).check();
  await next.click();
  await expect(page.getByRole('alert')).toHaveText('개인정보의 제3자 제공에 동의하여야 회원가입이 가능합니다.');

  // 보기: the PHP documents (etc/include/*.html) with the SiteInfomation values
  const views = page.getByRole('button', { name: '보기' });
  await views.nth(0).click();
  await expect(page.getByRole('heading', { name: '제 1 장 총칙' })).toBeVisible();
  await expect(page.getByText('제 1조 목적')).toBeVisible();
  await views.nth(1).click();
  await expect(page.getByText('전화 : 1811-9530')).toBeVisible();
  await expect(page.getByText('이메일주소 : help@example.com')).toBeVisible();
  await expect(page.getByText(/에이치알디이\(이하 "교육원"이라 합니다\)/).first()).toBeVisible();
  await views.nth(2).click();
  await expect(page.getByText('한국산업인력공단, 고용노동부')).toBeVisible();
  await checks.checkpoint('signup-terms-view');

  // only the required ones are needed; 마케팅 toggles both channels
  await page.getByLabel(/개인정보 제3자 제공 동의/).check();
  await page.getByLabel(/교육 소식\(마케팅\) 수신 동의/).check();
  await expect(page.getByLabel('이메일', { exact: true })).toBeChecked();
  await expect(page.getByLabel('SMS', { exact: true })).toBeChecked();
  await page.getByLabel('SMS', { exact: true }).uncheck();
  await expect(page.getByLabel(/교육 소식\(마케팅\) 수신 동의/)).toBeChecked(); // a channel alone keeps 마케팅 (JoinAgreeCheckA)
  await next.click();
  await expect(page).toHaveURL(/\/auth\/signup\/info$/);
  expect(JSON.parse((await page.evaluate(() => sessionStorage.getItem('signup.consent.v2'))) ?? '{}')).toEqual({ terms: true, privacy: true, thirdParty: true, sending: false, marketingEmail: true, marketingSms: false });
});

test('모두 동의 checks everything; the info step cannot be opened without the required consent', async ({ page }) => {
  await hidePopups(page);
  await page.goto('/auth/signup/info');
  await expect(page).toHaveURL(/\/auth\/signup\/terms$/);
  await page.getByLabel('모두 동의(선택 정보 포함)').check();
  for (const l of [/이용약관 동의/, /개인정보 수집 및 이용 동의/, /개인정보 제3자 제공 동의/, /수강확인 SMS/, /교육 소식/]) await expect(page.getByLabel(l)).toBeChecked();
  await page.getByRole('button', { name: '동의하고 다음' }).click();
  await expect(page).toHaveURL(/\/auth\/signup\/info$/);
});

test('정보 입력: ID rule and duplicate check (case-insensitive), 추천인 check, company search', async ({ page, checks }) => {
  await hidePopups(page);
  await page.goto('/auth/signup/terms');
  await agreeRequired(page);
  await page.getByRole('button', { name: '동의하고 다음' }).click();
  await expect(page).toHaveURL(/\/auth\/signup\/info$/);
  await checks.checkpoint('signup-info');

  const idInput = page.locator('#su-id');
  const idCheck = page.getByRole('button', { name: '중복 확인' });
  let idChecks = 0;
  page.on('request', (r) => { if (r.url().endsWith('/v1/members/id-check')) idChecks++; });
  // function.js ID_Validity() before any request
  await idInput.fill('abc12');
  await idCheck.click();
  await expect(page.getByText('아이디는 6자이상 20자 이내로 입력하세요.')).toBeVisible();
  await idInput.fill('abc_1234');
  await idCheck.click();
  await expect(page.getByText('아이디는 영문/숫자만 입력 가능합니다.')).toBeVisible();
  expect(idChecks).toBe(0);
  // id_check.php compares with the table collation: another case of an existing id is taken
  for (const taken of ['e2elearn01', 'E2ELEARN01', 'XauthQ01']) {
    await idInput.fill(taken);
    const res = page.waitForResponse((r) => r.url().endsWith('/v1/members/id-check'));
    await idCheck.click();
    expect(await (await res).json()).toEqual({ available: false, reason: '이미 사용중인 아이디입니다.' });
    await expect(page.getByText('이미 사용중인 아이디입니다.')).toBeVisible();
  }
  // withdrawn / unused accounts still hold their id (SELECT * FROM Member WHERE ID=…)
  await idInput.fill('e2eout01');
  await idCheck.click();
  await expect(page.getByText('이미 사용중인 아이디입니다.')).toBeVisible();
  const fresh = uniqueId();
  await idInput.fill(fresh);
  await idCheck.click();
  await expect(page.getByText('사용 가능한 아이디입니다.')).toBeVisible();
  // editing the id after a check needs a new check (function.js ID_Check reset)
  await idInput.fill(`${fresh}x`);
  await expect(page.getByText('사용 가능한 아이디입니다.')).toHaveCount(0);

  // 추천인 ID (recomid_check.php: any Member row, case-insensitive)
  const recom = page.locator('#su-recom');
  const recomBtn = page.getByRole('button', { name: '추천인 ID 확인' });
  await recomBtn.click();
  await expect(page.getByText('추천인 ID를 입력하세요.')).toBeVisible();
  await recom.fill('nobody9999');
  await recomBtn.click();
  await expect(page.getByText('입력하신 추천인 ID가 없습니다.')).toBeVisible();
  await recom.fill('E2EMGR01');
  await recomBtn.click();
  await expect(page.getByText('입력하신 추천인 ID 확인완료되었습니다.')).toBeVisible();

  // 소속 기업 검색 (company_search.php: CompanyName LIKE, ORDER BY CompanyName, "[123-45-67890] 회사명")
  const company = page.locator('#su-company');
  const search = page.getByRole('button', { name: '검색', exact: true });
  await company.fill('이투이');
  await search.click();
  const hits = page.getByRole('listbox', { name: '소속 기업·기관' }).getByRole('option');
  await expect(hits).toHaveText(['[220-88-00001] E2E 이투이물산', '[220-88-00002] E2E 이투이테크']);
  await checks.checkpoint('signup-company-search');
  await hits.nth(1).click();
  await expect(page.getByText('[220-88-00002] E2E 이투이테크')).toBeVisible();
  await page.getByRole('button', { name: '선택 해제' }).click();
  await company.fill('2208800003'); // an exact 사업자번호 also matches
  await search.click();
  await expect(hits).toHaveText(['[220-88-00003] E2E 타사상사']);
  await company.fill('없는회사명');
  await search.click();
  await expect(page.getByText('등록된 사업자정보가 없습니다.')).toBeVisible();
});

test('가입하기 while NICE is not connected: IDENTITY_REQUIRED, the existing-site join link (not followed), nothing written', async ({ page, checks }) => {
  test.skip(await signupWithoutIdentityEnabled(page.request), 'FEATURE_SIGNUP_WITHOUT_IDENTITY is on in this stack (the full-signup test runs instead)');
  checks.allow(/\/v1\/members\/signup$/, 503);
  const id = uniqueId();
  const members = await count('SELECT COUNT(*) FROM Member');
  await hidePopups(page);
  await page.goto('/auth/signup/terms');
  await agreeRequired(page);
  await page.getByRole('button', { name: '동의하고 다음' }).click();
  // function.js MemberJoin() order: 이름 → 휴대폰 → 아이디 → 중복확인 → 비밀번호 → 확인 → 이메일
  const submit = page.getByRole('button', { name: '가입하기' });
  await submit.click();
  await expect(page.getByRole('alert').first()).toHaveText('이름을 입력하세요.');
  await page.locator('#su-name').fill('가입자');
  await submit.click();
  await expect(page.getByRole('alert').first()).toHaveText('휴대전화번호를 입력하세요.');
  await page.locator('#su-mobile').fill('010-12-ab');
  await submit.click();
  await expect(page.getByRole('alert').first()).toHaveText('휴대전화번호는 숫자만 입력하세요.');
  await page.locator('#su-mobile').fill(uniqueMobile());
  await page.locator('#su-id').fill(id);
  await submit.click();
  await expect(page.getByRole('alert').first()).toHaveText('아이디 중복 검색을 하세요.');
  await page.getByRole('button', { name: '중복 확인' }).click();
  await expect(page.getByText('사용 가능한 아이디입니다.')).toBeVisible();
  await page.locator('#su-pw').fill('abcd1234');
  await submit.click();
  await expect(page.getByRole('alert').first()).toHaveText('비밀번호는 영문, 숫자, 특수문자 중 2개 이상의 조합으로 10자 이상 또는 3개 이상의 조합으로 8자 이상 사용하세요.');
  await page.locator('#su-pw').fill('abcdef12!x');
  await submit.click();
  await expect(page.getByRole('alert').first()).toHaveText('비밀번호에 6자 이상의 연속 또는 반복 문자 및 숫자를 사용하실 수 없습니다.');
  await page.locator('#su-pw').fill(NEW_PASSWORDS.plain.password);
  await page.locator('#su-pw2').fill('different1!');
  await submit.click();
  await expect(page.getByRole('alert').first()).toHaveText('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
  await page.locator('#su-pw2').fill(NEW_PASSWORDS.plain.password);
  await page.locator('#su-email').fill('a+b@example.com');
  await submit.click();
  await expect(page.getByRole('alert').first()).toHaveText('이메일을 정확하게 입력하세요.');
  await page.locator('#su-email').fill('gaip@e2e.example');
  const res = page.waitForResponse((r) => r.url().endsWith('/v1/members/signup'));
  await submit.click();
  const r = await res;
  expect(r.status()).toBe(503);
  expect((await r.json()).error).toMatchObject({ code: 'IDENTITY_REQUIRED', message: IDENTITY_MESSAGE });
  await expect(page.getByRole('alert').filter({ hasText: IDENTITY_MESSAGE })).toBeVisible();
  const links = page.getByRole('link', { name: '기존 사이트에서 본인인증 후 가입' });
  await expect(links.first()).toHaveAttribute('href', LEGACY_JOIN);
  await expect(links).toHaveCount(2); // the 본인인증 box and the one under the error
  await checks.checkpoint('signup-identity-required');
  expect(await count('SELECT COUNT(*) FROM Member')).toBe(members);
  expect(await count('SELECT COUNT(*) FROM Member WHERE ID = ?', [id])).toBe(0);
  await expect(page).toHaveURL(/\/auth\/signup\/info$/);
  expect(checks.external).toEqual([]); // the link was not followed
});

test('full signup (FEATURE_SIGNUP_WITHOUT_IDENTITY=true): join_ok.php columns, PHP password hash, login works, duplicates refused', async ({ page, checks, db }) => {
  test.skip(!(await signupWithoutIdentityEnabled(page.request)), 'needs E2E_API_FEATURE_SIGNUP_WITHOUT_IDENTITY=true (see the header of this file)');
  await db.exec("DELETE FROM Member WHERE ID LIKE 'xauthj%' AND RegDate < NOW() - INTERVAL 1 DAY");
  const id = uniqueId();
  const mobile = uniqueMobile();
  const { password, hash } = NEW_PASSWORDS.quoted; // contains ' " -- → stored as SHA-256(Replace_Check_XSS2(password))
  await hidePopups(page);
  await page.goto('/auth/signup/terms');
  await agreeRequired(page);
  await page.getByLabel(/수강확인 SMS/).check();
  await page.getByLabel(/교육 소식\(마케팅\) 수신 동의/).check();
  await page.getByLabel('이메일', { exact: true }).uncheck(); // SMS only → Marketing 'S'
  await page.getByRole('button', { name: '동의하고 다음' }).click();
  await expect(page).toHaveURL(/\/auth\/signup\/info$/);
  await page.waitForLoadState('networkidle');
  await page.locator('#su-id').fill(id);
  await expect(page.locator('#su-id')).toHaveValue(id);
  await page.getByRole('button', { name: '중복 확인' }).click();
  await expect(page.getByText('사용 가능한 아이디입니다.')).toBeVisible();
  await page.locator('#su-pw').fill(password);
  await page.locator('#su-pw2').fill(password);
  await page.locator('#su-name').fill('가입자');
  await page.locator('#su-mobile').fill(mobile.replace(/-/g, ''));
  await page.locator('#su-email').fill(`${id}@e2e.example`);
  await page.locator('#su-recom').fill('e2emgr01');
  await page.getByRole('button', { name: '추천인 ID 확인' }).click();
  await expect(page.getByText('입력하신 추천인 ID 확인완료되었습니다.')).toBeVisible();
  await page.locator('#su-company').fill('인증상사');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('option', { name: '[220-88-20001] E2E 인증상사' }).click();
  const res = page.waitForResponse((r) => r.url().endsWith('/v1/members/signup'));
  await page.getByRole('button', { name: '가입하기' }).click();
  expect((await res).status()).toBe(200);
  await expect(page).toHaveURL(/\/auth\/signup\/complete$/);
  await expect(page.getByText('회원가입이 완료되었습니다.')).toBeVisible();
  await expect(page.getByText('회원가입만으로 아카이브 이용권한이 자동 부여되지는 않습니다.')).toBeVisible();
  await checks.checkpoint('signup-complete');

  const m = await db.one<Record<string, unknown>>(`SELECT MemberType, Pwd, Name, ${db.aesDec('BirthDay')} AS BirthDay, Gender, ${db.aesDec('Email')} AS Email, Tel, ${db.aesDec('Mobile')} AS Mobile,
      Zipcode, Address01, Address02, NameEng, CompanyCode, Depart, Position, Etc01, Etc02, Mandatory, MandatoryDate IS NOT NULL AS mDate, Mailling, MailingDate IS NOT NULL AS mlDate, ACS,
      Marketing, MarketingDate IS NOT NULL AS mkDate, MemberOut, Sleep, UseYN, RegDate >= NOW() - INTERVAL 5 MINUTE AS fresh, ${db.aesDec('ResNo')} AS ResNo, EduManager, PassChange, RecomID, TestID, Sending
    FROM Member WHERE ID = ?`, [id]);
  expect(m).toEqual({
    MemberType: 'A', Pwd: hash, Name: '가입자', BirthDay: '0000-00-00', Gender: '', Email: `${id}@e2e.example`, Tel: '', Mobile: mobile,
    Zipcode: '', Address01: '', Address02: '', NameEng: '', CompanyCode: '2208820001', Depart: '', Position: '', Etc01: '', Etc02: '', Mandatory: 'Y', mDate: 1,
    Mailling: 'Y', mlDate: 1, ACS: 'Y', Marketing: 'S', mkDate: 1, MemberOut: 'N', Sleep: 'N', UseYN: 'Y', fresh: 1, ResNo: '0000000000000',
    EduManager: 'N', PassChange: 'Y', RecomID: 'e2emgr01', TestID: 'N', Sending: 'N',
  });

  // the new account signs in with the typed password (PHP login form) and lands on the main learning page
  await loginViaUi(page, id, { password, expectPath: '/home' });
  await checks.checkpoint('signup-first-login');

  // duplicates: same id in another case (join_ok.php SELECT … WHERE ID=), same mobile (nice_auth_join_result.php)
  const dupId = await page.request.post('/v1/members/signup', { data: { id: id.toUpperCase(), password, name: '중복', email: 'dup@e2e.example', mobile: uniqueMobile(), consents: { mandatory: true } } });
  expect(dupId.status()).toBe(409);
  expect((await dupId.json()).error.message).toBe('동일한 아이디가 존재합니다.');
  const dupMobile = await page.request.post('/v1/members/signup', { data: { id: uniqueId(), password, name: '중복', email: 'dup@e2e.example', mobile, consents: { mandatory: true } } });
  expect(dupMobile.status()).toBe(409);
  expect((await dupMobile.json()).error.message).toBe('이미 가입된 회원입니다. 아이디 찾기를 이용해 주세요.');
});

test('a signed-in learner opening the signup steps is sent home (login_not_check.php)', async ({ page }) => {
  await hidePopups(page);
  await loginViaApi(page, 'xauthout01');
  await page.goto('/auth/signup/terms');
  await expect(page).toHaveURL(/\/home$/);
  await page.goto('/auth/signup/info');
  await expect(page).toHaveURL(/\/home$/);
});
