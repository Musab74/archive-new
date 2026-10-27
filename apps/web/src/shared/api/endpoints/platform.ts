import { z } from 'zod';
import { api } from '../client';

export const PlatformInfoSchema = z.object({
  dataMode: z.enum(['production', 'copy']),
  snapshotAt: z.string().nullable(),
  notice: z.string().nullable(),
});
export type PlatformInfo = z.infer<typeof PlatformInfoSchema>;

/** GET /v1/public/platform — whether the API runs on the production database or on a one-time copy (test platform). */
export const platformApi = {
  info: (signal?: AbortSignal) => api.get<PlatformInfo>('/public/platform', { schema: PlatformInfoSchema, signal, auth: false }),
};
