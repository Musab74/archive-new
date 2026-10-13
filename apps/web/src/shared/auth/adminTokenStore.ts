/**
 * In-memory access token for the staff (admin) session — separate from the learner tokenStore because a
 * staff member may also be logged in as a learner in the same browser. The admin refresh token is an httpOnly
 * cookie scoped to /v1/auth/admin.
 */
let accessToken: string | null = null;
let expiresAt = 0;
const listeners = new Set<(token: string | null) => void>();

export const adminTokenStore = {
  get(): string | null { return accessToken; },
  set(token: string | null, expiresInSec?: number): void {
    accessToken = token;
    expiresAt = token && expiresInSec ? Date.now() + expiresInSec * 1000 : 0;
    listeners.forEach((l) => l(token));
  },
  clear(): void { this.set(null); },
  /** Epoch ms when the access token expires (0 when unknown). */
  expiresAt(): number { return expiresAt; },
  /** Seconds left before the access token expires (null when unknown). */
  secondsLeft(): number | null { return expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : null; },
  subscribe(fn: (token: string | null) => void): () => void { listeners.add(fn); return () => listeners.delete(fn); },
};
