import { createContext, useContext } from 'react';
import type { AdminSession } from '@ainex/contracts';

export type AdminPhase = 'booting' | 'guest' | 'authed';

export interface AdminSessionState {
  phase: AdminPhase;
  admin: AdminSession | null;
  isAuthed: boolean;
  /** false for 영업(B) accounts: every mutation control must be disabled. */
  canWrite: boolean;
  /** Seconds until the access token expires (null while unknown). Refreshed transparently on API 401. */
  secondsLeft: number | null;
  login: (body: { id: string; password: string; secondFactor?: string }) => Promise<AdminSession>;
  logout: (reason?: 'user' | 'expired') => Promise<void>;
  /** Force an access-token refresh (extends the countdown). */
  extend: () => Promise<boolean>;
}

export const AdminSessionContext = createContext<AdminSessionState | null>(null);

export function useAdminSession(): AdminSessionState {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used inside <AdminSessionProvider>');
  return ctx;
}

/** Null-safe variant for components rendered outside the admin tree (e.g. shared layouts). */
export function useOptionalAdminSession(): AdminSessionState | null { return useContext(AdminSessionContext); }
