import { z } from 'zod';
import { api } from '../client';
import { AssessmentScoreSchema, OkSchema, pageOf, PreAssessmentStatusLooseSchema, type PreStatus } from '../schemas';

export type Phase = 'pre' | 'post';
const ns = z.string().nullable().optional();
const num0 = z.number().default(0);

export const QuestionSchema = z.object({ idx: z.number().int(), group: ns, order: z.number().nullable().optional(), bind: ns, text: ns, detail: ns });
export type Question = z.infer<typeof QuestionSchema>;
const AnswerMapSchema = z.record(z.string(), z.number()).default({});
const PeriodSchema = z.object({ start: z.string().default(''), end: z.string().default('') });

/** GET /assessment/pre/form — prev_test01-03 page data for one enrollment. */
export const PreFormSchema = z.object({
  studySeq: z.number().int(),
  isGrant: z.boolean().default(false),
  period: PeriodSchema.default({ start: '', end: '' }),
  status: PreAssessmentStatusLooseSchema,
  roles: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
  common: z.array(QuestionSchema).default([]),
  leader: z.array(QuestionSchema).default([]),
  roleQuestions: z.record(z.string(), z.array(QuestionSchema)).default({}),
  profileOptions: z.object({ job: z.array(QuestionSchema).default([]), interests: z.array(QuestionSchema).default([]), skills: z.array(QuestionSchema).default([]) }),
  saved: z.object({ role: z.string().default(''), job: z.number().nullable().default(null), interests: z.array(z.number()).default([]), skills: z.array(z.number()).default([]), answers: AnswerMapSchema }),
});
export type PreForm = z.infer<typeof PreFormSchema>;

const SatisfactionStatusSchema = z.object({ required: num0, answered: num0, submitted: z.boolean().default(false), submittedAt: z.string().default('') });
export type SatisfactionStatus = z.infer<typeof SatisfactionStatusSchema>;

/** GET /assessment/post/form — post_test01-03 page data (공통·리더십, 직무, 만족도). */
export const PostFormSchema = z.object({
  studySeq: z.number().int(),
  isGrant: z.boolean().default(false),
  isRetroClosedW: z.boolean().default(false),
  skipsStudyTimeGate: z.boolean().default(false),
  period: PeriodSchema.default({ start: '', end: '' }),
  col1: z.string().default(''),
  roleLabel: z.string().default(''),
  common: z.array(QuestionSchema).default([]),
  leader: z.array(QuestionSchema).default([]),
  job: z.array(QuestionSchema).default([]),
  satisfaction: z.array(QuestionSchema).default([]),
  saved: z.object({ answers: AnswerMapSchema }),
  post: z.object({ completed: z.boolean().default(false), total: num0 }),
  satisfactionStatus: SatisfactionStatusSchema,
});
export type PostForm = z.infer<typeof PostFormSchema>;

const StepResultSchema = z.object({ studySeq: z.number().int(), isGrant: z.boolean().default(false), status: PreAssessmentStatusLooseSchema });
const PostSaveSchema = z.object({ studySeq: z.number().int(), isGrant: z.boolean().default(false), isRetroClosedW: z.boolean().default(false), score: AssessmentScoreSchema, passOk: z.boolean().default(false), satisfactionStatus: SatisfactionStatusSchema });

const PairSchema = z.object({ pre: num0, post: num0 });
export const PanelScoresSchema = z.object({ common: PairSchema, leader: PairSchema, job: PairSchema, total: PairSchema });
export type PanelScores = z.infer<typeof PanelScoresSchema>;
const LabelSchema = z.object({ kind: z.string().default('other'), year: z.string().default(''), start: z.string().default(''), end: z.string().default('') });
export type PanelLabel = z.infer<typeof LabelSchema>;

