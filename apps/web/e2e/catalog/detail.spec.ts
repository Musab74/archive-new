/**
 * 콘텐츠 상세 (/courses/:lectureCode, GET /v1/catalog/courses/:code) — docs/learner-parity/catalog.md §4:
 * meta (제작연도 / 업데이트 / 교강사), tabs, reviews, rating rule (AR-05: only with study history; a staff-hidden review stays hidden),
 * 학습하기 → GET /v1/enrollments/resolve → player or the blocked / pre-assessment messages, 찜 POST / DELETE.
 */
import type { Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { loginViaApi, openAs } from '../support/login';
import { clearPlayLock } from '../support/db';
import { expectCards } from './helpers';

test.use({ area: 'catalog' });

test.beforeEach(async ({ page }) => { await hidePopups(page); });

const meta = (page: Page, label: string) => page.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

test('detail meta, tags and tabs (guest)', async ({ page, db, checks }) => {
  const upload = await db.scalar<string>("SELECT DATE_FORMAT(UploadDate, '%Y.%m.%d') FROM Course WHERE LectureCode = 'E2EX01'");
  // Course.cnt: opening a lesson in the player counts a view (player2.php), so other specs move it — read it, do not assume 120
  const views = await db.scalar<number>("SELECT cnt FROM Course WHERE LectureCode = 'E2EX01'");
  await page.goto('/courses/E2EX01');
  await expect(page.getByRole('heading', { level: 1, name: '[E2E] 데이터 리터러시 실무' })).toBeVisible();
  await expect(meta(page, '콘텐츠 유형')).toHaveText('이러닝');
  await expect(meta(page, '학습시간')).toHaveText('16시간'); // ContentsTime 960 min
  await expect(meta(page, '제작연도')).toHaveText('2026'); // YEAR(ContentsStart)
  await expect(meta(page, '업데이트')).toHaveText(upload!); // UploadDate, not RegDate
  await expect(meta(page, '교강사')).toHaveText('김데이터');
  await expect(meta(page, '조회 수')).toHaveText(Number(views).toLocaleString('ko-KR'));
  await expect(meta(page, '평점')).toHaveText('★ 5.0 (1)'); // 9602 (UseYN N) does not count
  await expect(meta(page, '분류')).toHaveText('직무역량');
  const tags = page.getByLabel('키워드', { exact: true });
  await expect(tags).toContainText('직무분야 · 데이터분석'); // Keyword2 9051
  await expect(tags).toContainText('관심분야 · AI·데이터'); // Keyword3 9004 (ArchiveQuestion col3)
  await expect(tags).toContainText('역량 · 문제해결'); // Keyword4 9007 (col4)
  await expect(page.getByText('[E2E] 데이터 리터러시 실무 과정 소개 (E2E 데이터)')).toBeVisible();
  await checks.checkpoint('detail-intro');
  await tab(page, '구성').click();
  const lessons = page.locator('ol li');
  await expect(lessons).toHaveCount(4);
  await expect(lessons.first()).toContainText('1. 데이터로 말하는 습관');
  await expect(lessons.first()).toContainText('4시간');
  await expect(page.getByRole('heading', { name: '교강사 · 김데이터' })).toBeVisible();
  await checks.checkpoint('detail-outline');
  await tab(page, '평점·후기').click();
  await expect(page.getByText('5.0 · 1명 평가')).toBeVisible();
  await expect(page.getByText('[E2E] 실무에 바로 적용했어요')).toBeVisible();
  await expect(page.getByText(/^e2e\*\*\* · \d{4}\.\d{2}\.\d{2}$/)).toBeVisible(); // masked author
  await expect(page.getByText('[E2E] 숨김 처리된 후기')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: '평점 등록은 로그인 후 이용할 수 있습니다.' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '5점' })).toBeDisabled();
  await checks.checkpoint('detail-reviews-guest');
  // hidden / deleted contents are not found
  for (const code of ['E2EXDEL', 'E2EXOFF']) {
    checks.allow(new RegExp(`/v1/catalog/courses/${code}$`), 404);
    await page.goto(`/courses/${code}`);
    await expect(page.getByRole('heading', { level: 1, name: /\[E2E\]/ })).toHaveCount(0);
    await expect(page.getByText(/찾을 수 없|이용할 수 없|제공되지 않/).first()).toBeVisible();
  }
});

