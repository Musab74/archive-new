/**
 * 찜한 콘텐츠 (/my/saved) — CourseLike list, single 찜 해제 and the archive_save_del.php bulk removal (myroom.md §2.7–2.8):
 * own rows only, one transaction (all or nothing), 열람 제한 card for a course that is no longer shown (UseYN N).
 * Each test re-creates xmyroom02's likes (ids 24101–24104), so the specs re-run on a used DB.
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { authed } from './helpers';

test.use({ area: 'myroom' });

const ME = 'xmyroom02';
const likes = async (db: { query: <T extends object>(s: string, p?: unknown[]) => Promise<T[]> }) =>
  (await db.query<{ idx: number }>('SELECT idx FROM CourseLike WHERE ID = ? ORDER BY idx', [ME])).map((r) => r.idx);

test.beforeEach(async ({ db }) => {
  await db.exec('DELETE FROM CourseLike WHERE ID = ? OR idx BETWEEN 24101 AND 24199', [ME]);
  await db.exec(`INSERT INTO CourseLike (idx, LectureCode, ID, RegDate) VALUES
    (24101, 'E2EX01', ?, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '10:00:00')),
    (24102, 'E2EZ01', ?, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '10:00:00')),
    (24103, 'E2EY01', ?, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '10:00:00')),
    (24104, 'E2EXOFF', ?, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '10:00:00'))`, [ME, ME, ME, ME]);
});

test('list newest first, 열람 제한 card, single 찜 해제 with confirm', async ({ page, checks, db }) => {
  await hidePopups(page);
  await openAs(page, ME, '/my/saved');
  const cards = page.locator('main ul > li');
  await expect(cards).toHaveCount(4);
  // newest first: E2EXOFF (−2 d, hidden course → protected card), E2EY01, E2EZ01, E2EX01
  await expect(cards.nth(0)).toContainText('열람 제한');
  await expect(cards.nth(0)).toContainText('제목·썸네일·상세정보는 현재 열람권한에 따라 보호됩니다.');
  await expect(cards.nth(0)).not.toContainText('[E2E] 비노출 과정');
  await expect(cards.nth(1)).toContainText('[E2E] 1분 엑셀 단축키');
  await expect(cards.nth(3)).toContainText('[E2E] 데이터 리터러시 실무');
  await expect(cards.nth(3)).toContainText('평점 ★ 5'); // review 9601 (visible); the hidden 9602 does not count
  await expect(cards.nth(3)).toContainText('조회 120');
  await checks.checkpoint('saved-list');
  // single remove (DELETE /my/saved/:code) after the confirm dialog
  await cards.nth(1).getByRole('button', { name: /찜 해제/ }).click();
  const dlg = page.getByRole('dialog', { name: '찜한 콘텐츠를 해제할까요?' });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('찜 목록에서만 삭제됩니다. 기존 학습기록·학습시간·평점은 그대로 유지됩니다.');
  await checks.checkpoint('saved-confirm');
  const del = page.waitForResponse((r) => r.url().endsWith('/v1/my/saved/E2EY01') && r.request().method() === 'DELETE');
  await dlg.getByRole('button', { name: '찜 해제' }).click();
  expect((await del).status()).toBeLessThan(300);
  await expect(page.getByText('찜이 해제되었습니다. 기존 학습기록은 유지됩니다.')).toBeVisible();
  await expect(cards).toHaveCount(3);
  expect(await likes(db)).toEqual([24101, 24102, 24104]);
});

test('bulk 선택 해제: checked own rows removed in one request', async ({ page, checks, db }) => {
  await hidePopups(page);
  await openAs(page, ME, '/my/saved');
  await page.getByRole('checkbox', { name: '선택 [E2E] 데이터 리터러시 실무' }).check();
  await page.getByRole('checkbox', { name: '선택 [E2E] 5분 보고서 작성법' }).check();
  await page.getByRole('button', { name: '선택 해제 (2)' }).click();
  const dlg = page.getByRole('dialog', { name: '선택한 찜을 해제할까요?' });
  await expect(dlg).toContainText('2개 콘텐츠를 찜 목록에서 삭제합니다. 기존 학습기록·평점은 유지됩니다.');
  const req = page.waitForRequest((r) => r.url().endsWith('/v1/my/saved/remove'));
  await dlg.getByRole('button', { name: '찜 해제' }).click();
  expect([...(await req).postDataJSON().likeIdx].sort()).toEqual([24101, 24102]);
  await expect(page.getByText('2개 찜이 해제되었습니다.')).toBeVisible();
  await expect(page.locator('main ul > li')).toHaveCount(2);
  expect(await likes(db)).toEqual([24103, 24104]);
  await checks.checkpoint('saved-bulk-done');
});

test('bulk removal is all-or-nothing and own rows only (another learner idx → nothing deleted)', async ({ page, checks, db }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, ME, '/my/saved');
  await expect(page.locator('main ul > li')).toHaveCount(4);
  const foreign = Number(await db.scalar("SELECT idx FROM CourseLike WHERE ID = 'e2elearn01' AND LectureCode = 'E2EX01'"));
  const api = authed(page, accessToken);
  const res = await api.post('/v1/my/saved/remove', { likeIdx: [24101, foreign] });
  expect(res.status()).toBe(404);
  expect((await res.json()).error.message).toBe('선택한 관심과정을 찾을 수 없습니다.');
  expect(await likes(db)).toEqual([24101, 24102, 24103, 24104]); // own row kept too (rolled back)
  expect(Number(await db.scalar('SELECT COUNT(*) FROM CourseLike WHERE idx = ?', [foreign]))).toBe(1);
  const empty = await api.post('/v1/my/saved/remove', { likeIdx: [] });
  expect(empty.status()).toBe(400);
  await checks.checkpoint('saved-untouched');
});

test('empty list state', async ({ page, checks, db }) => {
  await db.exec('DELETE FROM CourseLike WHERE ID = ?', [ME]);
  await hidePopups(page);
  await openAs(page, ME, '/my/saved');
  await expect(page.getByText('아직 찜한 콘텐츠가 없습니다.')).toBeVisible();
  await checks.checkpoint('saved-empty');
});
