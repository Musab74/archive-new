import { z } from 'zod';
import { api } from '../client';

// HLS 변환 (영상 경량화) — /v1/admin/hls
const S = z.string().nullable();
export const HLS_JOB_STATES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const;
export type HlsJobState = (typeof HLS_JOB_STATES)[number];

const RenditionSchema = z.object({ name: z.string(), width: z.number(), height: z.number(), bandwidth: z.number(), bytes: z.number(), seconds: z.number(), playlist: z.string(), file: z.string() });
const ResultSchema = z.object({ sourceSeconds: z.number(), renditions: z.array(RenditionSchema), bytes: z.number(), encodeSeconds: z.number(), publicUrl: z.string() }).nullable();

export const HlsJobSchema = z.object({
  id: z.string(), state: z.enum(HLS_JOB_STATES), sourceRel: z.string(), key: z.string(), ver: z.string(), include1080: z.boolean(), sourceBytes: z.number(),
  lectureCode: z.string(), chapterSeq: z.number().nullable(), contentsIdx: z.number().nullable(), title: z.string(), requestedBy: z.string(),
  createdAt: z.string(), startedAt: S, finishedAt: S, progress: z.number(), speed: z.number().nullable(), error: S, result: ResultSchema,
});
export type HlsJob = z.infer<typeof HlsJobSchema>;

export const HlsSourceSchema = z.object({
  rel: z.string(), exists: z.boolean(), bytes: z.number().nullable(), mtime: S, problem: S, ready: z.boolean(), ver: S, publicUrl: S, otherVersions: z.array(z.string()),
  job: HlsJobSchema.pick({ id: true, state: true, progress: true, speed: true, error: true, createdAt: true, finishedAt: true, result: true }).nullable(),
});
export type HlsSource = z.infer<typeof HlsSourceSchema>;

export const HlsCourseSchema = z.object({
  lectureCode: z.string(), title: z.string(), ctype: S, packageYN: z.boolean(), activeDays: z.number(),
  totals: z.object({ chapters: z.number(), sources: z.number(), ready: z.number(), sourceBytes: z.number(), hlsBytes: z.number() }),
  chapters: z.array(z.object({
    number: z.number(), chapterSeq: z.number(), title: z.string(), minutes: z.number(), contentsIdx: z.number(), contentsType: z.string(),
    url: S, packagePage: S, problem: S, sources: z.array(HlsSourceSchema), learners30: z.number(), lastStudy: S, idle: z.boolean(),
  })),
});
export type HlsCourse = z.infer<typeof HlsCourseSchema>;
export type HlsChapter = HlsCourse['chapters'][number];

export const HlsStatusSchema = z.object({
  featureEnabled: z.boolean(),
  worker: z.object({ alive: z.boolean(), lastSeen: S, ffmpeg: S, hours: S, runningJob: S }),
  queue: z.object({ queued: z.number(), running: z.number(), done: z.number(), failed: z.number(), cancelled: z.number() }),
  hlsRootExists: z.boolean(), publicBase: z.string(), preset: z.string(), threads: z.number(),
});
export type HlsStatus = z.infer<typeof HlsStatusSchema>;

export const HlsEnqueueResultSchema = z.object({
  lectureCode: z.string(),
  queued: z.array(z.object({ chapterSeq: z.number(), rel: z.string(), jobId: z.string(), created: z.boolean(), state: z.string() })),
  skipped: z.array(z.object({ chapterSeq: z.number(), rel: S, reason: z.string() })),
});
export type HlsEnqueueResult = z.infer<typeof HlsEnqueueResultSchema>;
const HlsJobListSchema = z.object({ items: z.array(HlsJobSchema), total: z.number() });
export const HlsPopularSchema = z.object({
  days: z.number(), cachedAt: z.string(),
  items: z.array(z.object({
    contentsIdx: z.number(), title: z.string(), minutes: z.number(), contentsType: z.string(), learners: z.number(), lastStudy: S,
    lectureCode: S, chapterSeq: z.number().nullable(), courses: z.number(), url: S, problem: S, sources: z.array(HlsSourceSchema),
  })),
});
export type HlsPopular = z.infer<typeof HlsPopularSchema>;
export type HlsPopularItem = HlsPopular['items'][number];
const HlsEnqueueContentsSchema = HlsEnqueueResultSchema.omit({ lectureCode: true }).extend({ skippedContents: z.array(z.object({ contentsIdx: z.number(), reason: z.string() })) });

export const adminHlsApi = {
  status: (signal?: AbortSignal) => api.get<HlsStatus>('/admin/hls/status', { schema: HlsStatusSchema, signal }),
  course: (lectureCode: string, signal?: AbortSignal) => api.get<HlsCourse>(`/admin/hls/course/${encodeURIComponent(lectureCode)}`, { schema: HlsCourseSchema, signal }),
  enqueue: (body: { lectureCode: string; chapterSeqs: number[]; include1080: boolean }) => api.post<HlsEnqueueResult>('/admin/hls/jobs', body, { schema: HlsEnqueueResultSchema }),
  jobs: (query: { lectureCode?: string; state?: HlsJobState; limit?: number }, signal?: AbortSignal) => api.get<{ items: HlsJob[]; total: number }>('/admin/hls/jobs', { query: { ...query }, schema: HlsJobListSchema, signal }),
  popular: (query: { days?: number; limit?: number; refresh?: 'Y' }, signal?: AbortSignal) => api.get<HlsPopular>('/admin/hls/popular', { query: { ...query }, schema: HlsPopularSchema, signal }),
  enqueueContents: (body: { contentsIdx: number[]; include1080: boolean }) => api.post<z.infer<typeof HlsEnqueueContentsSchema>>('/admin/hls/jobs/contents', body, { schema: HlsEnqueueContentsSchema }),
  cancel: (id: string) => api.post<HlsJob>(`/admin/hls/jobs/${id}/cancel`, undefined, { schema: HlsJobSchema }),
};
