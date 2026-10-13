export const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 h without activity → logout
export const IDLE_WARN_MS = 115 * 60 * 1000; // warning at 115 min

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

export interface IdleTimerHandle { stop: () => void; reset: () => void }

/**
 * Tracks user activity; fires onWarn at 115 min idle and onTimeout at 120 min.
 * The clock restarts on any activity event (throttled to once per second) and on reset().
 */
export function startIdleTimer(opts: { onWarn: () => void; onTimeout: () => void; warnAfterMs?: number; timeoutAfterMs?: number }): IdleTimerHandle {
  const warnAfter = opts.warnAfterMs ?? IDLE_WARN_MS;
  const timeoutAfter = opts.timeoutAfterMs ?? IDLE_LIMIT_MS;
  let warnTimer: ReturnType<typeof setTimeout> | null = null;
  let outTimer: ReturnType<typeof setTimeout> | null = null;
  let lastReset = 0;
  let stopped = false;

  const clear = () => { if (warnTimer) clearTimeout(warnTimer); if (outTimer) clearTimeout(outTimer); warnTimer = outTimer = null; };
  const arm = () => {
    clear();
    warnTimer = setTimeout(() => { if (!stopped) opts.onWarn(); }, warnAfter);
    outTimer = setTimeout(() => { if (!stopped) opts.onTimeout(); }, timeoutAfter);
  };
  const onActivity = () => {
    const now = Date.now();
    if (now - lastReset < 1000) return;
    lastReset = now;
    arm();
  };
  ACTIVITY_EVENTS.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true }));
  arm();
  return {
    reset: () => { lastReset = Date.now(); arm(); },
    stop: () => { stopped = true; clear(); ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, onActivity)); },
  };
}
