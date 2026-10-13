import { createContext, useContext } from 'react';
import type { LearnerSession, LoginRequest, LoginResponse } from '@ainex/contracts';
import type { Role } from './roles';

export type SessionPhase = 'booting' | 'guest' | 'authed';

export interface SessionState {
  phase: SessionPhase;
  user: LearnerSession | null;
  roles: Role[];
  isAuthed: boolean;
  login: (body: LoginRequest) => Promise<LoginResponse>;
  logout: (reason?: 'user' | 'idle' | 'kick' | 'expired') => Promise<void>;
  /** Re-sync from the server (after terms acceptance / password change). */
  refresh: () => Promise<boolean>;
  patchUser: (patch: Partial<LearnerSession>) => void;
}

export const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
