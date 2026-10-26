/**
 * Helpers shared by the 학습창 specs (e2e/player/*.spec.ts): learner reset, tick capture, DB reads and the PHP formulas written out
 * by hand (player/lecture_progress.php) so every spec compares the API's numbers with the PHP rule, not with the API's own code.
 */
import { expect, type Page, type Request, type Response } from '@playwright/test';
import { db } from '../support/db';

/** Fixture learners of fixtures/player.sql (all on ARC2026 term 9301, 사전 done). */
export const XP = {
  ticks: { id: 'xplayer01', seq: 22101 },
  pkg: { id: 'xplayer02', seq: 22102 },
  lock: { id: 'xplayer03', seq: 22103 },
  daily: { id: 'xplayer04', seq: 22104 },
  testId: { id: 'xplayer05', seq: 22105 },
  pass: { id: 'xplayer06', seq: 22106 },
  noPost: { id: 'xplayer07', seq: 22107 },
} as const;

/** Removes everything a previous run wrote for this learner's enrollment (Progress delete triggers write 'D' score rows — dropped too). */
export async function resetLearner(id: string, seq: number): Promise<void> {
  await db.exec('DELETE FROM PlayLock WHERE ID = ?', [id]);
  await db.exec('DELETE FROM ProgressLog WHERE ID = ?', [id]);
  // the live delete trigger looks the 진도 number up by Chapter.OrderByNum = Chapter_Number (NULL → the DELETE fails); a row saved while a
  // test had moved an OrderByNum is remapped to the chapter's current number first
  await db.exec('UPDATE Progress p INNER JOIN Chapter ch ON ch.Seq = p.Chapter_Seq SET p.Chapter_Number = ch.OrderByNum WHERE p.ID = ? AND p.Chapter_Number <> ch.OrderByNum', [id]);
  await db.exec('DELETE FROM Progress WHERE ID = ?', [id]);
  await db.exec('DELETE FROM TB_SCORE_HIST_V2 WHERE USER_AGENT_PK = ?', [id]);
  await db.exec("UPDATE Study SET Progress = 0, PassOK = 'N' WHERE Seq = ? AND ID = ?", [seq, id]);
  await db.exec("DELETE FROM Review WHERE ID = ?", [id]);
  await db.exec("DELETE FROM Counsel WHERE ID = ?", [id]);
}

export interface Tick { body: { progressStep: string; positionSec: number; progressTime: number; chapterNumber: string; lastStudy: string; playToken: string; studySeq: number; chapterSeq: number; contentsIdx: number; contentsDetailSeq: number; completeTime: number; lectureCode: string }; ack: { ChkError: string; StudyTime: number; ChapterProgress: number; Total_Progress: number; PassOk: string; PositionSec: number; Overlap?: string; Chapter_Number: number } }

const isTick = (r: Request) => r.method() === 'POST' && /\/v1\/player\/progress(\?|$)/.test(r.url());

/** Waits for the next POST /v1/player/progress of `step` and returns what the page sent and what the API answered. */
export async function nextTick(page: Page, step: 'Start' | 'Middle' | 'End' | 'Seek', action?: () => Promise<unknown>): Promise<Tick> {
  const resP = page.waitForResponse((r: Response) => isTick(r.request()) && (r.request().postDataJSON() as { progressStep?: string })?.progressStep === step, { timeout: 30_000 });
  if (action) await action();
  const res = await resP;
  expect(res.status(), `tick ${step}`).toBe(200);
  return { body: res.request().postDataJSON(), ack: await res.json() };
}

export interface LogRow { idx: number; Chapter_Seq: number; Contents_idx: number; PositionSec: number; StudyTime: number; Progress: number; TriggerYN: string; Chapter_Number: string; TotalProgress: number; LastStudy: string; reg_ts: number; RegDate: string }

export async function logs(id: string): Promise<LogRow[]> {
  return db.query<LogRow>('SELECT idx, Chapter_Seq, Contents_idx, PositionSec, StudyTime, Progress, TriggerYN, Chapter_Number, TotalProgress, LastStudy, UNIX_TIMESTAMP(RegDate) AS reg_ts, RegDate FROM ProgressLog WHERE ID = ? ORDER BY idx', [id]);
}
export async function lastLog(id: string): Promise<LogRow> {
  const all = await logs(id);
  expect(all.length, `ProgressLog rows of ${id}`).toBeGreaterThan(0);
  return all[all.length - 1];
}

