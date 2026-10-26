/**
 * 학습창 video ticks against the PHP formulas (player/lecture_progress.php): Start / Middle / End saves, credit = max(0, min(posΔ,
 * wallΔ + 5)) with the resume guard, the 4-hour per-content cap, chapter %, Study.Progress, TriggerYN, Chapter_Number = OrderByNum,
 * the EMON score rows the Progress triggers write (TB_SCORE_HIST_V2), the resume position and the PassOK dual gate.
 *
 * The browser clock is installed (page.clock) so the 60 s Middle interval is fired with fastForward instead of waited for; the wall
 * time the API measures comes from MySQL NOW(), so the spec moves the previous ProgressLog row instead (ageLastProgressLog-style).
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { db } from '../support/db';
import { COURSES } from '../support/accounts';
import { XP, resetLearner, nextTick, lastLog, logs, progressOf, studyOf, scoreHist, phpCredit, phpStudyTime, phpChapterPct, phpStudyProgress, seekVideo, leavePlayer } from './kit';

test.use({ area: 'player' });

const X01 = COURSES.E2EX01;
const CH1 = X01.chapters[0];
const CAP = Math.min(X01.minutesPerChapter * 60, 14_400); // min(LectureTime × 60, 14,400) = 14,400
const COMPLETE = X01.minutesPerChapter * 60; // CompleteTime the page posts (player2.php:244)

test('video ticks: Start pins 0, resume guard, backward seek, wall+5 tolerance, posΔ credit, 4 h cap, TriggerYN, End, resume position', async ({ page, checks, clientIp }) => {
  const me = XP.ticks;
  await resetLearner(me.id, me.seq);
  await page.clock.install();
  await hidePopups(page);
  await openAs(page, me.id, `/learn/${me.seq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  await expect(page.getByRole('heading', { name: '1. 데이터로 말하는 습관' })).toBeVisible();
  await checks.checkpoint('video-ready');

  // ---- Start: first save of the chapter → INSERT Progress 0 / 0, position pinned to 0, TriggerYN Y (EndTrigger N)
  const start = await nextTick(page, 'Start', () => page.getByRole('button', { name: '학습 시작하기' }).click());
  expect(start.body).toMatchObject({ chapterNumber: '1', chapterSeq: CH1.chapterSeq, contentsIdx: CH1.contentsIdx, contentsDetailSeq: CH1.detailSeq, completeTime: COMPLETE, studySeq: me.seq, lectureCode: 'E2EX01' });
  expect(start.ack).toMatchObject({ ChkError: 'N', StudyTime: 0, ChapterProgress: 0, Total_Progress: 0, PassOk: 'N', PositionSec: 0 });
  let p = await progressOf(me.id, me.seq, CH1.chapterSeq);
  expect(p).toMatchObject({ StudyTime: 0, Progress: 0, TriggerYN: 'Y', Chapter_Number: '1', LastStudy: '/contents/E2E/X01/01.mp4', ContentsDetail_Seq: CH1.detailSeq, UserIP: clientIp });
  let log = await lastLog(me.id);
  expect(log).toMatchObject({ PositionSec: 0, StudyTime: 0, Progress: 0, TriggerYN: 'Y', Chapter_Number: '1', TotalProgress: 0 });
  expect(await studyOf(me.seq)).toEqual({ Progress: 0, PassOK: 'N' });
  // EMON: the Progress INSERT trigger wrote the 진도_<Chapter_Number> score row with SCORE = StudyTime
  expect(await scoreHist(me.id)).toEqual([expect.objectContaining({ EVAL_TYPE: '진도_1', SCORE: 0, CONTENTS_AGENT_PK: 'E2EX01', COURSE_AGENT_PK: 'ARC2026', CLASS_AGENT_PK: 'ARC2026,9301', CHANGE_STATE: 'C', CHASI: '1' })]);

  let studyTime = 0;
  /** One Middle at `pos`: returns the credit and checks every stored number against the PHP formula. */
  const middle = async (pos: number, label: string) => {
    const prev = await lastLog(me.id);
    await seekVideo(page, pos);
    const t = await nextTick(page, 'Middle', () => page.clock.fastForward(60_000));
    const now = await lastLog(me.id);
    const sentPos = t.body.positionSec;
    const credit = phpCredit(prev.PositionSec, prev.reg_ts, now.reg_ts, sentPos);
    studyTime = phpStudyTime(studyTime, credit, CAP);
    const pct = phpChapterPct(studyTime, COMPLETE);
    expect(t.ack, label).toMatchObject({ ChkError: 'N', StudyTime: studyTime, ChapterProgress: pct, PositionSec: sentPos });
    expect(now, label).toMatchObject({ PositionSec: sentPos, StudyTime: studyTime, Progress: pct, LastStudy: String(sentPos), Chapter_Number: '1' });
    return { credit, sentPos, now };
  };

  // ---- resume guard: posΔ > 60 within 15 s of wall time → 0 (lecture_progress.php:228)
  let r = await middle(65, 'resume guard');
  expect(r.sentPos).toBeGreaterThan(60);
  expect(r.credit).toBe(0);
  // ---- backward seek: posΔ ≤ 0 → 0
  r = await middle(5, 'backward');
  expect(r.credit).toBe(0);
  // ---- wall tolerance: previous save "in the future" → wallΔ = max(0, …) = 0 → credit = min(posΔ, 0 + 5) = 5
  await db.exec('UPDATE ProgressLog SET RegDate = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE ID = ? ORDER BY idx DESC LIMIT 1', [me.id]);
  let prevPos = (await lastLog(me.id)).PositionSec;
  r = await middle(20, 'wall+5');
  expect(r.sentPos - prevPos).toBeGreaterThan(5);
  expect(r.credit).toBe(5);
  // ---- posΔ-bound: an hour of wall time, 30 s of playhead → credit = 30
  await db.exec('UPDATE ProgressLog SET RegDate = DATE_SUB(RegDate, INTERVAL 3600 SECOND) WHERE ID = ? ORDER BY idx DESC LIMIT 1', [me.id]);
  prevPos = r.sentPos;
  r = await middle(35, 'posΔ');
  expect(r.credit).toBe(r.sentPos - prevPos);
  expect(studyTime).toBe(5 + r.credit);
  let st = await studyOf(me.seq);
  expect(st).toEqual({ Progress: phpStudyProgress(studyTime), PassOK: 'N' }); // 35 s → 0 % → 1 (any time > 0)
  expect(st.Progress).toBe(1);
  p = await progressOf(me.id, me.seq, CH1.chapterSeq);
  expect(p).toMatchObject({ StudyTime: studyTime, TriggerYN: 'N' });
  expect((await scoreHist(me.id)).map((s) => [s.EVAL_TYPE, s.SCORE])).toEqual([['진도_1', studyTime]]); // UPDATE trigger keeps SCORE = StudyTime

  // ---- 4-hour cap: the chapter already holds 14,390 s; +15 s of credit stops at min(LectureTime × 60, 14,400) = 14,400 → 100 %
  await db.exec('UPDATE Progress SET StudyTime = 14390 WHERE ID = ? AND Study_Seq = ? AND Chapter_Seq = ?', [me.id, me.seq, CH1.chapterSeq]);
  studyTime = 14_390;
  await db.exec('UPDATE ProgressLog SET RegDate = DATE_SUB(RegDate, INTERVAL 3600 SECOND) WHERE ID = ? ORDER BY idx DESC LIMIT 1', [me.id]);
  const regBefore = (await progressOf(me.id, me.seq, CH1.chapterSeq))!.RegDate;
  prevPos = r.sentPos;
  r = await middle(50, '4h cap');
  expect(r.credit).toBe(r.sentPos - prevPos);
  expect(studyTime).toBe(CAP);
  p = await progressOf(me.id, me.seq, CH1.chapterSeq);
  // Middle reaching 100 % with EndTrigger N → TriggerYN Y; RegDate untouched once the chapter is ≥ 100 (lecture_progress.php:350-356)
  expect(p).toMatchObject({ StudyTime: CAP, Progress: 100, TriggerYN: 'Y' });
  expect(p!.RegDate).toBe(regBefore);
  st = await studyOf(me.seq);
  expect(st).toEqual({ Progress: phpStudyProgress(CAP), PassOK: 'N' }); // floor(14,400 / 54,000 × 100) = 26
  expect(st.Progress).toBe(26);
  expect((await lastLog(me.id)).TotalProgress).toBe(26);
  expect((await scoreHist(me.id)).map((s) => [s.EVAL_TYPE, s.SCORE])).toEqual([['진도_1', CAP]]);
  // the panel shows the enrollment total the server acknowledged (open-time Σ + this chapter's gain), not the open-time value
  await expect(page.getByText('환급 인정 수강시간').locator('..')).toContainText('4시간');
  await page.getByRole('button', { name: '일시정지' }).click();
  await checks.checkpoint('video-capped', { settle: false });

  // ---- End via 학습 종료: ≥ 50 % watched and no own review → the rating step (player2.php:5208-5228); EndTrigger is Y → TriggerYN N.
  // The End is credited like any save (an hour of wall, +3 s of playhead) but the chapter stays at the 14,400 s cap.
  await db.exec('UPDATE ProgressLog SET RegDate = DATE_SUB(RegDate, INTERVAL 3600 SECOND) WHERE ID = ? ORDER BY idx DESC LIMIT 1', [me.id]);
  await seekVideo(page, 60);
  const before = (await logs(me.id)).length;
  await page.getByRole('button', { name: '학습 종료' }).first().click();
  const dialog = page.getByRole('dialog', { name: '평점을 남기고 학습을 마쳐주세요' });
  await expect(dialog).toBeVisible();
  await checks.checkpoint('exit-rating', { settle: false });
  const end = await nextTick(page, 'End', () => dialog.getByRole('button', { name: '나중에 하기' }).click());
  expect(end.body.positionSec).toBe(60);
  expect(end.ack).toMatchObject({ ChkError: 'N', StudyTime: CAP, ChapterProgress: 100, PositionSec: 60 });
  expect((await logs(me.id)).length).toBe(before + 1);
  expect((await lastLog(me.id))).toMatchObject({ TriggerYN: 'N', StudyTime: CAP, PositionSec: 60 });
  await expect(page).toHaveURL(/\/courses\/E2EX01$/);
  await expect.poll(() => db.scalar<number>('SELECT COUNT(*) FROM PlayLock WHERE ID = ?', [me.id])).toBe(0);

  // ---- resume: reopening plays from the newest saved PositionSec (the row the next save measures from)
  const resumeAt = (await lastLog(me.id)).PositionSec;
  await page.goto(`/learn/${me.seq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  const mm = `${String(Math.floor(resumeAt / 60)).padStart(2, '0')}:${String(resumeAt % 60).padStart(2, '0')}`;
  await expect(page.getByText(`이전 저장위치 ${mm}부터 이어서 재생합니다.`)).toBeVisible();
  await expect(page.getByText('학습을 마친 차시입니다.', { exact: false })).toBeVisible(); // 복습 note (Progress 100)
  const restart = await nextTick(page, 'Start', () => page.getByRole('button', { name: '학습 시작하기' }).click());
  expect(Math.abs(restart.body.positionSec - resumeAt)).toBeLessThanOrEqual(1);
  // Start of a finished chapter: EndTrigger Y → TriggerYN N, no credit (posΔ ≈ 0)
  expect(await lastLog(me.id)).toMatchObject({ TriggerYN: 'N', StudyTime: CAP });
  await checks.checkpoint('video-resume', { settle: false });
  // the media 'ended' event sends the End save by itself (player2.php:3940-3946)
  const ended = await nextTick(page, 'End', () => seekVideo(page, 89));
  expect(ended.ack).toMatchObject({ ChkError: 'N', StudyTime: CAP });
  await expect(page.getByText('차시 재생이 끝났습니다.')).toBeVisible();
  await leavePlayer(page, me.id);
});

test('Chapter_Number = Chapter.OrderByNum (gap in the order) → Progress.Chapter_Number and the EMON 진도_N row', async ({ page, checks }) => {
  const me = XP.ticks;
  await resetLearner(me.id, me.seq);
  const ch2 = COURSES.E2EZ01.chapters[1]; // Chapter 9212, OrderByNum 2 → moved to 5 for this test
  await db.exec('UPDATE Chapter SET OrderByNum = 5 WHERE Seq = ?', [ch2.chapterSeq]);
  try {
    await hidePopups(page);
    await openAs(page, me.id, `/learn/${me.seq}/${ch2.chapterSeq}?lectureCode=E2EZ01`);
    await expect(page.getByRole('heading', { name: '2. 한 장 보고서 다듬기' })).toBeVisible();
    await expect(page.getByText('진행 차시 2/2')).toBeVisible(); // the UI still numbers by position
    const start = await nextTick(page, 'Start', () => page.getByRole('button', { name: '학습 시작하기' }).click());
    expect(start.body.chapterNumber).toBe('5'); // player2.php:237 $Chapter_Number = OrderByNum
    expect(start.ack.Chapter_Number).toBe(4); // lecture_progress.php:497 Chapter_Number − 1
    expect(await progressOf(me.id, me.seq, ch2.chapterSeq)).toMatchObject({ Chapter_Number: '5' });
    expect(await scoreHist(me.id)).toEqual([expect.objectContaining({ EVAL_TYPE: '진도_5', CHASI: '5', CONTENTS_AGENT_PK: 'E2EZ01' })]);
    expect(await db.scalar('SELECT Chapter_Number FROM PlayLock WHERE ID = ?', [me.id])).toBe('5');
    await checks.checkpoint('order-gap', { settle: false });
    await leavePlayer(page, me.id);
  } finally {
    await resetLearner(me.id, me.seq); // while OrderByNum is still 5 (the delete trigger maps Chapter_Number through it)
    await db.exec('UPDATE Chapter SET OrderByNum = 2 WHERE Seq = ?', [ch2.chapterSeq]);
  }
});

/** 53,990 s on Study 22106/22107: chapters 1–3 full (14,400) + chapter 4 at 10,790 with a 30 s playhead an hour ago. */
async function build53990(id: string, seq: number): Promise<void> {
  const rows = [[9201, 9101, 91011, 14_400, 100, '1'], [9202, 9102, 91021, 14_400, 100, '2'], [9203, 9103, 91031, 14_400, 100, '3'], [9204, 9104, 91041, 10_790, 74, '4']] as const;
  for (const [ch, ci, cd, t, pct, n] of rows) {
    await db.exec(`INSERT INTO Progress (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number)
      VALUES (?, 'E2EX01', ?, ?, ?, ?, '30', ?, ?, '127.0.0.1', DATE_SUB(NOW(), INTERVAL 2 DAY), 'N', ?)`, [id, seq, ch, ci, cd, pct, t, n]);
    await db.exec(`INSERT INTO ProgressLog (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, TotalProgress, PositionSec)
      VALUES (?, 'E2EX01', ?, ?, ?, ?, '30', ?, ?, '127.0.0.1', DATE_SUB(NOW(), INTERVAL 2 DAY), 'N', ?, 99, 30)`, [id, seq, ch, ci, cd, pct, t, n]);
  }
  await db.exec("UPDATE Study SET Progress = 99, PassOK = 'N' WHERE Seq = ?", [seq]);
}

for (const c of [
  { who: XP.pass, post: true, title: 'PassOK dual gate: 사후 done + the tick that crosses 54,000 s → PassOK Y' },
  { who: XP.noPost, post: false, title: 'PassOK dual gate: 54,000 s without 사후 → Study.Progress 100 but PassOK stays N' },
]) {
  test(c.title, async ({ page, checks }) => {
    const me = c.who;
    await resetLearner(me.id, me.seq);
    await build53990(me.id, me.seq);
    const ch4 = X01.chapters[3];
    await page.clock.install();
    await hidePopups(page);
    await openAs(page, me.id, `/learn/${me.seq}/${ch4.chapterSeq}?lectureCode=E2EX01`);
    await expect(page.getByText('이전 저장위치 00:30부터 이어서 재생합니다.')).toBeVisible();
    const seeded = await lastLog(me.id); // chapter 4's 30 s row, two days old
    const start = await nextTick(page, 'Start', () => page.getByRole('button', { name: '학습 시작하기' }).click());
    const afterStart = await lastLog(me.id);
    // the Start measures from the stored 30 s row like any save (resume ≈ 30 → posΔ ≈ 0)
    expect(start.ack.StudyTime).toBe(phpStudyTime(10_790, phpCredit(seeded.PositionSec, seeded.reg_ts, afterStart.reg_ts, start.body.positionSec), CAP));
    expect(start.ack.PassOk).toBe('N');
    // 15 s more playhead after an hour of wall time → +15 s → Σ ≥ 54,000
    await db.exec('UPDATE ProgressLog SET RegDate = DATE_SUB(RegDate, INTERVAL 3600 SECOND) WHERE ID = ? ORDER BY idx DESC LIMIT 1', [me.id]);
    const from = (await lastLog(me.id)).PositionSec;
    await seekVideo(page, from + 15);
    const t = await nextTick(page, 'Middle', () => page.clock.fastForward(60_000));
    const total = Number(await db.scalar('SELECT SUM(StudyTime) FROM Progress WHERE Study_Seq = ?', [me.seq]));
    expect(total).toBe(14_400 * 3 + start.ack.StudyTime + (t.body.positionSec - from));
    expect(total).toBeGreaterThanOrEqual(54_000);
    // PHP: PassOK = 사후 ≥ 1 (exact Seq) AND Σ ≥ 54,000 (study_completion_lib.php:406-422); Study.Progress = floor(Σ / 54,000 × 100) → 100
    expect(t.ack).toMatchObject({ PassOk: c.post ? 'Y' : 'N', Total_Progress: 100 });
    expect(await studyOf(me.seq)).toEqual({ Progress: phpStudyProgress(total), PassOK: c.post ? 'Y' : 'N' });
    await checks.checkpoint(c.post ? 'passok-y' : 'passok-n', { settle: false });
    // the 15-hour reminder is about this enrollment's 사후 (assessment.postDone of the exact Study_Seq)
    await expect(page.getByText('학습이 완료되었습니다! 수료를 위해 사후진단을 진행해주세요.')).toHaveCount(c.post ? 0 : 1);
    await leavePlayer(page, me.id);
  });
}
