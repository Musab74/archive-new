import { z } from 'zod';

export const AssessmentAnswerSchema = z.object({ questionIdx: z.number().int().positive(), value: z.number().int().min(1).max(5) });

export const PreStep01Schema = z.object({ col1: z.string().min(1).max(100), col2: z.string().max(100).default(''), col3: z.string().max(100).default(''), col4: z.string().max(100).default('') });
export const AnswersSchema = z.object({ studySeq: z.number().int().positive(), answers: z.array(AssessmentAnswerSchema).min(1).max(200) });

export const PreAssessmentStatusSchema = z.object({
  status: z.enum(['not_started', 'needs_common_questions', 'needs_role_questions', 'profile_optional_missing', 'complete']),
  submitted: z.boolean(),
  started: z.boolean(),
  profileComplete: z.boolean(),
  col1: z.string(),
  commonAnswered: z.number().int(),
  commonRequired: z.number().int(),
  roleAnswered: z.number().int(),
  roleRequired: z.number().int(),
  answered: z.number().int(),
  required: z.number().int(),
  nextStep: z.enum(['step01', 'step02', 'step03', 'done']),
  label: z.string(),
});
export type PreAssessmentStatus = z.infer<typeof PreAssessmentStatusSchema>;

/** 사전 1단계 (prev_test01.html): Q0 직급(W 실무자 / M 관리자) + 공통·리더십 5점 문항. `grant` = 관리자 개방(grant_use=1)으로 들어온 경우. */
export const AssessmentRoleSchema = z.enum(['W', 'M']);
export const PreStep01BodySchema = z.object({ studySeq: z.number().int().positive(), role: AssessmentRoleSchema, answers: z.array(AssessmentAnswerSchema).min(1).max(200), grant: z.boolean().optional() });
/** 사전 2단계 (prev_test02.html): 선택한 직급의 직무역량 문항. */
export const PreStep02BodySchema = AnswersSchema.extend({ grant: z.boolean().optional() });
/** 사전 3단계 (prev_test03.html): Q1 직무(1개) · Q2 관심분야(최대 3) · Q3 필요역량(최대 3) — ArchiveQuestion idx (aType B · step01 · aGroup A · aBind col2/col3/col4). */
export const PreStep03BodySchema = z.object({
  studySeq: z.number().int().positive(),
  job: z.number().int().positive(),
  interests: z.array(z.number().int().positive()).min(1).max(3),
  skills: z.array(z.number().int().positive()).min(1).max(3),
  grant: z.boolean().optional(),
});
/** 사후 (post_test01/02/03.html): common = 공통·리더십, job = 직무, satisfaction = 아카이브 향상도(만족도). `final` = 마지막 화면(grantFinal=1). */
export const PostAnswersBodySchema = AnswersSchema.extend({ step: z.enum(['common', 'job', 'satisfaction']), final: z.boolean().default(false), grant: z.boolean().optional() });
/** 수강후기 수정 (public/mypage/survey_modify.html → survey_script.php mode=modify). */
export const ReviewUpdateSchema = z.object({ title: z.string().trim().min(1).max(250), contents: z.string().trim().min(1).max(10_000), starPoint: z.number().int().min(1).max(5) });
