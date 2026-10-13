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
