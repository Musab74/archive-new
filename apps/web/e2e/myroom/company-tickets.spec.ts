/**
 * 기업자체교육(아카이빙) tab (/my/company-training — tab-company.php, archiving_ok.php, api/archiving-detail.php, include/download.php)
 * and 내 문의 (/my/tickets → /support/my/:idx). myroom.md §2.4.
 * Register goes through POST /my/archiving → SupportFormsService.createArchiving (the shared support writer): text stored as typed
 * (no PHP SQL-word stripping), file upload/Archiving/<YmdHis>01.<ext>, Status A, Del N; download only after 완료 (Status B).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { loadStack } from '../support/stack';
import { authed, fileNameOf } from './helpers';

test.use({ area: 'myroom' });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(HERE, '../fixtures/media/upload/Archiving/e2e_archiving_note.pdf');
const ARCHIVING_DIR = () => path.join(loadStack().stateDirs.HRDE_UPLOAD_DIR, 'Archiving');
const PREFIX = '[E2E-MYROOM]';

test('waiting row (Status A): detail without download, 답변 검토 중; the file endpoint refuses', async ({ page, checks }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, 'e2elearn01', '/my/company-training');
  await expect(page.getByRole('heading', { name: '기업 아카이빙이란' })).toBeVisible();
  await expect(page.getByText('· 등록된 콘텐츠는 검토 후 3영업일 이내 승인 여부가 통보됩니다.')).toBeVisible();
  const list = page.getByRole('region', { name: '등록 콘텐츠 관리' });
  const row = list.locator('tbody tr').filter({ hasText: '[E2E] 현업 적용 사례: 주간 보고 자동화' });
  await expect(row).toHaveCount(1);
  await expect(row.locator('td').nth(0)).toHaveText('1');
  await expect(row.locator('td').nth(3)).toHaveText('PDF');
  await expect(row.locator('td').nth(4)).toHaveText('대기');
  await checks.checkpoint('archiving-list-waiting');
  await row.getByRole('button').click();
  const dlg = page.getByRole('dialog', { name: '등록 콘텐츠' });
  await expect(dlg).toContainText('피벗과 차트로 주간 보고 시간을 절반으로 줄였습니다.');
  await expect(dlg).toContainText('승인 완료 후 파일 다운로드가 가능합니다.');
  await expect(dlg).toContainText('답변 검토 중입니다. 완료 시 알려드리겠습니다.');
  await expect(dlg.getByRole('button', { name: /파일 다운로드/ })).toHaveCount(0);
  await checks.checkpoint('archiving-detail-waiting');
  const res = await authed(page, accessToken).get('/v1/my/archiving/9951/file');
  expect(res.status()).toBe(404);
  expect((await res.json()).error.message).toBe('파일이 존재하지 않습니다.');
});

test('완료 row (Status B): answer HTML and the download with the original file name; foreign / deleted rows are not listed or opened', async ({ page, checks }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, 'xmyroom02', '/my/company-training');
  const list = page.getByRole('region', { name: '등록 콘텐츠 관리' });
  await expect(list.locator('tbody tr').filter({ hasText: '[E2E] 승인된 사내 교육자료' })).toHaveCount(1);
  await expect(list).not.toContainText('[E2E] 삭제된 아카이빙'); // Del Y
  await expect(list).not.toContainText('[E2E] 현업 적용 사례'); // e2elearn01's
  const row = list.locator('tbody tr').filter({ hasText: '[E2E] 승인된 사내 교육자료' });
  await expect(row.locator('td').nth(4)).toHaveText('완료');
  await row.getByRole('button').click();
  const dlg = page.getByRole('dialog', { name: '등록 콘텐츠' });
  await expect(dlg).toContainText('승인되었습니다. 업로드 절차를 안내드립니다.');
  await expect(dlg).toContainText('운영자');
  await expect(dlg).not.toContainText('승인 완료 후 파일 다운로드가 가능합니다.');
  await checks.checkpoint('archiving-detail-done');
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: '파일 다운로드 · 승인자료.pdf' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('승인자료.pdf');
  const bytes = fs.readFileSync((await file.path())!);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const api = authed(page, accessToken);
  const direct = await api.get('/v1/my/archiving/24951/file');
  expect(direct.status()).toBe(200);
  expect(fileNameOf(direct)).toBe('승인자료.pdf');
  expect((await api.get('/v1/my/archiving/9951')).status()).toBe(404); // another learner's row
  expect((await api.get('/v1/my/archiving/9951/file')).status()).toBe(404);
  expect((await api.get('/v1/my/archiving/24952')).status()).toBe(404); // Del Y
});

test('register: client checks, confirm, stored as typed through the shared support writer, listed as 대기', async ({ page, checks, db }) => {
  // clean previous runs (rows + their stored files)
  for (const r of await db.query<{ FileName1: string | null }>('SELECT FileName1 FROM Archiving WHERE ID = ? AND Title LIKE ?', ['xmyroom02', `${PREFIX}%`])) {
    if (r.FileName1) fs.rmSync(path.join(ARCHIVING_DIR(), r.FileName1), { force: true });
  }
  await db.exec('DELETE FROM Archiving WHERE ID = ? AND Title LIKE ?', ['xmyroom02', `${PREFIX}%`]);
  await hidePopups(page);
  await openAs(page, 'xmyroom02', '/my/company-training');
  await page.getByRole('button', { name: '콘텐츠 등록요청' }).click();
  const form = page.getByRole('dialog', { name: '콘텐츠 등록하기' });
  await expect(form.getByPlaceholder('제목을 입력해 주세요')).toBeVisible();
  await form.getByRole('button', { name: '등록하기' }).click();
  await expect(form.getByRole('alert')).toHaveText('제목을 입력하세요.');
  // characters PHP's Replace_Check would have stripped or escaped (quotes, --, ;, "select", backslash) are kept as typed
  const title = `${PREFIX} 사내 "엑셀" 교육 O'Neil -- select; 50% \\ 자동화 보고서 작성 실무 과정 영상 등록 요청`;
  const content = '1. 직무 교육 영상입니다.\n2. 대상: 데이터혁신팀 <전원>\n3. union 사례 포함; 끝';
  await form.getByLabel('제목').fill(title);
  await form.getByRole('button', { name: '등록하기' }).click();
  await expect(form.getByRole('alert')).toHaveText('내용을 입력하세요.');
  await form.getByLabel('내용').fill(content);
  await form.getByRole('button', { name: '등록하기' }).click();
  await expect(form.getByRole('alert')).toHaveText('파일을 등록해주세요.');
  await form.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await form.getByRole('button', { name: '등록하기' }).click();
  await expect(form.getByRole('alert')).toHaveText('mp4, vod, pdf, doc, docx, xls, xlsx, hwp 파일만 업로드 가능합니다.');
  await form.locator('input[type=file]').setInputFiles({ name: '사내교육_계획서.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(SAMPLE) });
  await checks.checkpoint('archiving-register-form');
  await form.getByRole('button', { name: '등록하기' }).click();
  const confirm = page.getByRole('dialog', { name: '등록하시겠습니까?' });
  await expect(confirm).toBeVisible();
  const post = page.waitForResponse((r) => r.url().endsWith('/v1/my/archiving') && r.request().method() === 'POST');
  await confirm.getByRole('button', { name: '등록하기' }).click();
  const res = await post;
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, message: '등록되었습니다.' });
  await expect(page.getByText('등록되었습니다.')).toBeVisible();
  const row = await db.one<{ idx: number; Title: string; Contents: string; Status: string; Del: string; FileName1: string; RealFileName1: string; RegDate: string }>(
    'SELECT idx, Title, Contents, Status, Del, FileName1, RealFileName1, RegDate FROM Archiving WHERE ID = ? AND Title LIKE ? ORDER BY idx DESC LIMIT 1', ['xmyroom02', `${PREFIX}%`]);
  expect(row).not.toBeNull();
  expect(row!.idx).toBe(body.idx);
  expect(row!.Title).toBe(title);
  // multipart/form-data sends textarea line breaks as CRLF (as the PHP form post did); nothing else is changed (no addslashes)
  expect(row!.Contents.replace(/\r\n/g, '\n')).toBe(content);
  expect(row!.Status).toBe('A');
  expect(row!.Del).toBe('N');
  expect(row!.RealFileName1).toBe('사내교육_계획서.pdf');
  expect(row!.FileName1).toMatch(/^\d{14}01\.pdf$/);
  expect(row!.FileName1.slice(0, 8)).toBe(row!.RegDate.slice(0, 10).replace(/-/g, '')); // date('YmdHis') of the request (KST)
  expect(fs.readFileSync(path.join(ARCHIVING_DIR(), row!.FileName1)).equals(fs.readFileSync(SAMPLE))).toBe(true);
  // newest first, title cut at 47 characters + "..." (strcut_utf8 50), 대기, and no download until 완료
  const list = page.getByRole('region', { name: '등록 콘텐츠 관리' });
  const first = list.locator('tbody tr').first();
  await expect(first.locator('td').nth(1)).toHaveText(`${[...title].slice(0, 47).join('')}...`);
  await expect(first.locator('td').nth(4)).toHaveText('대기');
  await first.getByRole('button').click();
  const dlg = page.getByRole('dialog', { name: '등록 콘텐츠' });
  await expect(dlg.getByText(title, { exact: true })).toBeVisible();
  await expect(dlg).toContainText('승인 완료 후 파일 다운로드가 가능합니다.');
  await checks.checkpoint('archiving-registered');
});

test('내 문의: own rows only, linking to /support/my/:idx with the answer', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'e2elearn01', '/my/tickets');
  const rows = page.locator('main table tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('[E2E] 동영상 끊김 문의 (답변 대기)');
  await expect(rows.nth(0)).toContainText('대기');
  await expect(rows.nth(1)).toContainText('[E2E] 3차시 실습 파일 문의');
  await expect(rows.nth(1)).toContainText('완료');
  await expect(page.getByText('[E2E] 다른 학습자의 문의')).toHaveCount(0);
  await checks.checkpoint('tickets');
  const link = rows.nth(1).getByRole('link', { name: '[E2E] 3차시 실습 파일 문의' });
  await expect(link).toHaveAttribute('href', '/support/my/9901');
  await link.click();
  await expect(page).toHaveURL(/\/support\/my\/9901$/);
  await expect(page.getByText('실습 파일은 학습자료실에 올려두었습니다.')).toBeVisible();
  await checks.checkpoint('ticket-detail');
});
