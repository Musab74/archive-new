/**
 * One lesson at a time (include/play_lock_db.php, play_check.php, heartbeat.php): a second window of the same login is refused with the
 * PHP message, 「여기서 학습 계속하기」 replaces the lock (the first window stops at its next heartbeat and earns nothing more), closing a
 * tab frees the lock at once (pagehide release), and a chapter switch hands the lock to the next chapter (player2.php:4757-4772).
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { db } from '../support/db';
import { COURSES } from '../support/accounts';
import { XP, resetLearner, nextTick, progressOf, leavePlayer } from './kit';

test.use({ area: 'player' });

const [CH1, CH2] = COURSES.E2EX01.chapters;
const lockRow = (id: string) => db.one<{ LectureCode: string; Chapter_Number: string; PlayToken: string }>('SELECT LectureCode, Chapter_Number, PlayToken FROM PlayLock WHERE ID = ?', [id]);

test('second tab is refused, takeover moves the lock, the first window stops and earns nothing, closing the tab frees the lock', async ({ page, checks }) => {
  const me = XP.lock;
  await resetLearner(me.id, me.seq);
  await page.clock.install();
  await hidePopups(page);
  await openAs(page, me.id, `/learn/${me.seq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  await nextTick(page, 'Start', () => page.getByRole('button', { name: '학습 시작하기' }).click());
  const first = await lockRow(me.id);
  expect(first).toMatchObject({ LectureCode: 'E2EX01', Chapter_Number: '1' });

  // ---- second tab of the same login (own sessionStorage → no token) → PLAYLOCK with the PHP text
  const tab2 = await page.context().newPage();
  const blockedOpen = tab2.waitForResponse((r) => r.url().endsWith('/v1/player/session') && r.request().method() === 'POST');
  await tab2.goto(`/learn/${me.seq}/${CH2.chapterSeq}?lectureCode=E2EX01`);
  const res = await blockedOpen;
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toMatchObject({ code: 'PLAYLOCK', message: '이미 학습 중인 강의가 있습니다. 기존 학습 창을 종료 후 다시 시도해주세요.', details: { lockedLecture: 'E2EX01' } });
  const block = tab2.locator('[data-state="CONCURRENT"]');
  await expect(block).toContainText('이미 학습 중인 강의가 있습니다. 기존 학습 창을 종료 후 다시 시도해주세요.');
  await expect(block).toContainText('마지막 확인');
  await tab2.screenshot({ path: test.info().outputPath('tab2-blocked.png') });
  expect((await lockRow(me.id))!.PlayToken).toBe(first!.PlayToken); // the refused tab did not touch the lock

  // ---- 「여기서 학습 계속하기」: tab 2 takes the lock for chapter 2
  const takeover = tab2.waitForResponse((r) => r.url().endsWith('/v1/player/session') && r.request().method() === 'POST');
  await block.getByRole('button', { name: '여기서 학습 계속하기' }).click();
  expect((await takeover).status()).toBe(200);
  await expect(tab2.getByRole('button', { name: '학습 시작하기' })).toBeVisible();
  const second = await lockRow(me.id);
  expect(second).toMatchObject({ LectureCode: 'E2EX01', Chapter_Number: '2' });
  expect(second!.PlayToken).not.toBe(first!.PlayToken);
  await nextTick(tab2, 'Start', () => tab2.getByRole('button', { name: '학습 시작하기' }).click());

  // ---- the first window: its Middle earns nothing (another token/chapter holds the lock, another lesson logged since) and its
  //      heartbeat answers other_session → the concurrent-study state
  const before = (await progressOf(me.id, me.seq, CH1.chapterSeq))!.StudyTime;
  await db.exec('UPDATE ProgressLog SET RegDate = DATE_SUB(RegDate, INTERVAL 3600 SECOND) WHERE ID = ? AND Chapter_Seq = ? ORDER BY idx DESC LIMIT 1', [me.id, CH1.chapterSeq]);
  const hb = page.waitForResponse((r) => r.url().endsWith('/v1/player/heartbeat'));
  const logsCh1 = () => db.scalar<number>('SELECT COUNT(*) FROM ProgressLog WHERE ID = ? AND Chapter_Seq = ?', [me.id, CH1.chapterSeq]);
  const ch1Logs = await logsCh1();
  const mid = await nextTick(page, 'Middle', () => page.clock.fastForward(60_000));
  // hrde_one_lesson_decide: another lesson logged last and this is not a Start → block: ChkError S (sent as N), Overlap Y, nothing written
  expect(mid.ack).toMatchObject({ Overlap: 'Y', ChkError: 'N', StudyTime: before });
  expect(await logsCh1()).toBe(ch1Logs);
  expect((await progressOf(me.id, me.seq, CH1.chapterSeq))!.StudyTime).toBe(before);
  expect(await (await hb).json()).toMatchObject({ ok: false, error: 'other_session' });
  await expect(page.locator('[data-state="CONCURRENT"]')).toBeVisible();
  await checks.checkpoint('playlock-taken-over', { settle: false });
  expect(await page.evaluate(() => document.querySelector('video')?.paused ?? true)).toBe(true);

  // ---- leaving tab 2 (pagehide → End beacon + keepalive release) frees the lock at once, not after 90 s.
  // Harness note: with the context-wide route of support/test.ts active, Playwright drops keepalive requests of a page that is being
  // closed (page.close: 2 of 8 releases arrived; 8 of 8 without the route), so the tab is navigated away — the same pagehide path a
  // real tab close takes — and then closed.
  await tab2.goto('about:blank');
  await expect.poll(() => lockRow(me.id), { timeout: 10_000 }).toBeNull();
  await tab2.close();
  // and the first window may now continue with 「접속 상태 다시 확인」
  await page.locator('[data-state="CONCURRENT"]').getByRole('button', { name: '접속 상태 다시 확인' }).click();
  await expect(page.getByRole('button', { name: '학습 시작하기' })).toBeVisible();
  await expect.poll(async () => (await lockRow(me.id))?.Chapter_Number).toBe('1');
  await leavePlayer(page, me.id);
});

test('chapter switch hands the PlayLock to the next chapter (End of the old chapter first, no PLAYLOCK refusal)', async ({ page, checks }) => {
  const me = XP.lock;
  await resetLearner(me.id, me.seq);
  await hidePopups(page);
  await openAs(page, me.id, `/learn/${me.seq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  await nextTick(page, 'Start', () => page.getByRole('button', { name: '학습 시작하기' }).click());
  const sessions: number[] = [];
  page.on('response', (r) => { if (r.url().endsWith('/v1/player/session') && r.request().method() === 'POST') sessions.push(r.status()); });
  const toc = page.getByRole('region', { name: '학습 목차' }).or(page.getByLabel('학습 목차'));
  const end = await nextTick(page, 'End', () => toc.getByRole('listitem').nth(1).getByRole('button', { name: '차시 이동' }).click());
  expect(end.body.chapterSeq).toBe(CH1.chapterSeq);
  await expect(page).toHaveURL(new RegExp(`/learn/${me.seq}/${CH2.chapterSeq}\\?lectureCode=E2EX01$`));
  await expect(page.getByRole('heading', { name: '2. 숫자를 그림으로: 시각화 기본' })).toBeVisible();
  await expect(page.getByRole('button', { name: '학습 시작하기' })).toBeVisible();
  expect(sessions).toEqual([200]);
  expect(await lockRow(me.id)).toMatchObject({ LectureCode: 'E2EX01', Chapter_Number: '2' });
  expect(await db.scalar<number>('SELECT COUNT(*) FROM PlayLock WHERE ID = ?', [me.id])).toBe(1);
  await checks.checkpoint('chapter-switch', { settle: false });
  await leavePlayer(page, me.id);
});
