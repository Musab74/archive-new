/**
 * 1:1 문의 (counsel_ask.php + ask_ok.php → POST /v1/support/counsel) and 내 문의 (ask.html / ask_view.html → /support/my(/:idx)) —
 * docs/learner-parity/support.md §2. 보안코드: wrong code → message + a new picture; 문의종류 A–E only; optional own enrolment; one
 * attachment (FileName4Student, stored under the run folder's upload dir); the answer and its files only for the owner.
 */
import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { CaptchaTracker, solveCaptcha, tinyPdf, uploadedFile } from './helpers';

test.use({ area: 'support' });

test.beforeEach(async ({ page }) => { await hidePopups(page); });

const WRONG_CODE = '보안코드가 일치하지 않습니다. 보안코드 이미지를 새로고침하여 다시 시도해주세요.';
const USED_CODE = '보안코드가 만료되었습니다. 보안코드 이미지를 새로고침하여 다시 시도해주세요.';

async function selectOptions(page: Page, label: string): Promise<string[]> {
  await page.getByRole('combobox', { name: label }).click();
  const opts = (await page.getByRole('option').allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  return opts;
}

test('guests are asked to log in (1:1 문의, 내 문의)', async ({ page, checks }) => {
  await page.goto('/support/counsel');
  await expect(page.getByText('로그인 후 문의를 남겨 주세요.')).toBeVisible();
  await checks.checkpoint('counsel-guest');
  await page.goto('/support/my');
  await expect(page.getByText('로그인 후 내 문의를 확인할 수 있습니다.')).toBeVisible();
});

test('1:1 문의: wrong 보안코드 → message + new picture; then saved with own course and one attachment; detail + download', async ({ page, db, checks }) => {
  await db.exec("DELETE FROM Counsel WHERE ID = 'xsupport01'");
  const captcha = new CaptchaTracker(page);
  await openAs(page, 'xsupport01', '/support/counsel');
  await expect(page.getByRole('heading', { name: /확인이 필요한 내용을/ })).toBeVisible();
  await expect.poll(() => captcha.count).toBe(1);
  expect(await selectOptions(page, '문의종류')).toEqual(['학습 내용 문의', '시스템 문의', '이의 제기', '수강 관련 문의', '결제 관련 문의']); // $Counsel_array A–E
  // 관련 콘텐츠 (학습 내용 문의 only): '선택 안 함' + the caller's own enrolments
  const courses = await selectOptions(page, '관련 콘텐츠');
  expect(courses[0]).toBe('선택 안 함');
  expect(courses).toContain('HRD 아카이브 2026');
  await page.getByRole('combobox', { name: '관련 콘텐츠' }).click();
  await page.getByRole('option', { name: 'HRD 아카이브 2026' }).click();
  await page.getByLabel('문의 제목').fill('[E2E] 2차시 자막 문의');
  await page.getByLabel('문의 내용').fill('2차시 자막이 영상과 맞지 않습니다.');
  await page.locator('#cs-file').setInputFiles({ name: '오류화면.pdf', mimeType: 'application/pdf', buffer: tinyPdf('counsel') });
  // a wrong code (one digit changed) is refused, nothing is written, and the form loads a new picture
  const right = captcha.code();
  await page.locator('#cs-captcha').fill(right.slice(0, 4) + String((Number(right[4]) + 1) % 10));
  checks.allow(/\/v1\/support\/counsel$/, 400);
  const bad = page.waitForResponse((r) => r.url().endsWith('/v1/support/counsel') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '문의 등록' }).click();
  expect((await bad).status()).toBe(400);
  await expect(page.getByText(WRONG_CODE).first()).toBeVisible();
  await expect.poll(() => captcha.count).toBe(2);
  await expect(page.locator('#cs-captcha')).toHaveValue('');
  expect(await db.scalar("SELECT COUNT(*) FROM Counsel WHERE ID = 'xsupport01'")).toBe(0);
  await checks.checkpoint('counsel-wrong-code');
  // the right code of the new picture
  await page.locator('#cs-captcha').fill(captcha.code());
  const ok = page.waitForResponse((r) => r.url().endsWith('/v1/support/counsel') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '문의 등록' }).click();
  const res = await ok;
  expect(res.status()).toBe(200);
  const { idx } = await res.json();
  await expect(page.getByText('상담 문의 등록 완료')).toBeVisible();
  const row = await db.one<Record<string, unknown>>(`SELECT c.ID, c.Name, c.Category, c.Title, c.Contents, c.Status, c.Del, c.LectureCode, c.Study_Seq, c.FileName4Student, c.RealFileName4Student,
      c.Mobile = m.Mobile AS sameMobile, c.Email = m.Email AS sameEmail, ${db.aesDec('c.Mobile')} AS mobile
    FROM Counsel c JOIN Member m ON m.ID = c.ID WHERE c.idx = ?`, [idx]);
  expect(row).toMatchObject({ ID: 'xsupport01', Name: '서포일', Category: 'A', Title: '[E2E] 2차시 자막 문의', Contents: '2차시 자막이 영상과 맞지 않습니다.', Status: 'A', Del: 'N',
    LectureCode: 'ARC2026', Study_Seq: 26101, RealFileName4Student: '오류화면.pdf', sameMobile: 1, sameEmail: 1, mobile: '010-7726-2601' });
  expect(String(row!.FileName4Student)).toMatch(/^\d{14}01\.pdf$/); // upload/Counsel/<YmdHis>01.<ext>
  const stored = uploadedFile('Counsel', String(row!.FileName4Student));
  expect(fs.readFileSync(stored).subarray(0, 5).toString()).toBe('%PDF-');
  await checks.checkpoint('counsel-done');
  await page.getByRole('link', { name: '접수한 문의 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`/support/my/${idx}$`));
  await expect(page.getByRole('heading', { name: '[E2E] 2차시 자막 문의' })).toBeVisible();
  await expect(page.getByText(/학습 내용 문의 · 등록일/)).toBeVisible();
  await expect(page.getByText('관련 콘텐츠: HRD 아카이브 2026')).toBeVisible();
  await expect(page.getByText('답변을 준비 중입니다. 답변이 등록되면 이곳에 표시됩니다.')).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '오류화면.pdf' }).click();
  expect((await dl).suggestedFilename()).toBe('오류화면.pdf');
  await checks.checkpoint('counsel-detail-own');
  // 내 문의 list: newest first, 대기, 처리일 '-'
  await page.getByRole('link', { name: '목록' }).click();
  const first = page.locator('a[role="row"]').first();
  await expect(first).toHaveAttribute('href', `/support/my/${idx}`);
  await expect(first).toContainText('[E2E] 2차시 자막 문의');
  await expect(first).toContainText('대기');
});

