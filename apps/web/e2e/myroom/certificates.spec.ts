/**
 * 수료증 (/my/certificates, include/certificate_pdf01.php) — myroom.md §2.3: own PassOK='Y' rows only, refund (A) waits until
 * LectureEnd + 7 days, `?ContentsName=` is ignored, hours = FLOOR(Σ StudyTime / 3600), application/pdf inline 수료증_<회사>.pdf.
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { authed, dispositionType, fileNameOf, kstDate, pdfText, popupUrl } from './helpers';

test.use({ area: 'myroom' });

test('e2epass01: list → detail sheet → PDF with the stored hours; ContentsName override ignored; another Seq refused', async ({ page, checks, db }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, 'e2epass01', '/my/certificates');
  const rows = page.locator('main table tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('#9403 · ARC2026');
  await expect(rows.first()).toContainText('출력 가능');
  await checks.checkpoint('certificates-list');
  await rows.first().getByRole('link', { name: '수료증 보기' }).click();
  await expect(page).toHaveURL(/\/my\/certificates\/9403$/);
  const sheet = page.getByRole('article', { name: '수료증 인쇄 내용' });
  const s = await db.one<{ s: string; e: string }>("SELECT DATE_FORMAT(LectureStart, '%Y년 %m월 %d일') s, DATE_FORMAT(LectureEnd, '%Y년 %m월 %d일') e FROM Study WHERE Seq = 9403");
  await expect(sheet).toContainText('이수료');
  await expect(sheet).toContainText('1988-09-18'); // AES BirthDay as stored
  await expect(sheet).toContainText('E2E 이투이물산');
  await expect(sheet).toContainText(`${s!.s} ~ ${s!.e} (15H)`); // FLOOR(54,000 / 3600)
  await expect(sheet).toContainText(kstDate());
  await checks.checkpoint('certificate-detail');
  const url = await popupUrl(page, () => page.getByRole('button', { name: '수료증 PDF 출력' }).click());
  expect(url).toMatch(/^blob:/);

  const api = authed(page, accessToken);
  for (const path of ['/v1/my/certificates/9403/pdf', `/v1/my/certificates/9403/pdf?ContentsName=${encodeURIComponent('조작된 과정명')}`]) {
    const res = await api.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
    expect(dispositionType(res)).toBe('inline');
    expect(fileNameOf(res)).toBe('수료증_E2E 이투이물산.pdf');
    const bytes = await res.body();
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const text = pdfText(bytes);
    expect(text).toContain('이수료');
    expect(text).toContain('HRD 아카이브 2026');
    expect(text).not.toContain('조작된 과정명');
    expect(text).toContain(`${s!.s} ~ ${s!.e} (15H)`);
  }
  // e2ebco02's 9414 (also PassOK Y) is not printable by e2epass01 — same answer as a missing row
  for (const p of ['/v1/my/certificates/9414/pdf', '/v1/my/certificates/9414']) {
    const r = await api.get(p);
    expect(r.status()).toBe(404);
    expect((await r.json()).error.message).toBe('출력내용이 없습니다.');
  }
  checks.allow(/\/v1\/my\/certificates\/9414$/, 404);
  await page.goto('/my/certificates/9414');
  await expect(page.getByText('이수료')).toHaveCount(0);
  await expect(page.getByText('배수료')).toHaveCount(0);
});

test('e2epass02: 수료 but refund certificate waits until LectureEnd + 7 (list pill, detail and PDF refused with the date)', async ({ page, checks, db }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, 'e2epass02', '/my/certificates');
  const avail = String(await db.scalar("SELECT DATE_FORMAT(DATE_ADD(LectureEnd, INTERVAL 7 DAY), '%Y-%m-%d') FROM Study WHERE Seq = 9404"));
  const row = page.locator('main table tbody tr').first();
  await expect(row).toContainText(`${avail}부터 출력`);
  await expect(row.getByRole('button', { name: '수료증 PDF 출력' })).toHaveCount(0);
  await checks.checkpoint('certificates-waiting');
  const res = await authed(page, accessToken).get('/v1/my/certificates/9404/pdf');
  expect(res.status()).toBe(403);
  expect((await res.json()).error.message).toBe(`환급 과정 수료증은 학습 종료 후 7일 뒤 출력할 수 있습니다.\n출력 가능일: ${avail}`);
  checks.allow(/\/v1\/my\/certificates\/9404$/, 403);
  await page.goto('/my/certificates/9404');
  await expect(page.getByText('수료증을 출력할 수 없습니다')).toBeVisible();
  await expect(page.getByText(`출력 가능일: ${avail}`)).toBeVisible();
  await checks.checkpoint('certificate-wait-detail');
});

test('미수료 (e2elearn01) and 비환급 W (e2ewfree01): empty list, PDF refused with the PassOK message', async ({ page, checks }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, 'e2ewfree01', '/my/certificates');
  await expect(page.getByText('발급 가능한 수료증이 없습니다')).toBeVisible();
  await checks.checkpoint('certificates-empty-w');
  const res = await authed(page, accessToken).get('/v1/my/certificates/9407/pdf');
  expect(res.status()).toBe(403);
  expect((await res.json()).error.message).toBe('미수료 상태에서는 수료증을 발급할 수 없습니다.\n수료 기준(학습시간 및 사후역량진단)을 충족한 후 발급 가능합니다.');
});

test('비환급 W with PassOK=Y prints at once (no LectureEnd + 7 wait — ICP:79-88 applies to ServiceType A only)', async ({ page, checks, db }) => {
  await db.exec("UPDATE Study SET PassOK = 'Y' WHERE Seq = 9407");
  try {
    await hidePopups(page);
    const { accessToken } = await openAs(page, 'e2ewfree01', '/my/certificates');
    const row = page.locator('main table tbody tr').first();
    await expect(row).toContainText('#9407');
    await expect(row).toContainText('출력 가능');
    await expect(row.getByRole('button', { name: '수료증 PDF 출력' })).toBeVisible();
    await checks.checkpoint('certificates-w-pass');
    const res = await authed(page, accessToken).get('/v1/my/certificates/9407/pdf');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
    const text = pdfText(await res.body());
    expect(text).toContain('정비환급');
    expect(text).toContain('(3H)'); // FLOOR(11,400 / 3600)
  } finally {
    await db.exec("UPDATE Study SET PassOK = 'N' WHERE Seq = 9407");
  }
});