export const PanelSchema = z.object({
  studySeq: z.number().int(),
  label: LabelSchema,
  isActive: z.boolean().default(false),
  isRetro: z.boolean().default(false),
  serviceType: ns,
  studyEnd: z.boolean().default(false),
  col1: z.string().default(''),
  roleLabel: z.string().default(''),
  scores: PanelScoresSchema,
  pre: z.object({ status: PreAssessmentStatusLooseSchema, completed: z.boolean().default(false), started: z.boolean().default(false), completedAt: z.string().default('') }),
  post: z.object({ completed: z.boolean().default(false), started: z.boolean().default(false), state: z.string().default('not_started'), completedAt: z.string().default('') }),
  grants: z.object({ pre: z.boolean().default(false), post: z.boolean().default(false), preExpiresAt: ns, postExpiresAt: ns }),
  fifteenHours: z.boolean().default(false),
  retroWritable: z.boolean().default(false),
});
export type Panel = z.infer<typeof PanelSchema>;

/** GET /assessment/panels — tab-assessment.php. */
export const PanelsSchema = z.object({
  activeStudySeq: z.number().int().nullable(),
  hasActiveEnrollment: z.boolean().default(false),
  hasAssessmentGrant: z.boolean().default(false),
  mandatoryPre: z.boolean().default(false),
  studyTime: z.object({ totalSeconds: num0, completionSeconds: num0, requiredSeconds: z.number().default(54000), fifteenHoursMet: z.boolean().default(false), gateOpen: z.boolean().default(false), earlyAccess: z.boolean().default(false) }),
  panels: z.array(PanelSchema).default([]),
});
export type PanelsView = z.infer<typeof PanelsSchema>;

const RowSchema = z.object({ question: z.string().default(''), detail: ns, pre: z.number().nullable(), post: z.number().nullable() });
export type ScoreRow = z.infer<typeof RowSchema>;

/** GET /assessment/result — AR-08 (pre/post keep the {common, leader, job, total, submitted} shape used by 학습결과보고서). */
export const AssessmentResultSchema = z.object({
  studySeq: z.number().nullable().optional(),
  isActive: z.boolean().default(false),
  period: PeriodSchema.default({ start: '', end: '' }),
  col1: z.string().default(''),
  roleLabel: z.string().default(''),
  learner: z.object({ name: z.string().default(''), companyName: z.string().default('') }).default({ name: '', companyName: '' }),
  scores: PanelScoresSchema.optional(),
  rows: z.object({ common: z.array(RowSchema).default([]), leader: z.array(RowSchema).default([]), job: z.array(RowSchema).default([]) }).default({ common: [], leader: [], job: [] }),
  pre: AssessmentScoreSchema.extend({ started: z.boolean().default(false), completedAt: z.string().default('') }),
  post: AssessmentScoreSchema.extend({ completedAt: z.string().default('') }),
  comparable: z.boolean().default(false),
  satisfaction: SatisfactionStatusSchema.optional(),
  improvement: z.number().nullable().default(null),
  recommendations: z.array(z.string()).default([]),
});
export type AssessmentResult = z.infer<typeof AssessmentResultSchema>;

/** GET /assessment/satisfaction — AR-17 list. */
export const SatisfactionListSchema = z.object({
  items: z.array(z.object({
    studySeq: z.number().int(), label: LabelSchema, isActive: z.boolean().default(false), grant: z.boolean().default(false),
    questionCount: num0, required: num0, answered: num0, submitted: z.boolean().default(false), submittedAt: z.string().default(''),
    open: z.boolean().default(false), blockedReason: z.string().nullable().default(null),
  })).default([]),
});
export type SatisfactionList = z.infer<typeof SatisfactionListSchema>;
export type SatisfactionItem = SatisfactionList['items'][number];

export const ReviewItemSchema = z.object({ idx: z.number().int(), lectureCode: z.string(), courseName: ns, title: z.string().default(''), starPoint: num0, regDate: ns, viewCount: num0, author: ns });
export type ReviewItem = z.infer<typeof ReviewItemSchema>;
export const ReviewDetailSchema = ReviewItemSchema.extend({ contents: z.string().default(''), visible: z.boolean().optional() });
export type ReviewDetail = z.infer<typeof ReviewDetailSchema>;
const ReviewPageSchema = pageOf(ReviewItemSchema);
export type ReviewPage = z.infer<typeof ReviewPageSchema>;
export const ReviewBoardSchema = ReviewPageSchema.extend({ course: z.object({ lectureCode: z.string(), name: ns, avgStar: num0, reviewCount: num0 }).nullable().default(null) });
export type ReviewBoard = z.infer<typeof ReviewBoardSchema>;

