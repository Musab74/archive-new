import { z } from 'zod';
import { api } from '../client';

export interface LiveLaunch { token: string; launchUrl: string }

/**
 * Live Class SSO. There is no live/discussion listing endpoint in the API (AR-16 renders the EMPTY state);
 * the launcher issues the SSO token and the caller opens `launchUrl` in a new window.
 */
export const liveApi = {
  launch: () => api.post<LiveLaunch>('/auth/sso/live-token', undefined, { schema: z.object({ token: z.string(), launchUrl: z.string() }) }),
};
