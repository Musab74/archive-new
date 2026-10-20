import { z } from 'zod';
import { api } from '../client';

// 실시간 트래픽 (학습자별) — /v1/admin/monitoring/traffic
const S = z.string().nullable();

export const TrafficLearnerSchema = z.object({
  id: z.string(), name: S, companyName: S, lectureCode: z.string(), courseName: S, contentsIdx: z.number(), lessonTitle: S, studySeq: z.number(), lastTick: z.string(),
  ip: S, sharedIp: z.number(), connections: z.number(), rateBps: z.number(), peakBps: z.number(), sessionBytes: z.number(), sessionStart: S, todayBytes: z.number(),
  spark: z.array(z.number()),
});
export type TrafficLearner = z.infer<typeof TrafficLearnerSchema>;

export const TrafficLiveSchema = z.object({
  at: z.string(), day: z.string(),
  monitor: z.object({
    enabled: z.boolean(), running: z.boolean(), startedAt: S, sampleMs: z.number(), ports: z.array(z.string()), lastSampleAt: S, error: S,
    learnersAt: S, learnerError: S, activeWindowSec: z.number(), rateWindowSec: z.number(),
  }),
  site: z.object({ rateBps: z.number(), peakBps: z.number(), todayBytes: z.number(), connections: z.number(), series: z.array(z.number()) }),
  learners: z.object({ active: z.number(), receiving: z.number(), sharedIps: z.number(), rateBps: z.number() }),
  items: z.array(TrafficLearnerSchema),
  focus: z.array(z.object({ id: z.string(), series: z.array(z.number()) })),
  unidentified: z.array(z.object({ ip: z.string(), rateBps: z.number(), todayBytes: z.number(), connections: z.number() })),
});
export type TrafficLive = z.infer<typeof TrafficLiveSchema>;

export const adminTrafficApi = {
  live: (focus: string[], signal?: AbortSignal) => api.get<TrafficLive>('/admin/monitoring/traffic/live', { query: focus.length ? { focus: focus.join(',') } : {}, schema: TrafficLiveSchema, signal }),
};
