/**
 * 아이디 찾기 / 비밀번호 찾기 (find_id.html → search_id_result.php; find_pw.html → search_pw_otp_send.php → search_pw_result.php).
 * NICE and SMS are BLOCKED here: the API writes the SmsSendLog row like the PHP and answers SEND_NOT_CONFIGURED with the PHP failure
 * text; the screen links to the same page on the existing site (never followed). With no 인증번호 issued, the 5-minute expiry and the
 * 5-wrong-tries lock of step 2 cannot be reached in a browser (OtpState unit tests cover them); the specs assert the fallback and that
 * the password never changes.
 */
import { test, expect, hidePopups } from '../support/test';
import { HASH_1111, count, randomIp } from './authHelpers';

test.use({ area: 'auth' });

const SEND_FAILED = '시스템 오류가 발생했습니다. 관리자에게 문의하세요.';
const NO_MATCH = '입력하신 정보로 일치하는 회원정보가 없습니다.';
const DORMANT = '현재 휴면계정 상태입니다.[휴면계정 복구] 메뉴를 통해 계정을 복구하세요.';
const NOT_CONFIGURED = '문자 발송이 아직 이 사이트에 연결되지 않았습니다. 기존 사이트의 같은 메뉴를 이용해 주세요.';
const FIND = { id: 'xauthfind01', name: '찾기일', mobile: '010-7790-2001' };

test('아이디 찾기: PHP field checks, no-match / 휴면 / 탈퇴 answers, SmsSendLog row, the id is never shown', async ({ page, checks, db }) => {
  checks.allow(/\/v1\/members\/find-id$/, 404).allow(/\/v1\/members\/find-id$/, 403);
  await hidePopups(page);
  await page.goto('/auth/find-id');
  await checks.checkpoint('find-id');
  const submit = page.getByRole('button', { name: '아이디 전송' });
  const alert = page.locator('form').getByRole('alert');
  let posted = 0;
  page.on('request', (r) => { if (r.url().endsWith('/v1/members/find-id')) posted++; });
  await submit.click();
  await expect(alert).toHaveText('이름을 입력하세요.');
  await page.locator('#fi-name').fill(FIND.name);
  await submit.click();
  await expect(alert).toHaveText('휴대전화번호를 입력하세요.');
  await page.locator('#fi-mobile').fill('010-abcd-2001');
  await submit.click();
  await expect(alert).toHaveText('휴대전화번호는 숫자만 입력하세요.');
  expect(posted).toBe(0);

  const ask = async (name: string, mobile: string) => {
    await page.locator('#fi-name').fill(name);
    await page.locator('#fi-mobile').fill(mobile);
    const res = page.waitForResponse((r) => r.url().endsWith('/v1/members/find-id'));
    await submit.click();
    return res;
  };
  expect((await ask(FIND.name, '010-0000-0000')).status()).toBe(404);
  await expect(alert).toHaveText(NO_MATCH);
  expect((await ask('서탈퇴', '01077041003')).status()).toBe(404); // MemberOut=Y is not searched
  await expect(alert).toHaveText(NO_MATCH);
  expect((await ask('휴면이', '010-7706-1005')).status()).toBe(403);
  await expect(alert).toHaveText(DORMANT);

  const logs = await count('SELECT COUNT(*) FROM SmsSendLog WHERE ID = ?', [FIND.id]);
  const res = await ask(FIND.name, FIND.mobile.replace(/-/g, '')); // digits only also matches (stored 010-7790-2001)
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ sent: false, message: SEND_FAILED, code: 'SEND_NOT_CONFIGURED' });
  await expect(page.getByRole('alert').filter({ hasText: SEND_FAILED })).toBeVisible();
  await expect(page.getByText(NOT_CONFIGURED)).toBeVisible();
  await expect(page.getByRole('link', { name: '기존 사이트에서 아이디 찾기' })).toHaveAttribute('href', 'https://hrdeedu.co.kr/public/member/find_id.html');
  await expect(page.locator('main')).not.toContainText(FIND.id);
  await checks.checkpoint('find-id-not-configured');
  expect(await count('SELECT COUNT(*) FROM SmsSendLog WHERE ID = ?', [FIND.id])).toBe(logs + 1);
  const row = await db.one('SELECT ID, Study_Seq, Massage, Code, Mobile, InputID, RegDate >= NOW() - INTERVAL 1 MINUTE AS fresh FROM SmsSendLog WHERE ID = ? ORDER BY idx DESC LIMIT 1', [FIND.id]);
  expect(row).toEqual({ ID: FIND.id, Study_Seq: 0, Massage: `[E2E] ${FIND.name}님의 아이디는 ${FIND.id} 입니다.`, Code: '', Mobile: '01077902001', InputID: FIND.id, fresh: 1 });
  expect(checks.external).toEqual([]);
});

