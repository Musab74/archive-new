import { api } from '../client';
import { AiRoadmapSchema, type AiRoadmap } from '../schemas';

export interface RoadmapRequest { jobField: string; goal: string; hoursPerWeek: number }

/** POST /ai/roadmap — {steps[{lectureCode,title,reason,minutes}], summary, source:'ai'|'fallback'} (the catalogApi.roadmap wrapper predates this shape). */
export const aiApi = {
  roadmap: (body: RoadmapRequest) => api.post<AiRoadmap>('/ai/roadmap', body, { schema: AiRoadmapSchema }),
};
