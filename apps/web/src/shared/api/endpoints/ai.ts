import { z } from 'zod';
import { api } from '../client';
import { AiRoadmapSchema } from '../schemas';

/** roadmap-recommend.php inputs: empty jobField/goal → defaults from the learner's history (My Page "HRDe 추천 로드맵"). */
export interface RoadmapRequest { jobField?: string; goal?: string; hoursPerWeek?: number; availableTime?: string; noCache?: boolean }

const ns = z.string().nullable().optional();
const StepSchema = z.object({ lectureCode: ns, title: z.string(), reason: ns, minutes: z.number().nullable().optional(), progress: z.number().default(0), liked: z.boolean().default(false) });
export const RoadmapStagesSchema = AiRoadmapSchema.extend({
  stages: z.array(z.object({ key: z.string(), reason: z.string().default(''), steps: z.array(StepSchema).default([]) })).default([]),
  profile: z.object({ jobField: z.string().default(''), goal: z.string().default(''), availableTime: z.string().default(''), level: z.string().default('beginner'), completedCount: z.number().default(0) }).nullable().optional(),
  cached: z.boolean().optional(),
});
export type RoadmapStaged = z.infer<typeof RoadmapStagesSchema>;

/** POST /ai/roadmap — {steps[], stages[{key, reason, steps[]}], summary, source:'ai'|'fallback', profile} (the catalogApi.roadmap wrapper reads only steps). */
export const aiApi = {
  roadmap: (body: RoadmapRequest) => api.post<RoadmapStaged>('/ai/roadmap', body, { schema: RoadmapStagesSchema }),
};