export interface ProgRow { StudyTime: number; Progress: number; TriggerYN: string; Chapter_Number: string; LastStudy: string; ContentsDetail_Seq: number; RegDate: string; UserIP: string }
export async function progressOf(id: string, seq: number, chapterSeq: number): Promise<ProgRow | null> {
  return db.one<ProgRow>('SELECT StudyTime, Progress, TriggerYN, Chapter_Number, LastStudy, ContentsDetail_Seq, RegDate, UserIP FROM Progress WHERE ID = ? AND Study_Seq = ? AND Chapter_Seq = ? ORDER BY idx DESC LIMIT 1', [id, seq, chapterSeq]);
}
export async function studyOf(seq: number): Promise<{ Progress: number; PassOK: string }> {
  return (await db.one<{ Progress: number; PassOK: string }>('SELECT Progress, PassOK FROM Study WHERE Seq = ?', [seq]))!;
}
export async function scoreHist(id: string): Promise<Array<{ EVAL_TYPE: string; SCORE: number; CONTENTS_AGENT_PK: string; COURSE_AGENT_PK: string; CLASS_AGENT_PK: string; CHANGE_STATE: string; CHASI: string }>> {
  return db.query('SELECT EVAL_TYPE, SCORE, CONTENTS_AGENT_PK, COURSE_AGENT_PK, CLASS_AGENT_PK, CHANGE_STATE, CHASI FROM TB_SCORE_HIST_V2 WHERE USER_AGENT_PK = ? ORDER BY SEQ', [id]);
}

// ------------------------------------------------------------------ PHP formulas, written out from player/lecture_progress.php

/** lecture_progress.php:222-234 — credit = max(0, min(posΔ, wallΔ + 5)); posΔ > 60 && wallΔ < 15 → 0; wallΔ = max(0, now − prev). */
export function phpCredit(prevPos: number, prevTs: number, nowTs: number, pos: number): number {
  const wall = Math.max(0, nowTs - prevTs);
  const posDelta = pos - prevPos;
  if (posDelta <= 0) return 0;
  if (posDelta > 60 && wall < 15) return 0;
  return Math.max(0, Math.min(posDelta, wall + 5));
}
/** lecture_progress.php:292-302 — StudyTime = old + credit, capped by the content length, then 14,400 s. */
export function phpStudyTime(old: number, credit: number, contentLenSec: number): number {
  let t = old + credit;
  if (contentLenSec > 0 && t > contentLenSec) t = contentLenSec;
  if (t > 14_400) t = 14_400;
  return t;
}
/** lecture_progress.php:311-317 — chapter % = floor(StudyTime / CompleteTime × 100), 0..100. */
export const phpChapterPct = (studyTime: number, completeTime: number) => Math.min(100, Math.max(0, Math.floor((studyTime / completeTime) * 100)));
/** lecture_progress.php:428-436 — Study.Progress = floor(Σ StudyTime / 54,000 × 100), max 100, 1 when any time exists. */
export function phpStudyProgress(totalSec: number): number {
  let p = Math.floor((totalSec / 54_000) * 100);
  if (p > 100) p = 100;
  if (p === 0 && totalSec > 0) p = 1;
  return p;
}

// ------------------------------------------------------------------ page helpers

/** Seeks the lesson's <video> and waits for `seeked` (the next tick posts floor(currentTime)). */
export async function seekVideo(page: Page, sec: number): Promise<void> {
  await page.evaluate(async (s) => {
    const v = document.querySelector('video');
    if (!v) throw new Error('no <video>');
    if (v.readyState < 1) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
    await new Promise<void>((resolve) => { v.addEventListener('seeked', () => resolve(), { once: true }); v.currentTime = s; });
  }, sec);
}

/** Leaves the player via SPA navigation (unmount → End beacon + PlayLock release) and waits until the lock row is gone. */
export async function leavePlayer(page: Page, id: string): Promise<void> {
  await page.goto('/my');
  await expect.poll(() => db.scalar<number>('SELECT COUNT(*) FROM PlayLock WHERE ID = ?', [id]), { timeout: 15_000 }).toBe(0);
}