type Answers = { questionIdx: number; value: number }[];
type StepResult = z.infer<typeof StepResultSchema>;
export type PostSave = z.infer<typeof PostSaveSchema>;
const scopeQuery = (studySeq?: number | null, grant?: boolean) => ({ studySeq: studySeq ?? undefined, grant: grant ? 1 : undefined });

export const assessmentApi = {
  preStatus: (studySeq?: number, signal?: AbortSignal) => api.get<PreStatus & { studySeq?: number | null }>('/assessment/pre/status', { query: { studySeq }, schema: PreAssessmentStatusLooseSchema.extend({ studySeq: z.number().nullable().optional() }), signal }),
  preForm: (studySeq?: number | null, grant?: boolean, signal?: AbortSignal) => api.get<PreForm>('/assessment/pre/form', { query: scopeQuery(studySeq, grant), schema: PreFormSchema, signal }),
  preStep01: (body: { studySeq: number; role: 'W' | 'M'; answers: Answers; grant?: boolean }) => api.post<StepResult>('/assessment/pre/step01', body, { schema: StepResultSchema }),
  preStep02: (body: { studySeq: number; answers: Answers; grant?: boolean }) => api.post<StepResult>('/assessment/pre/step02', body, { schema: StepResultSchema }),
  preStep03: (body: { studySeq: number; job: number; interests: number[]; skills: number[]; grant?: boolean }) => api.post<StepResult>('/assessment/pre/step03', body, { schema: StepResultSchema }),
  postForm: (studySeq?: number | null, grant?: boolean, signal?: AbortSignal) => api.get<PostForm>('/assessment/post/form', { query: scopeQuery(studySeq, grant), schema: PostFormSchema, signal }),
  postAnswers: (body: { studySeq: number; step: 'common' | 'job' | 'satisfaction'; answers: Answers; final?: boolean; grant?: boolean }) => api.post<PostSave>('/assessment/post/answers', body, { schema: PostSaveSchema }),
  panels: (signal?: AbortSignal) => api.get<PanelsView>('/assessment/panels', { schema: PanelsSchema, signal }),
  result: (studySeq?: number, signal?: AbortSignal) => api.get<AssessmentResult>('/assessment/result', { query: { studySeq }, schema: AssessmentResultSchema, signal }),
  satisfaction: (signal?: AbortSignal) => api.get<SatisfactionList>('/assessment/satisfaction', { schema: SatisfactionListSchema, signal }),
};

export const reviewsApi = {
  mine: (page: number, signal?: AbortSignal) => api.get<ReviewPage>('/my/reviews', { query: { page, size: 10 }, schema: ReviewPageSchema, signal }),
  mineOne: (idx: number, signal?: AbortSignal) => api.get<ReviewDetail>(`/my/reviews/${idx}`, { schema: ReviewDetailSchema, signal }),
  update: (idx: number, body: { title: string; contents: string; starPoint: number }) => api.patch<ReviewDetail>(`/my/reviews/${idx}`, body, { schema: ReviewDetailSchema }),
  remove: (idx: number) => api.delete<{ ok: boolean }>(`/my/reviews/${idx}`, { schema: OkSchema }),
  board: (q: { page: number; sw?: string; lectureCode?: string }, signal?: AbortSignal) => api.get<ReviewBoard>('/reviews', { query: { page: q.page, size: 25, sw: q.sw || undefined, lectureCode: q.lectureCode || undefined }, schema: ReviewBoardSchema, signal }),
  boardOne: (idx: number, signal?: AbortSignal) => api.get<ReviewDetail>(`/reviews/${idx}`, { schema: ReviewDetailSchema, signal }),
};
