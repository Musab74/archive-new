import { useEffect } from 'react';
// Plain client call (no admin endpoint module): this hook runs in the public shells, so it must not pull the admin code into the main chunk.
import { api } from '../../../../shared/api/client';

const recordSiteVisit = () => api.post<unknown>('/visits', {});

const KEY = 'hrde_sta';
let sentThisLoad = false;

/**
 * 접속 통계 feed (old include/include_bottom.php + m/m_include/include_bottom.php): counts one visit per browser session
 * into Sta through POST /v1/visits. sessionStorage plays the role of $_SESSION['Sta'] on the client; the API also keeps
 * an httpOnly session cookie, so a cleared sessionStorage does not double count. Failures are ignored (best effort).
 * Mount once in the public (learner) app shell — not in the admin console.
 */
export function useSiteVisitCounter(enabled = true): void {
  useEffect(() => {
    if (!enabled || sentThisLoad) return;
    let seen = false;
    try { seen = window.sessionStorage.getItem(KEY) === 'Y'; } catch { /* storage blocked */ }
    if (seen) return;
    sentThisLoad = true;
    recordSiteVisit()
      .then(() => { try { window.sessionStorage.setItem(KEY, 'Y'); } catch { /* storage blocked */ } })
      .catch(() => { sentThisLoad = false; });
  }, [enabled]);
}

/** Test hook: forget the in-memory guard. */
export function resetSiteVisitCounterForTests(): void { sentThisLoad = false; }