test('1:1 문의 API rules: A–E only, own enrolment only, a 보안코드 works once', async ({ page }) => {
  const login = await openAs(page, 'xsupport01', '/support/my');
  const auth = { Authorization: `Bearer ${login.accessToken}` };
  const token = async () => (await (await page.request.get('/v1/support/captcha?purpose=counsel')).json()).token as string;
  const post = (data: Record<string, unknown>) => page.request.post('/v1/support/counsel', { headers: auth, data });
  let t = await token();
  let r = await post({ category: 'F', title: 't', contents: 'c', captchaToken: t, captchaCode: solveCaptcha(t) });
  expect(r.status()).toBe(400);
  expect(JSON.stringify(await r.json())).toContain('문의종류를 선택해 주세요.');
  t = await token();
  r = await post({ category: 'A', title: 't', contents: 'c', studySeq: 9401, captchaToken: t, captchaCode: solveCaptcha(t) }); // e2elearn01's enrolment
  expect(r.status()).toBe(400);
  expect(JSON.stringify(await r.json())).toContain('선택한 수강 과정을 찾을 수 없습니다.');
  r = await post({ category: 'B', title: 't', contents: 'c', captchaToken: t, captchaCode: solveCaptcha(t) }); // same token again
  expect(r.status()).toBe(400);
  expect(JSON.stringify(await r.json())).toContain(USED_CODE);
  t = await token();
  r = await post({ category: 'B', title: 't', contents: 'c', captchaToken: t, captchaCode: '' });
  expect(r.status()).toBe(400);
  t = await token(); // a counsel token is refused by the 기업교육상담 form (bound to its purpose)
  r = await page.request.post('/v1/support/inquiries', { data: { companyName: 'x', name: 'x', phone: '01012345678', email: 'a@b.co', personnel: '3', contents: 'x', agree: true, captchaToken: t, captchaCode: solveCaptcha(t) } });
  expect(r.status()).toBe(400);
});

test('내 문의 (e2elearn01): own rows only, 완료 answer with its files, 대기 note', async ({ page, checks }) => {
  await openAs(page, 'e2elearn01', '/support/my');
  const rows = page.locator('a[role="row"]');
  await expect(rows).toHaveCount(2); // 9902 (−1 d), 9901 (−4 d); 9903 belongs to e2ecco01
  await expect(rows.nth(0)).toContainText('[E2E] 동영상 끊김 문의 (답변 대기)');
  await expect(rows.nth(0)).toContainText('대기');
  await expect(rows.nth(1)).toContainText('[E2E] 3차시 실습 파일 문의');
  await expect(rows.nth(1)).toContainText('완료');
  await expect(page.getByText('[E2E] 다른 학습자의 문의')).toHaveCount(0);
  await checks.checkpoint('my-counsel');
  await rows.nth(1).click();
  await expect(page).toHaveURL(/\/support\/my\/9901$/);
  const answer = page.getByRole('region', { name: '답변' });
  await expect(answer).toContainText('AINEX 아카이브 운영자의 답변입니다.');
  await expect(answer).toContainText('실습 파일은 학습자료실에 올려두었습니다.');
  await expect(page.getByText('관련 콘텐츠: [E2E] 데이터 리터러시 실무')).toBeVisible();
  const dl = page.waitForEvent('download');
  await answer.getByRole('button', { name: '화면캡처.pdf' }).click();
  expect((await dl).suggestedFilename()).toBe('화면캡처.pdf');
  await checks.checkpoint('my-counsel-answer');
  await page.goto('/support/my/9902');
  await expect(page.getByText('답변을 준비 중입니다. 답변이 등록되면 이곳에 표시됩니다.')).toBeVisible();
  await expect(page.getByRole('region', { name: '답변' })).toHaveCount(0);
});

test('another learner cannot open the question or its answer files', async ({ page, checks }) => {
  const login = await openAs(page, 'e2ecco01', '/support/my');
  await expect(page.locator('a[role="row"]')).toHaveCount(1); // only 9903
  checks.allow(/\/v1\/support\/counsel\/9901$/, 404);
  await page.goto('/support/my/9901');
  await expect(page.getByText('[E2E] 3차시 실습 파일 문의')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '목록' }).or(page.getByRole('button', { name: '목록' })).first()).toBeVisible();
  for (const slot of ['1', 'student']) {
    const r = await page.request.get(`/v1/support/counsel/9901/files/${slot}`, { headers: { Authorization: `Bearer ${login.accessToken}` } });
    expect(r.status()).toBe(404);
  }
  await checks.checkpoint('my-counsel-foreign');
});
