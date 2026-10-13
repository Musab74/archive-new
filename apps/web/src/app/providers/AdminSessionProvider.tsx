import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminSession } from '@ainex/contracts';
import { AdminSessionContext, type AdminPhase, type AdminSessionState } from '../../shared/auth/useAdminSession';
import { adminTokenStore } from '../../shared/auth/adminTokenStore';
import { adminAuthApi } from '../../shared/api/endpoints/admin';
import { refreshAdminAccessToken, registerAdminSessionHooks } from '../../shared/api/client';

/**
 * Staff (관리자) session — independent from the learner SessionProvider so one browser can hold both.
 * - boot: silent POST /auth/admin/refresh (cookie `ainex_art`, path /v1/auth/admin)
 * - the API client refreshes transparently on 401 for /admin, /design and /auth/admin calls
 * - secondsLeft counts down to the access-token expiry (자동 로그아웃); at 0 a refresh is attempted, failure → guest
 */
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AdminPhase>('booting');
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(adminTokenStore.secondsLeft());

  const clearLocal = useCallback(() => { adminTokenStore.clear(); setAdmin(null); setPhase('guest'); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await refreshAdminAccessToken();
      if (!alive) return;
      if (ok && !admin) {
        try { const me = await adminAuthApi.me(); if (alive) { setAdmin(me); setPhase('authed'); return; } } catch { /* fallthrough */ }
      }
      if (alive) setPhase((p) => (p === 'authed' ? p : ok ? 'authed' : 'guest'));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => registerAdminSessionHooks({
    restored: (payload) => { const p = payload as { admin?: AdminSession }; if (p.admin) { setAdmin(p.admin); setPhase('authed'); } },
    lost: () => { setAdmin(null); setPhase((ph) => (ph === 'authed' ? 'guest' : ph)); },
  }), []);

  // Countdown ticker (1 s) while authenticated; auto-refresh at expiry, logout on failure.
  useEffect(() => {
    if (phase !== 'authed') { setSecondsLeft(null); return; }
    let refreshing = false;
    const tick = async () => {
      const left = adminTokenStore.secondsLeft();
      setSecondsLeft(left);
      if (left !== null && left <= 0 && !refreshing) {
        refreshing = true;
        const ok = await refreshAdminAccessToken();
        refreshing = false;
        if (!ok) clearLocal();
      }
    };
    void tick();
    const id = setInterval(() => { void tick(); }, 1000);
    const unsub = adminTokenStore.subscribe(() => setSecondsLeft(adminTokenStore.secondsLeft()));
    return () => { clearInterval(id); unsub(); };
  }, [phase, clearLocal]);

  const login = useCallback<AdminSessionState['login']>(async (body) => {
    const res = await adminAuthApi.login(body);
    adminTokenStore.set(res.accessToken, res.expiresIn);
    setAdmin(res.admin);
    setPhase('authed');
    return res.admin;
  }, []);

  const logout = useCallback<AdminSessionState['logout']>(async () => {
    try { if (adminTokenStore.get()) await adminAuthApi.logout(); } catch { /* cookie may already be gone */ }
    clearLocal();
  }, [clearLocal]);

  const extend = useCallback(async () => {
    const ok = await refreshAdminAccessToken();
    if (!ok) clearLocal();
    return ok;
  }, [clearLocal]);

  const value = useMemo<AdminSessionState>(() => ({
    phase, admin, isAuthed: phase === 'authed' && !!admin, canWrite: !!admin?.canWrite, secondsLeft, login, logout, extend,
  }), [phase, admin, secondsLeft, login, logout, extend]);

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}
