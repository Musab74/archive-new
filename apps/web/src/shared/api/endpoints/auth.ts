import { LoginResponseSchema, LearnerSessionSchema, SessionStatusSchema, type LoginRequest, type LoginResponse, type LearnerSession } from '@ainex/contracts';
import { z } from 'zod';
import { api } from '../client';
import { OkSchema } from '../schemas';

export const authApi = {
  login: (body: LoginRequest) => api.post<LoginResponse>('/auth/login', body, { schema: LoginResponseSchema, noRefresh: true, auth: false }),
  logout: () => api.post<{ ok: boolean }>('/auth/logout', undefined, { schema: OkSchema, noRefresh: true }),
  session: (signal?: AbortSignal) => api.get<{ status: 'Y' | 'N' | 'O' }>('/auth/session', { schema: SessionStatusSchema, noRefresh: true, signal }),
  me: () => api.get<LearnerSession>('/auth/me', { schema: LearnerSessionSchema.omit({ flags: true }).extend({ flags: LearnerSessionSchema.shape.flags.optional() }) as z.ZodType<LearnerSession, z.ZodTypeDef, unknown> }),
  changePassword: (body: { currentPassword: string; newPassword: string }) => api.post<{ ok: boolean }>('/auth/password/change', body, { schema: OkSchema }),
  liveToken: () => api.post<{ token: string; launchUrl: string }>('/auth/sso/live-token', undefined, { schema: z.object({ token: z.string(), launchUrl: z.string() }) }),
};
