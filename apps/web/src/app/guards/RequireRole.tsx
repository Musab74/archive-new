import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../shared/auth/useSession';
import type { Role } from '../../shared/auth/roles';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StateBlock } from '../../shared/ui/StateBlock';

/** Requires one of `roles`; guests go to login, authed users without the role see NO_ACCESS. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { phase, isAuthed, roles: mine } = useSession();
  const location = useLocation();
  if (phase === 'booting') return <div className="section" aria-busy="true"><Skeleton lines={4} /></div>;
  if (!isAuthed) return <Navigate to={`/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!roles.some((r) => mine.includes(r))) return <StateBlock code="NO_ACCESS" page />;
  return <Outlet />;
}
