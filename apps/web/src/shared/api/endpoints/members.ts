import { z } from 'zod';
import { api } from '../client';
import { FindIdResultSchema, PasswordResetResultSchema, IdCheckSchema, OkSchema } from '../schemas';

export const SignupSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_]{5,20}$/),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(50),
  phone: z.string().min(9).max(20),
  email: z.string().email().max(100),
  company: z.string().max(100).default(''),
  agreeTerms: z.literal(true),
  agreePrivacy: z.literal(true),
  agreeMarketing: z.boolean().default(false),
});
export type SignupBody = z.infer<typeof SignupSchema>;

export const membersApi = {
  signup: (body: SignupBody) => api.post<{ ok: boolean }>('/members/signup', SignupSchema.parse(body), { schema: OkSchema, auth: false }),
  idCheck: (id: string) => api.post<{ available: boolean }>('/members/id-check', { id }, { schema: IdCheckSchema, auth: false }),
  findId: (body: { name: string; email: string }) => api.post<{ ids: { id: string; regDate?: string | null }[] }>('/members/find-id', body, { schema: FindIdResultSchema, auth: false }),
  passwordReset: (body: { id: string; name: string; email: string }) => api.post<{ sent: boolean; tempPassword?: string }>('/members/password-reset', body, { schema: PasswordResetResultSchema, auth: false }),
  acceptTerms: (body: { terms: true; privacy: true; marketing: boolean }) => api.post<{ ok: boolean }>('/members/me/terms', { mandatory: true, sending: true, marketing: body.marketing ? 'Y' : 'N' }, { schema: OkSchema }),
};
