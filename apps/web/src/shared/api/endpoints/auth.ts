import { LoginResponseSchema, LearnerSessionSchema, SessionStatusSchema, type LoginRequest, type LoginResponse, type LearnerSession } from '@ainex/contracts';
import { z } from 'zod';
import { api } from '../client';
import { OkSchema } from '../schemas';

export const authApi = {
  login: (body: LoginRequest) => api.post<LoginResponse>('/auth/login', body, { schema: LoginResponseSchema, noRefresh: true, auth: false }),
  /**
   * member/logout.php. Not `noRefresh`: with an expired 15-minute access token the API answers 401 and would neither delete the
   * LoginIng row nor clear the refresh cookie — the learner would still be signed in on the next page load. The client renews the
   * token through the cookie and repeats the logout (a lost session simply fails the renewal).
   */
  logout: () => api.post<{ ok: boolean }>('/auth/logout', undefined, { schema: OkSchema }),
  session: (signal?: AbortSignal) => api.get<{ status: 'Y' | 'N' | 'O' }>('/auth/session', { schema: SessionStatusSchema, noRefresh: true, signal }),
  me: () => api.get<LearnerSession>('/auth/me', { schema: LearnerSessionSchema.omit({ flags: true }).extend({ flags: LearnerSessionSchema.shape.flags.optional() }) as z.ZodType<LearnerSession, z.ZodTypeDef, unknown> }),
  changePassword: (body: { currentPassword: string; newPassword: string }) => api.post<{ ok: boolean }>('/auth/password/change', body, { schema: OkSchema }),
  liveToken: () => api.post<{ token: string; launchUrl: string }>('/auth/sso/live-token', undefined, { schema: z.object({ token: z.string(), launchUrl: z.string() }) }),
};
