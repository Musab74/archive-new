import { authApi } from '../api/endpoints/auth';
import { lastRefreshFailureCode, refreshAccessToken, toAppError } from '../api/client';

export type SessionStatus = 'Y' | 'N' | 'O';
export const SESSION_POLL_MS = 60_000;

export interface PollerHandle { stop: () => void; tick: () => Promise<void> }

/**
 * Calls GET /auth/session every 60 s while logged in (PHP: function.js LogInCheck → login_status.php, 60 s visible).
 * 'N' → another login took over (kick-out), 'O' → expired. The 15-minute access token is renewed through the refresh cookie
 * first, so a learner reading one page is not signed out before the 2-hour idle rule; only a failed refresh means 'O'
 * (or 'N' when the refresh says another session is active). Network errors are ignored (next tick retries).
 */
export function startSessionPoller(onStatus: (status: SessionStatus) => void, intervalMs = SESSION_POLL_MS): PollerHandle {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: AbortController | null = null;

  const ask = async () => {
    inFlight?.abort();
    inFlight = new AbortController();
    return (await authApi.session(inFlight.signal)).status;
  };
  const tick = async () => {
    if (stopped || document.visibilityState === 'hidden') return;
    try {
      const status = await ask();
      if (!stopped) onStatus(status);
    } catch (e) {
      if (stopped || !toAppError(e).isAuth) return;
      const renewed = await refreshAccessToken();
      // A failed refresh already marks the session lost (which stops this poller); still report why, so the kick-out /
      // expiry notice is shown.
      if (!renewed) { onStatus(lastRefreshFailureCode() === 'OTHER_SESSION' ? 'N' : 'O'); return; }
      if (stopped) return;
      try { const status = await ask(); if (!stopped) onStatus(status); } catch (e2) { if (!stopped && toAppError(e2).isAuth) onStatus('O'); }
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
