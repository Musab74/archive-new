/** In-memory access token (never persisted). The refresh token lives in an httpOnly cookie. */
let accessToken: string | null = null;
let expiresAt = 0;
const listeners = new Set<(token: string | null) => void>();

export const tokenStore = {
  get(): string | null { return accessToken; },
  set(token: string | null, expiresInSec?: number): void {
    accessToken = token;
    expiresAt = token && expiresInSec ? Date.now() + expiresInSec * 1000 : 0;
    listeners.forEach((l) => l(token));
  },
  clear(): void { this.set(null); },
  /** True when a token exists and (if known) has not passed its expiry minus a 15 s skew. */
  isFresh(): boolean { return !!accessToken && (expiresAt === 0 || Date.now() < expiresAt - 15_000); },
  subscribe(fn: (token: string | null) => void): () => void { listeners.add(fn); return () => listeners.delete(fn); },
};
