import { api } from '../client';
import { AssessmentQuestionsSchema, AssessmentResultSchema, AssessmentScoreSchema, OkSchema, PreAssessmentStatusLooseSchema, type AssessmentQuestion, type AssessmentResult, type AssessmentScore, type PreStatus } from '../schemas';
import { z } from 'zod';

export type Phase = 'pre' | 'post';
export interface ProfileBody { studySeq: number; col1: string; col2?: string; col3?: string; col4?: string }
export interface AnswersBody { studySeq: number; answers: { questionIdx: number; value: number }[] }
export interface QuestionsResponse { questions: AssessmentQuestion[]; jobTracks: string[] }

export const assessmentApi = {
  questions: (q: { phase: Phase; depth: 'step02' | 'step03'; group?: string }, signal?: AbortSignal) => api.get<QuestionsResponse>('/assessment/questions', { query: q, schema: AssessmentQuestionsSchema, signal }),
  preStatus: (studySeq?: number, signal?: AbortSignal) => api.get<PreStatus & { studySeq?: number | null }>('/assessment/pre/status', { query: { studySeq }, schema: PreAssessmentStatusLooseSchema.extend({ studySeq: z.number().nullable().optional() }), signal }),
  preProfile: (body: ProfileBody) => api.post<PreStatus>('/assessment/pre/profile', body, { schema: PreAssessmentStatusLooseSchema }),
  preAnswers: (body: AnswersBody) => api.post<PreStatus>('/assessment/pre/answers', body, { schema: PreAssessmentStatusLooseSchema }),
  postProfile: (body: ProfileBody) => api.post<{ ok: boolean }>('/assessment/post/profile', body, { schema: OkSchema }),
  postAnswers: (body: AnswersBody) => api.post<{ score: AssessmentScore }>('/assessment/post/answers', body, { schema: z.object({ score: AssessmentScoreSchema }) }),
  result: (studySeq?: number, signal?: AbortSignal) => api.get<AssessmentResult>('/assessment/result', { query: { studySeq }, schema: AssessmentResultSchema, signal }),
};
