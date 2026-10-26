import { z } from 'zod';

/** 'Seek' = a packaged lesson's ArchivePlayerSeek message (player2.php:3695-3757): saved like any tick, TriggerYN 'N'. */
export const ProgressStep = z.enum(['Start', 'Middle', 'End', 'Seek']);

/** Same fields the PHP player posts to player/lecture_progress.php. */
export const ProgressTickSchema = z.object({
  studySeq: z.coerce.number().int().positive(),
  lectureCode: z.string().min(1).max(50),
  studyLectureCode: z.string().max(50).default(''),
  chapterSeq: z.coerce.number().int().nonnegative(),
  chapterNumber: z.string().max(10),
  contentsIdx: z.coerce.number().int().nonnegative(),
  contentsDetailSeq: z.coerce.number().int().nonnegative().default(0),
  /** Progress/ProgressLog.LastStudy varchar(150): packaged lessons send the section page path (player2.php:3427-3446). */
  lastStudy: z.string().max(150).default(''),
  completeTime: z.coerce.number().nonnegative().default(0),
  progressStep: ProgressStep,
  positionSec: z.coerce.number().int().nonnegative().default(0),
  progressTime: z.coerce.number().int().nonnegative().default(0),
  playToken: z.string().max(64).default(''),
});
export type ProgressTick = z.infer<typeof ProgressTickSchema>;

/** Legacy JSON shape returned by lecture_progress.php (kept for parity). */
export const ProgressTickResponseSchema = z.object({
  Chapter_Number: z.number().int(),
  Study_Seq: z.number().int(),
  ProgressCount: z.string(),
  Total_Progress: z.number().int(),
  ChapterProgress: z.number().int(),
  PassOk: z.enum(['Y', 'N']),
  ChkError: z.enum(['N', 'X', 'F']),
  StudyTime: z.number().int(),
  PositionSec: z.number().int(),
  Overlap: z.literal('Y').optional(),
  DailyCap: z.literal('Y').optional(),
  message: z.string().optional(),
});
export type ProgressTickResponse = z.infer<typeof ProgressTickResponseSchema>;

export const PlayerSessionOpenSchema = z.object({
  studySeq: z.coerce.number().int().positive().optional(),
  lectureCode: z.string().min(1).max(50),
  chapterNumber: z.string().max(10).default('1'),
  playToken: z.string().max(64).default(''),
  /** 「여기서 학습 계속하기」: replace a live lock held by another window of the same login (that window stops at its next heartbeat). */
  takeover: z.boolean().default(false),
});

export const HeartbeatSchema = z.object({ playToken: z.string().min(1).max(64) });
