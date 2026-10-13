import { z } from 'zod';

export const ProgressStep = z.enum(['Start', 'Middle', 'End']);

/** Same fields the PHP player posts to player/lecture_progress.php. */
export const ProgressTickSchema = z.object({
  studySeq: z.coerce.number().int().positive(),
  lectureCode: z.string().min(1).max(50),
  studyLectureCode: z.string().max(50).default(''),
  chapterSeq: z.coerce.number().int().nonnegative(),
  chapterNumber: z.string().max(10),
  contentsIdx: z.coerce.number().int().nonnegative(),
  contentsDetailSeq: z.coerce.number().int().nonnegative().default(0),
  lastStudy: z.string().max(50).default(''),
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
});

export const HeartbeatSchema = z.object({ playToken: z.string().min(1).max(64) });
