/**
 * 학습지원센터 수강후기 board (public/support/survey.html, survey_view.html → /support/reviews, GET /v1/reviews) —
 * docs/learner-parity/assessment.md §2.7: login required; Del N AND UseYN Y; RegDate DESC; 25/page; search in Title or course name;
 * ?lectureCode filter with ROUND(AVG(StarPoint), 1); authors masked; detail counts a view; hidden rows are not shown.
 * Visible fixture rows: 26002 (E2EH01 ★4, −3 d), 26001 (E2EH01 ★5, −4 d), 9603 (E2EZ01 ★4, −6 d), 9601 (E2EX01 ★5, −35 d);
 * never 9602 / 26003 (UseYN N) or 9604 (Del Y).
 */
import type { Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';

test.use({ area: 'support' });

test.beforeEach(async ({ page }) => { await hidePopups(page); });

const titles = (page: Page) => page.locator('tbody tr td:nth-child(3)').allInnerTexts();

test('board requires login', async ({ page, checks }) => {
  checks.allow(/\/v1\/reviews(\?|$)/, 401);
  await page.goto('/support/reviews');
  await expect(page.getByRole('heading', { name: '로그인이 필요합니다.' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('list: visible rows newest first, masked authors, hidden and deleted rows skipped; search', async ({ page, db, checks }) => {
  // the board rule itself, read from the DB (other areas' specs may add reviews to a shared run): Del N, UseYN Y, RegDate DESC, 25/page
  const visible = await db.query<{ Title: string }>("SELECT Title FROM Review WHERE Del = 'N' AND UseYN = 'Y' ORDER BY RegDate DESC, idx DESC LIMIT 25");
  const total = Number(await db.scalar("SELECT COUNT(*) FROM Review WHERE Del = 'N' AND UseYN = 'Y'"));
  await openAs(page, 'xsupport02', '/support/reviews');
  await expect(page.getByRole('heading', { level: 1, name: '수강후기' })).toBeVisible();
  await expect(page.getByText(`총 ${total}건`)).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(visible.map((r) => r.Title));
  const shown = await titles(page);
  const fixture = ['[E2E] 짧아서 좋아요', '[E2E] 패키지 차시가 편해요', '[E2E] 짧고 알찬 보고서 강의', '[E2E] 실무에 바로 적용했어요'];
  expect(shown.filter((t) => fixture.includes(t))).toEqual(fixture); // 26002, 26001, 9603, 9601
  for (const hidden of ['[E2E] 숨김 처리된 후기', '[E2E] 숨김 처리된 패키지 후기', '[E2E] 삭제된 후기']) await expect(page.getByText(hidden)).toHaveCount(0);
  const row26002 = page.locator('tbody tr').filter({ has: page.locator('a[href="/support/reviews/26002"]') }).first();
  await expect(row26002.getByRole('link', { name: '[E2E] 패키지형 HTML 차시 체험' })).toBeVisible();
  await expect(row26002.getByRole('img', { name: '평점 4' })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1440) >= 768) {
    await expect(row26002).toContainText('xsu***'); // masked like the course page (survey.html showed Name / ID)
    await expect(page.locator('tbody tr').filter({ has: page.locator('a[href="/support/reviews/9601"]') }).first()).toContainText('e2e***');
  }
  await checks.checkpoint('reviews-board');
  // search: Title OR course name
  await page.getByRole('textbox', { name: '검색어를 입력해주세요' }).fill('알찬');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page).toHaveURL(/sw=/);
  await expect.poll(() => titles(page)).toEqual(['[E2E] 짧고 알찬 보고서 강의']);
  await page.getByRole('textbox', { name: '검색어를 입력해주세요' }).fill('데이터 리터러시'); // course name only
  await page.getByRole('button', { name: '검색', exact: true }).click();
  const byCourse = await db.query<{ Title: string }>("SELECT a.Title FROM Review a JOIN Course b ON b.LectureCode = a.LectureCode WHERE a.Del = 'N' AND a.UseYN = 'Y' AND (a.Title LIKE '%데이터 리터러시%' OR b.ContentsName LIKE '%데이터 리터러시%') ORDER BY a.RegDate DESC, a.idx DESC");
  await expect.poll(() => titles(page)).toEqual(byCourse.map((r) => r.Title));
  expect(byCourse.map((r) => r.Title)).toContain('[E2E] 실무에 바로 적용했어요');
});

test('course filter with its average (hidden ★1 not counted), 필터 해제', async ({ page, db, checks }) => {
  await openAs(page, 'xsupport02', '/support/reviews?lectureCode=E2EH01');
  await expect.poll(() => titles(page)).toEqual(['[E2E] 짧아서 좋아요', '[E2E] 패키지 차시가 편해요']);
  await expect(page.getByText('총 2건')).toBeVisible();
  const filter = page.getByText('[E2E] 패키지형 HTML 차시 체험', { exact: true }).first().locator('xpath=..');
  await expect(filter).toContainText('4.5'); // ROUND(AVG(5, 4), 1) — 26003 (★1, UseYN N) is skipped
  await expect(filter).toContainText('평균 평점');
  await checks.checkpoint('reviews-board-course');
  await page.getByRole('button', { name: '필터 해제' }).click();
  await expect(page).not.toHaveURL(/lectureCode=/);
  await expect(page.getByText(`총 ${Number(await db.scalar("SELECT COUNT(*) FROM Review WHERE Del = 'N' AND UseYN = 'Y'"))}건`)).toBeVisible();
});

test('detail counts a view and links the course filter; a hidden review is not shown', async ({ page, db, checks }) => {
  const before = Number(await db.scalar('SELECT ViewCount FROM Review WHERE idx = 26001'));
  await openAs(page, 'xsupport02', '/support/reviews/26001');
  await expect(page.getByRole('heading', { name: '[E2E] 패키지 차시가 편해요' })).toBeVisible();
  await expect(page.getByText('차시 이동이 자연스럽습니다.')).toBeVisible();
  await expect(page.getByText(String(before + 1), { exact: true })).toBeVisible();
  expect(Number(await db.scalar('SELECT ViewCount FROM Review WHERE idx = 26001'))).toBe(before + 1);
  await expect(page.getByRole('link', { name: '[E2E] 패키지형 HTML 차시 체험' })).toHaveAttribute('href', '/support/reviews?lectureCode=E2EH01');
  await checks.checkpoint('reviews-detail');
  checks.allow(/\/v1\/reviews\/26003$/, 404);
  await page.goto('/support/reviews/26003');
  await expect(page.getByText('해당 수강후기 내용이 없습니다.')).toBeVisible();
  expect(Number(await db.scalar('SELECT ViewCount FROM Review WHERE idx = 26003'))).toBe(0);
});
