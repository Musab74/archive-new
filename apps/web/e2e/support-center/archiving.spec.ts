/**
 * 아카이빙 · 기업자체콘텐츠 등록 요청 (archive/archiving/*, api/archiving-detail.php, download.php code=Archiving) —
 * docs/learner-parity/support.md §2: login, own rows (Del N, RegDate DESC, 25/page), detail owner only, the file and the answer only
 * once Status = 'B' (완료), upload to upload/Archiving/<YmdHis>01.<ext> (here: the run folder's HRDE_UPLOAD_DIR).
 */
import fs from 'node:fs';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { tinyPdf, uploadedFile } from './helpers';

test.use({ area: 'support' });

test.beforeEach(async ({ page }) => { await hidePopups(page); });

test('guests see the guidance and a login request', async ({ page, checks }) => {
  await page.goto('/support/archiving');
  await expect(page.getByRole('heading', { name: '아카이빙 · 기업자체콘텐츠 등록 요청' })).toBeVisible();
  await expect(page.getByText('올바른 업로드 요청 예시')).toBeVisible();
  await expect(page.getByText('로그인 후 콘텐츠 등록을 요청할 수 있습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '등록하기' })).toHaveCount(0);
  await checks.checkpoint('archiving-guest');
});

test('own list, 완료 detail with answer + download, 대기 detail without download', async ({ page, checks }) => {
  const login = await openAs(page, 'xsupport01', '/support/archiving');
  const rows = page.locator('a[role="row"]');
  await expect(rows.filter({ hasText: '[E2E] 대기 중인 아카이빙: 안전교육 영상' })).toHaveCount(1);
  const titles = await rows.allInnerTexts();
  const iWait = titles.findIndex((t) => t.includes('대기 중인 아카이빙'));
  const iDone = titles.findIndex((t) => t.includes('완료된 아카이빙'));
  expect(iWait).toBeLessThan(iDone); // RegDate DESC (−3 d before −9 d)
  await expect(rows.nth(iDone)).toContainText('완료');
  await expect(rows.nth(iWait)).toContainText('대기');
  await expect(page.getByText('[E2E] 현업 적용 사례: 주간 보고 자동화')).toHaveCount(0); // e2elearn01's row
  await checks.checkpoint('archiving-list');
  await rows.nth(iDone).click();
  await expect(page).toHaveURL(/\/support\/archiving\/26001$/);
  const answer = page.getByRole('region', { name: '답변' });
  await expect(answer).toContainText('AINEX 아카이브 운영자의 답변입니다.');
  await expect(answer).toContainText('등록이 완료되었습니다.');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '온보딩자료.pdf' }).click();
  expect((await dl).suggestedFilename()).toBe('온보딩자료.pdf');
  await checks.checkpoint('archiving-done');
  await page.goto('/support/archiving/26002');
  await expect(page.getByText(/안전교육\.pdf — 첨부파일은 처리가 완료된 뒤 내려받을 수 있습니다\./)).toBeVisible();
  await expect(page.getByRole('button', { name: '안전교육.pdf' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '답변' })).toHaveCount(0);
  const auth = { Authorization: `Bearer ${login.accessToken}` };
  expect((await page.request.get('/v1/support/archiving/26002/file', { headers: auth })).status()).toBe(404); // download.php: Status B only
  expect((await page.request.get('/v1/support/archiving/26001/file', { headers: auth })).status()).toBe(200);
});

test('another learner cannot open the row or its file', async ({ page, checks }) => {
  const login = await openAs(page, 'xsupport02', '/support/archiving');
  await expect(page.getByText('등록된 콘텐츠가 없습니다.')).toBeVisible();
  checks.allow(/\/v1\/support\/archiving\/26001$/, 404);
  await page.goto('/support/archiving/26001');
  await expect(page.getByText('[E2E] 완료된 아카이빙: 신입 온보딩 자료')).toHaveCount(0);
  expect((await page.request.get('/v1/support/archiving/26001/file', { headers: { Authorization: `Bearer ${login.accessToken}` } })).status()).toBe(404);
});

test('register request: file required + allowed types; the upload lands in the run folder\'s upload dir', async ({ page, db, checks }) => {
  await db.exec("DELETE FROM Archiving WHERE ID = 'xsupport01' AND idx NOT IN (26001, 26002)");
  await openAs(page, 'xsupport01', '/support/archiving');
  const form = page.getByRole('form', { name: '콘텐츠 등록 요청' });
  await expect(form.getByLabel('제목')).toHaveValue('기업자체컨텐츠 등록 요청'); // archiving_pop.php default title
  await form.getByLabel('내용').fill('[E2E] 사내 보고서 교육 자료입니다.');
  await form.getByRole('button', { name: '등록하기' }).click();
  await expect(form.getByText('파일을 등록해주세요.')).toBeVisible();
  await form.locator('#ar-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(form.getByText('mp4, vod, pdf, doc, docx, xls, xlsx, hwp 파일만 업로드 가능합니다.')).toBeVisible();
  await form.locator('#ar-file').setInputFiles({ name: '사내교육_보고서.pdf', mimeType: 'application/pdf', buffer: tinyPdf('archiving') });
  const res = page.waitForResponse((r) => r.url().endsWith('/v1/support/archiving') && r.request().method() === 'POST');
  await form.getByRole('button', { name: '등록하기' }).click();
  const body = await (await res).json();
  expect(body).toMatchObject({ ok: true });
  await expect(form.getByText('등록되었습니다.')).toBeVisible();
  const row = await db.one<Record<string, unknown>>('SELECT ID, Title, Contents, FileName1, RealFileName1, Status, Del FROM Archiving WHERE idx = ?', [body.idx]);
  expect(row).toMatchObject({ ID: 'xsupport01', Title: '기업자체컨텐츠 등록 요청', Contents: '[E2E] 사내 보고서 교육 자료입니다.', RealFileName1: '사내교육_보고서.pdf', Status: 'A', Del: 'N' });
  expect(String(row!.FileName1)).toMatch(/^\d{14}01\.pdf$/);
  expect(fs.readFileSync(uploadedFile('Archiving', String(row!.FileName1))).subarray(0, 5).toString()).toBe('%PDF-');
  // the new row is listed (대기) and its file cannot be downloaded yet
  await expect(page.locator('a[role="row"]').first()).toContainText('기업자체컨텐츠 등록 요청');
  await expect(page.locator('a[role="row"]').first()).toContainText('대기');
  await checks.checkpoint('archiving-registered');
});