test('teacher profile from the chapter\'s ContentsDetail.Teacher', async ({ page, db, checks }) => {
  await db.exec('UPDATE ContentsDetail SET Teacher = 21001 WHERE Seq IN (91111, 91121)');
  try {
    await page.goto('/courses/E2EZ01');
    await tab(page, '구성').click();
    await expect(page.getByRole('heading', { name: '교강사 · 이보고' })).toBeVisible();
    await expect(page.getByText('[E2E] 보고서 코칭 12년, 기업 강의 300회')).toBeVisible();
    await checks.checkpoint('detail-teacher');
  } finally {
    await db.exec('UPDATE ContentsDetail SET Teacher = NULL WHERE Seq IN (91111, 91121)');
  }
});

test('rating needs study history: refused (403) without a Progress row', async ({ page, checks }) => {
  const login = await openAs(page, 'xcatalog03', '/courses/E2EX01');
  await tab(page, '평점·후기').click();
  await expect(page.getByRole('status').filter({ hasText: '학습 이력이 확인된 콘텐츠에서 평점을 등록할 수 있습니다.' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '4점' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '평점 등록' })).toBeDisabled();
  await checks.checkpoint('detail-rating-no-history');
  // the API refuses as well (AR-05; catalog.service.ts upsertReview)
  const res = await page.request.post('/v1/catalog/courses/E2EX01/reviews', { data: { starPoint: 4 }, headers: { Authorization: `Bearer ${login.accessToken}` } });
  expect(res.status()).toBe(403);
  expect((await res.json()).error?.message ?? (await res.json()).message).toBe('학습 이력이 확인된 콘텐츠에서 평점을 등록할 수 있습니다.');
});

test('rating with study history: new review (max_number idx, UseYN Y), then 평점 수정 updates the same row', async ({ page, db, checks }) => {
  await db.exec("DELETE FROM Review WHERE ID = 'xcatalog01'");
  try {
    const maxIdx = Number(await db.scalar<number>('SELECT MAX(idx) FROM Review'));
    await openAs(page, 'xcatalog01', '/courses/E2EZ01');
    await tab(page, '평점·후기').click();
    await page.getByRole('radio', { name: '4점' }).click();
    await page.getByPlaceholder('학습에 도움이 된 점을 남겨 주세요.').fill('[E2E] 두괄식 정리가 좋았어요');
    const post = page.waitForResponse((r) => r.url().endsWith('/v1/catalog/courses/E2EZ01/reviews') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '평점 등록' }).click();
    expect((await post).status()).toBe(200);
    await expect(page.getByRole('status').filter({ hasText: '평점이 등록되었습니다.' })).toBeVisible();
    const row = await db.one<{ idx: number; StarPoint: number; Contents: string; UseYN: string; Del: string; IP: string }>("SELECT idx, StarPoint, Contents, UseYN, Del, IP FROM Review WHERE ID = 'xcatalog01' AND LectureCode = 'E2EZ01'");
    expect(row).toMatchObject({ idx: maxIdx + 1, StarPoint: 4, Contents: '[E2E] 두괄식 정리가 좋았어요', UseYN: 'Y', Del: 'N' });
    await expect(page.getByText('[E2E] 두괄식 정리가 좋았어요')).toBeVisible();
    await expect(page.getByText(/^xca\*\*\* · /)).toBeVisible();
    await expect(page.getByText('내가 남긴 평점 4점')).toBeVisible();
    await expect(page.getByText('4.0 · 2명 평가')).toBeVisible();
    await checks.checkpoint('detail-rated');
    await page.getByRole('radio', { name: '5점' }).click();
    await page.getByRole('button', { name: '평점 수정' }).click();
    await expect(page.getByText('내가 남긴 평점 5점')).toBeVisible();
    expect(await db.query("SELECT idx, StarPoint FROM Review WHERE ID = 'xcatalog01'")).toEqual([{ idx: maxIdx + 1, StarPoint: 5 }]);
    await expect(page.getByText('4.5 · 2명 평가')).toBeVisible();
  } finally {
    await db.exec("DELETE FROM Review WHERE ID = 'xcatalog01'");
  }
});

