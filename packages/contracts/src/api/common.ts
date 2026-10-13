import { z } from 'zod';

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;

export interface Page<T> { items: T[]; page: number; size: number; total: number }

/** Error codes shared by API and web (map onto storyboard state codes). */
export const ERROR_CODES = [
  'VALIDATION', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'WRITE_DISABLED', 'OTHER_SESSION', 'SESSION_EXPIRED',
  'DORMANT', 'WITHDRAWN', 'INVALID_CREDENTIALS', 'TWO_FACTOR_REQUIRED', 'TWO_FACTOR_MISMATCH', 'LOCK_BUSY', 'UNSUPPORTED_CHARS',
  'PRE_ASSESSMENT_REQUIRED', 'IDENTITY_REQUIRED', 'PLAYLOCK', 'DAILY_CAP', 'PERIOD_EXPIRED', 'NO_ACCESS', 'TENANT_NOT_FOUND', 'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
