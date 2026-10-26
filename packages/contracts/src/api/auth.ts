import { z } from 'zod';

export const LoginRequestSchema = z.object({
  id: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
  device: z.enum(['PC', 'MOBILE']).default('PC'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LearnerSessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  memberType: z.string(),
  eduManager: z.boolean(),
  testId: z.boolean(),
  companyCode: z.string().nullable(),
  flags: z.object({ termsPending: z.boolean(), mustChangePassword: z.boolean() }),
});
export type LearnerSession = z.infer<typeof LearnerSessionSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: LearnerSessionSchema,
  /** login_ok.php:69-88 order: terms → password → assessment-grant → pre-assessment → classroom (TestID='Y' → 나의 학습실) → home. */
  next: z.enum(['terms', 'password', 'assessment-grant', 'pre-assessment', 'classroom', 'home']),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** Y = this session is valid, N = another session is active (kick), O = expired. Same letters as PHP login_status.php. */
export const SessionStatusSchema = z.object({ status: z.enum(['Y', 'N', 'O']) });

export const AdminLoginRequestSchema = z.object({
  id: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
  secondFactor: z.string().max(10).optional(),
  role: z.enum(['admin', 'tutor']).default('admin'),
});

export const AdminSessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  dept: z.string(),
  deptIdx: z.number().int(),
  deptName: z.string().nullable(),
  topGrants: z.array(z.string()),
  subGrants: z.array(z.string()),
  canWrite: z.boolean(),
});
export type AdminSession = z.infer<typeof AdminSessionSchema>;

export const PasswordChangeSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) });