test('a staff-hidden review stays hidden after the learner rates again', async ({ page, db }) => {
  await db.exec('UPDATE Review SET StarPoint = 2 WHERE idx = 9602');
  await openAs(page, 'e2ebco02', '/courses/E2EX01');
  await tab(page, '평점·후기').click();
  await expect(page.getByText('내가 남긴 평점 2점')).toBeVisible();
  await page.getByRole('radio', { name: '3점' }).click();
  const post = page.waitForResponse((r) => r.url().endsWith('/v1/catalog/courses/E2EX01/reviews') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '평점 수정' }).click();
  expect(await (await post).json()).toEqual({ idx: 9602, updated: true });
  expect(await db.one('SELECT StarPoint, UseYN, Del FROM Review WHERE idx = 9602')).toEqual({ StarPoint: 3, UseYN: 'N', Del: 'N' });
  await expect(page.getByText('내가 남긴 평점 3점')).toBeVisible();
  await expect(page.getByText('[E2E] 숨김 처리된 후기')).toHaveCount(0);
  await expect(page.getByText('5.0 · 1명 평가')).toBeVisible(); // the hidden ★3 does not count
});

test('학습하기 as a guest asks for login', async ({ page, checks }) => {
  await page.goto('/courses/E2EX01');
  await page.getByRole('button', { name: '학습하기' }).click();
  const dlg = page.getByRole('dialog', { name: '로그인 후 학습을 시작할 수 있습니다.' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('link', { name: '로그인' })).toHaveAttribute('href', `/auth/login?next=${encodeURIComponent('/courses/E2EX01')}`);
  await checks.checkpoint('detail-learn-guest');
});

test('학습하기 resolves the package enrollment and opens the player', async ({ page, db }) => {
  await clearPlayLock('e2elearn01');
  await openAs(page, 'e2elearn01', '/courses/E2EX01');
  const resolve = page.waitForResponse((r) => r.url().includes('/v1/enrollments/resolve?') && r.url().includes('lectureCode=E2EX01'));
  await page.getByRole('button', { name: '학습하기' }).click();
  const body = await (await resolve).json();
  expect(body).toMatchObject({ status: 'ok', studySeq: 9401, studyLectureCode: 'ARC2026' });
  await expect(page).toHaveURL(/\/learn\/9401\/9201\?lectureCode=E2EX01$/); // include/course_player_url.php: first chapter + Study_Seq
  await page.goto('/my'); // pagehide releases the PlayLock
  await expect.poll(() => db.scalar<number>('SELECT COUNT(*) FROM PlayLock WHERE ID = ?', ['e2elearn01'])).toBe(0);
});

test('학습하기 blocked: expired enrollment (PHP message), content outside the package', async ({ page, checks }) => {
  await openAs(page, 'e2eexp01', '/courses/E2EX01');
  await page.getByRole('button', { name: '학습하기' }).click();
  const dlg = page.getByRole('dialog', { name: '지금은 이 콘텐츠를 학습할 수 없습니다.' });
  await expect(dlg).toContainText('수강기간이 종료되었습니다.');
  await expect(dlg).toContainText('문의 1811-9530');
  await expect(dlg.getByRole('link', { name: '회원·이용정보' })).toHaveAttribute('href', '/my/profile');
  await checks.checkpoint('detail-learn-expired');
  await expect(page).toHaveURL(/\/courses\/E2EX01$/);
});

test('학습하기 blocked: content not in the learner\'s package', async ({ page }) => {
  await openAs(page, 'e2elearn01', '/courses/E2EX02');
  await page.getByRole('button', { name: '학습하기' }).click();
  await expect(page.getByRole('dialog', { name: '지금은 이 콘텐츠를 학습할 수 없습니다.' })).toContainText('이 과정에 대한 활성 수강 정보가 없습니다.');
});

test('학습하기 blocked: two active enrollments and no 사전역량진단 → pre-assessment modal', async ({ page, checks }) => {
  await openAs(page, 'xcatalog02', '/courses/E2EZ01');
  const resolve = page.waitForResponse((r) => r.url().includes('/v1/enrollments/resolve?'));
  await page.getByRole('button', { name: '학습하기' }).click();
  expect(await (await resolve).json()).toMatchObject({ status: 'blocked', message: '현재 수강 차수의 사전역량진단을 먼저 완료해주세요.', meta: { preAssessmentRequired: true } });
  const dlg = page.getByRole('dialog', { name: '사전역량진단을 먼저 완료해주세요.' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('link', { name: '사전역량진단' })).toHaveAttribute('href', '/assessment/pre');
  await checks.checkpoint('detail-learn-pre');
});

test('찜: POST adds the CourseLike row, DELETE removes it; reflected in 찜한 콘텐츠 and 찜한 콘텐츠순', async ({ page, db, checks }) => {
  await db.exec("DELETE FROM CourseLike WHERE ID = 'xcatalog01'");
  await openAs(page, 'xcatalog01', '/courses/E2EX01');
  const likeBtn = page.getByRole('button', { name: '찜', exact: true });
  await expect(likeBtn).toHaveAttribute('aria-pressed', 'false');
  const post = page.waitForResponse((r) => r.url().endsWith('/v1/catalog/courses/E2EX01/like') && r.request().method() === 'POST');
  await likeBtn.click();
  expect(await (await post).json()).toMatchObject({ liked: true });
  await expect(page.getByRole('button', { name: '찜 완료' })).toHaveAttribute('aria-pressed', 'true');
  expect(await db.scalar<number>("SELECT COUNT(*) FROM CourseLike WHERE ID = 'xcatalog01' AND LectureCode = 'E2EX01'")).toBe(1);
  // a second POST does not add a duplicate row
  await page.goto('/my/saved');
  await expect(page.getByText('[E2E] 데이터 리터러시 실무').first()).toBeVisible();
  await checks.checkpoint('my-saved-liked');
  await page.goto('/catalog?sort=liked');
  await expectCards(page.locator('main'), ['E2EX01']);
  await page.goto('/courses/E2EX01');
  const del = page.waitForResponse((r) => r.url().endsWith('/v1/catalog/courses/E2EX01/like') && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: '찜 완료' }).click();
  expect(await (await del).json()).toMatchObject({ liked: false });
  await expect(page.getByRole('button', { name: '찜', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(await db.scalar<number>("SELECT COUNT(*) FROM CourseLike WHERE ID = 'xcatalog01'")).toBe(0);
  await page.goto('/my/saved');
  await expect(page.getByText('[E2E] 데이터 리터러시 실무')).toHaveCount(0);
});

test('찜 on a catalog card toggles the same row', async ({ page, db }) => {
  await db.exec("DELETE FROM CourseLike WHERE ID = 'xcatalog01'");
  const login = await loginViaApi(page, 'xcatalog01');
  expect(login.user.id).toBe('xcatalog01');
  await page.goto('/catalog');
  const card = page.locator('main article').filter({ has: page.locator('a[href="/courses/E2EZ01"]') });
  const post = page.waitForResponse((r) => r.url().endsWith('/v1/catalog/courses/E2EZ01/like') && r.request().method() === 'POST');
  await card.getByRole('button', { name: '찜하기' }).click();
  expect((await post).status()).toBe(200);
  await expect(card.getByRole('button', { name: '찜 해제' })).toBeVisible();
  expect(await db.scalar<number>("SELECT COUNT(*) FROM CourseLike WHERE ID = 'xcatalog01' AND LectureCode = 'E2EZ01'")).toBe(1);
  const del = page.waitForResponse((r) => r.url().endsWith('/v1/catalog/courses/E2EZ01/like') && r.request().method() === 'DELETE');
  await card.getByRole('button', { name: '찜 해제' }).click();
  expect((await del).status()).toBe(200);
  expect(await db.scalar<number>("SELECT COUNT(*) FROM CourseLike WHERE ID = 'xcatalog01'")).toBe(0);
});
