import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LearnerSession, LoginRequest, LoginResponse } from '@ainex/contracts';
import { SessionContext, type SessionPhase, type SessionState } from '../../shared/auth/useSession';
import { tokenStore } from '../../shared/auth/tokenStore';
import { rolesOf } from '../../shared/auth/roles';
import { authApi } from '../../shared/api/endpoints/auth';
import { refreshAccessToken, registerSessionHooks } from '../../shared/api/client';
import { startSessionPoller } from '../../shared/auth/sessionPoller';
import { startIdleTimer } from '../../shared/auth/idleTimer';
import { Modal } from '../../shared/ui/Modal';
import { Button } from '../../shared/ui/Button';
import { auth as copy } from '../../shared/strings/ko';
import { useToast } from './ToastProvider';

type Interrupt = null | 'idle-warn' | 'idle-logout' | 'kick' | 'expired';

/**
 * Holds the learner session (access token in memory, refresh cookie on the API origin).
 * - boot: silent POST /auth/refresh to restore a session
 * - GET /auth/session every 60 s while logged in ('N' → kick-out modal + logout, 'O' → expired)
 * - 2 h idle timer with a warning at 115 min
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SessionPhase>('booting');
  const [user, setUser] = useState<LearnerSession | null>(null);
  const [interrupt, setInterrupt] = useState<Interrupt>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const idleRef = useRef<ReturnType<typeof startIdleTimer> | null>(null);

  const clearLocal = useCallback(() => { tokenStore.clear(); setUser(null); setPhase('guest'); }, []);

  const logout = useCallback(async (reason: 'user' | 'idle' | 'kick' | 'expired' = 'user') => {
    try { if (tokenStore.get()) await authApi.logout(); } catch { /* cookie may already be gone */ }
    clearLocal();
    if (reason === 'user') { toast(copy.session.logoutDone, { tone: 'ok' }); navigate('/'); }
    if (reason === 'idle') setInterrupt('idle-logout');
    if (reason === 'kick') setInterrupt('kick');
    if (reason === 'expired') setInterrupt('expired');
  }, [clearLocal, navigate, toast]);

  // Boot: try the refresh cookie once.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await refreshAccessToken();
      if (!alive) return;
      if (ok) { try { const me = await authApi.me(); if (alive) { setUser(me); setPhase('authed'); return; } } catch { /* fallthrough */ } }
      if (alive) setPhase(ok ? 'authed' : 'guest');
    })();
    return () => { alive = false; };
  }, []);

  // Transparent refresh from the API client keeps user state in sync.
  useEffect(() => registerSessionHooks({
    restored: (payload) => { const p = payload as Partial<LoginResponse>; if (p.user) { setUser(p.user); setPhase('authed'); } },
    lost: () => { setUser(null); setPhase((ph) => (ph === 'authed' ? 'guest' : ph)); },
  }), []);

  // Session poller + idle timer while authenticated.
  useEffect(() => {
    if (phase !== 'authed') return;
    const poller = startSessionPoller((status) => {
      if (status === 'N') void logout('kick');
      else if (status === 'O') void logout('expired');
    });
    idleRef.current = startIdleTimer({
      onWarn: () => setInterrupt((cur) => (cur ? cur : 'idle-warn')),
      onTimeout: () => { setInterrupt(null); void logout('idle'); },
    });
    return () => { poller.stop(); idleRef.current?.stop(); idleRef.current = null; };
  }, [phase, logout]);

  const login = useCallback(async (body: LoginRequest) => {
    const res = await authApi.login(body);
    tokenStore.set(res.accessToken, res.expiresIn);
    setUser(res.user);
    setPhase('authed');
    setInterrupt(null);
    return res;
  }, []);

  const refresh = useCallback(async () => {
    const ok = await refreshAccessToken();
    if (ok) { try { setUser(await authApi.me()); setPhase('authed'); } catch { /* keep */ } }
    return ok;
  }, []);

  const patchUser = useCallback((patch: Partial<LearnerSession>) => setUser((u) => (u ? { ...u, ...patch, flags: { ...u.flags, ...(patch.flags ?? {}) } } : u)), []);

  const value = useMemo<SessionState>(() => ({ phase, user, roles: rolesOf(user), isAuthed: phase === 'authed' && !!user, login, logout, refresh, patchUser }), [phase, user, login, logout, refresh, patchUser]);

  const goLogin = () => { setInterrupt(null); navigate(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); };

  return (
    <SessionContext.Provider value={value}>
      {children}
      <Modal open={interrupt === 'idle-warn'} onClose={() => { idleRef.current?.reset(); setInterrupt(null); }} title={copy.session.idleTitle} symbol="clock" dismissible={false}
        actions={<><Button variant="secondary" onClick={() => void logout('user')}>{copy.session.relogin.replace('다시 로그인', '로그아웃')}</Button><Button onClick={() => { idleRef.current?.reset(); setInterrupt(null); }}>{copy.session.idleContinue}</Button></>}>
        {copy.session.idleBody}
      </Modal>
      <Modal open={interrupt === 'idle-logout'} onClose={() => setInterrupt(null)} title={copy.session.idleLogoutTitle} symbol="clock" dismissible={false}
        actions={<><Button variant="secondary" onClick={() => { setInterrupt(null); navigate('/'); }}>{copy.login.helpLink}</Button><Button onClick={goLogin}>{copy.session.relogin}</Button></>}>
        {copy.session.idleLogoutBody}
      </Modal>
      <Modal open={interrupt === 'kick'} onClose={() => setInterrupt(null)} title={copy.session.kickTitle} symbol="alert" symbolTone="warn" dismissible={false}
        actions={<><Button variant="secondary" onClick={() => { setInterrupt(null); navigate('/support/guide'); }}>{copy.login.helpLink}</Button><Button onClick={goLogin}>{copy.session.relogin}</Button></>}>
        {copy.session.kickBody}
      </Modal>
      <Modal open={interrupt === 'expired'} onClose={() => setInterrupt(null)} title={copy.session.expiredTitle} symbol="clock" dismissible={false}
        actions={<><Button variant="secondary" onClick={() => { setInterrupt(null); navigate('/'); }}>{copy.login.helpLink}</Button><Button onClick={goLogin}>{copy.session.relogin}</Button></>}>
        {copy.session.expiredBody}
      </Modal>
    </SessionContext.Provider>
  );
}