test('비밀번호 찾기: checks, no match, SEND_NOT_CONFIGURED keeps step 1 and the password unchanged', async ({ page, checks, db }) => {
  checks.allow(/\/v1\/members\/find-password\/otp$/, 404);
  await db.exec("UPDATE Member SET Pwd = ?, PassChange = 'Y' WHERE ID = ?", [HASH_1111, FIND.id]);
  await hidePopups(page);
  await page.goto('/auth/find-password');
  await checks.checkpoint('find-password');
  const send = page.getByRole('button', { name: '인증번호 발송' });
  const alert = page.locator('form').getByRole('alert');
  await send.click();
  await expect(alert).toHaveText('아이디를 입력하세요.');
  await page.locator('#fp-id').fill(FIND.id);
  await send.click();
  await expect(alert).toHaveText('이름을 입력하세요.');
  await page.locator('#fp-name').fill(FIND.name);
  await send.click();
  await expect(alert).toHaveText('휴대전화번호를 입력하세요.');
  await page.locator('#fp-mobile').fill('010-7790-200');
  await send.click();
  await expect(alert).toHaveText('휴대전화번호는 숫자만 입력하세요.');

  await page.locator('#fp-mobile').fill('010-7790-2999');
  let res = page.waitForResponse((r) => r.url().endsWith('/v1/members/find-password/otp'));
  await send.click();
  expect((await res).status()).toBe(404);
  await expect(alert).toHaveText(NO_MATCH);

  const logs = await count('SELECT COUNT(*) FROM SmsSendLog WHERE ID = ?', [FIND.id]);
  await page.locator('#fp-mobile').fill(FIND.mobile);
  res = page.waitForResponse((r) => r.url().endsWith('/v1/members/find-password/otp'));
  await send.click();
  const body = await (await res).json();
  expect(body).toEqual({ sent: false, message: SEND_FAILED, code: 'SEND_NOT_CONFIGURED' });
  await expect(page.getByText(SEND_FAILED)).toBeVisible();
  await expect(page.getByRole('link', { name: '기존 사이트에서 비밀번호 찾기' })).toHaveAttribute('href', 'https://hrdeedu.co.kr/public/member/find_pw.html');
  await expect(page.locator('#fp-otp')).toHaveCount(0); // no 인증번호 step without a sent code (search_pw_otp_send.php clears it)
  await expect(page.locator('#fp-id')).toBeEnabled();
  await checks.checkpoint('find-password-not-configured');
  const row = await db.one<{ Massage: string; Mobile: string; Study_Seq: number; Code: string; InputID: string }>('SELECT Massage, Mobile, Study_Seq, Code, InputID FROM SmsSendLog WHERE ID = ? ORDER BY idx DESC LIMIT 1', [FIND.id]);
  expect(await count('SELECT COUNT(*) FROM SmsSendLog WHERE ID = ?', [FIND.id])).toBe(logs + 1);
  expect(row).toMatchObject({ Mobile: '01077902001', Study_Seq: 0, Code: '', InputID: FIND.id });
  expect(row!.Massage).toMatch(/^\[E2E\] 찾기일님 비밀번호 찾기 인증번호 \[\d{6}\] \(5분\)$/);
  // step 2 cannot start: the API never handed out a challenge; a made-up one is refused like search_pw_result.php:175-177
  const verify = await page.request.post('/v1/members/find-password/verify', { data: { id: FIND.id, challenge: 'made-up', otp: '123456' } });
  expect(verify.status()).toBe(400);
  expect((await verify.json()).error.message).toBe('인증번호를 먼저 발송해주세요.');
  expect(await db.one('SELECT Pwd, PassChange FROM Member WHERE ID = ?', [FIND.id])).toEqual({ Pwd: HASH_1111, PassChange: 'Y' });
});

test.describe('send limit', () => {
  // OtpState counts per (client IP, id) in the API process for 15 minutes; a fresh address per run keeps the spec re-runnable.
  test.use({ extraHTTPHeaders: async ({}, use) => { await use({ 'X-Forwarded-For': randomIp() }); } });

  test('비밀번호 찾기: at most 5 인증번호 sends per 15 minutes for the same id (search_pw_otp_send.php:12-29)', async ({ page, checks, db }) => {
    checks.allow(/\/v1\/members\/find-password\/otp$/, 429);
    await hidePopups(page);
    await page.goto('/auth/find-password');
    await page.locator('#fp-id').fill(FIND.id);
    await page.locator('#fp-name').fill(FIND.name);
    await page.locator('#fp-mobile').fill(FIND.mobile);
    const logs = await count('SELECT COUNT(*) FROM SmsSendLog WHERE ID = ?', [FIND.id]);
    for (let i = 1; i <= 5; i++) {
      const res = page.waitForResponse((r) => r.url().endsWith('/v1/members/find-password/otp'));
      await page.getByRole('button', { name: '인증번호 발송' }).click();
      expect((await res).status(), `send ${i}`).toBe(200);
    }
    const res = page.waitForResponse((r) => r.url().endsWith('/v1/members/find-password/otp'));
    await page.getByRole('button', { name: '인증번호 발송' }).click();
    expect((await res).status()).toBe(429);
    await expect(page.locator('form').getByRole('alert')).toHaveText('인증번호 발송 횟수를 초과했습니다. 15분 후에 다시 시도해주세요.');
    await checks.checkpoint('find-password-limit');
    expect(await count('SELECT COUNT(*) FROM SmsSendLog WHERE ID = ?', [FIND.id])).toBe(logs + 5); // the refused 6th writes nothing
    expect(await db.scalar('SELECT Pwd FROM Member WHERE ID = ?', [FIND.id])).toBe(HASH_1111);
  });
});
