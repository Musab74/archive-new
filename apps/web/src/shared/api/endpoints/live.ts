import { z } from 'zod';
import { api } from '../client';

const nstr = z.string().nullable().optional().transform((v) => v ?? null);
const Blocked = z.object({ available: z.boolean(), reason: z.string() });

export const LiveEnrollmentSchema = z.object({
  studySeq: z.number().int(), lectureCode: z.string(), title: z.string(), professor: nstr, contentsTime: nstr,
  lectureStart: nstr, lectureEnd: nstr, window: z.enum(['before', 'open', 'ended']), windowLabel: z.string(),
});
export type LiveEnrollment = z.infer<typeof LiveEnrollmentSchema>;
export const LiveOverviewSchema = z.object({
  liveClassUrl: z.string(), entryAvailable: z.boolean(), signedIn: z.boolean(), enrollments: z.array(LiveEnrollmentSchema).default([]),
  schedule: Blocked, discussions: Blocked.extend({ items: z.array(z.unknown()).default([]) }),
});
export type LiveOverview = z.infer<typeof LiveOverviewSchema>;
export interface LiveEntry { launchUrl: string; records: boolean; notice: string }

/**
 * AR-16 토론방·라이브 (/v1/support/live). Live schedules/attendance stay on the Live Class server (MongoDB) and discussion
 * boards have no tables, so the overview says so; the entry issues the PHP-shaped SSO address (live.hrdeedu.co.kr?token=).
 */
export const liveApi = {
  overview: (signal?: AbortSignal) => api.get<LiveOverview>('/support/live', { schema: LiveOverviewSchema, signal }),
  entry: () => api.post<LiveEntry>('/support/live/entry', undefined, { schema: z.object({ launchUrl: z.string(), records: z.boolean(), notice: z.string() }) }),
};
