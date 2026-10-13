import { authApi } from '../api/endpoints/auth';
import { toAppError } from '../api/client';

export type SessionStatus = 'Y' | 'N' | 'O';
export const SESSION_POLL_MS = 60_000;

export interface PollerHandle { stop: () => void; tick: () => Promise<void> }

/**
 * Calls GET /auth/session every 60 s while logged in.
 * 'N' → another login took over (kick-out), 'O' → expired. Network errors are ignored (next tick retries).
 */
export function startSessionPoller(onStatus: (status: SessionStatus) => void, intervalMs = SESSION_POLL_MS): PollerHandle {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: AbortController | null = null;

  const tick = async () => {
    if (stopped || document.visibilityState === 'hidden') return;
    inFlight?.abort();
    inFlight = new AbortController();
    try {
      const { status } = await authApi.session(inFlight.signal);
      if (!stopped) onStatus(status);
    } catch (e) {
      const err = toAppError(e);
      if (!stopped && err.isAuth) onStatus('O');
    }
  };

  timer = setInterval(() => { void tick(); }, intervalMs);
  const onVisible = () => { if (document.visibilityState === 'visible') void tick(); };
  document.addEventListener('visibilitychange', onVisible);

  return {
    tick,
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
      inFlight?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    },
  };
}
