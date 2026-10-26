import { z } from 'zod';
import { api } from '../client';
import { AccountSmsResultSchema, CompanyHitSchema, IdCheckSchema, OkSchema, RecomIdCheckSchema, RoutingSchema } from '../schemas';

/** POST /members/signup body (the API port of public/member/join_ok.php). */
export const SignupSchema = z.object({
  id: z.string().min(1).max(20),
  password: z.string().min(1).max(100),
  name: z.string().min(1).max(50),
  email: z.string().min(1).max(100),
  mobile: z.string().min(9).max(20),
  companyCode: z.string().max(20).optional(),
  recomId: z.string().max(50).optional(),
  consents: z.object({ mandatory: z.literal(true), sending: z.boolean(), marketingEmail: z.boolean(), marketingSms: z.boolean() }),
});
export type SignupBody = z.infer<typeof SignupSchema>;
export type AccountSmsResult = z.infer<typeof AccountSmsResultSchema>;
export type CompanyHit = z.infer<typeof CompanyHitSchema>;
export type Marketing = 'N' | 'E' | 'S' | 'Y';

/** join_ok.php / term_state_update.php: 이메일+SMS → Y, 이메일 → E, SMS → S, 없음 → N. */
export const marketingCode = (email: boolean, sms: boolean): Marketing => (email && sms ? 'Y' : email ? 'E' : sms ? 'S' : 'N');

export const membersApi = {
  signup: (body: SignupBody) => api.post<{ ok: boolean }>('/members/signup', SignupSchema.parse(body), { schema: OkSchema, auth: false }),
  idCheck: (id: string) => api.post<{ available: boolean; reason?: string }>('/members/id-check', { id }, { schema: IdCheckSchema, auth: false }),
  recomIdCheck: (recomId: string) => api.post<{ exists: boolean; message: string }>('/members/recom-id-check', { recomId }, { schema: RecomIdCheckSchema, auth: false }),
  companySearch: (q: string) => api.post<CompanyHit[]>('/members/company-search', { q }, { schema: z.array(CompanyHitSchema), auth: false }),
  findId: (body: { name: string; mobile: string }) => api.post<AccountSmsResult>('/members/find-id', body, { schema: AccountSmsResultSchema, auth: false }),
  passwordOtp: (body: { id: string; name: string; mobile: string }) => api.post<AccountSmsResult>('/members/find-password/otp', body, { schema: AccountSmsResultSchema, auth: false }),
  passwordOtpVerify: (body: { id: string; challenge: string; otp: string }) => api.post<AccountSmsResult>('/members/find-password/verify', body, { schema: AccountSmsResultSchema, auth: false }),
  /** term_state_update.php: all required items agreed; Mailling (수강확인 SMS·알림톡·메일) and Marketing (N/E/S/Y). */
  acceptTerms: (body: { sending: boolean; marketing: Marketing }) => api.post<{ ok: boolean }>('/members/me/terms', { mandatory: true, ...body }, { schema: OkSchema }),
  routing: (opts: { skipPassword?: boolean } = {}) => api.get<{ next: string; url: string }>('/members/me/routing', { schema: RoutingSchema, query: opts.skipPassword ? { skipPassword: '1' } : undefined }),
};
