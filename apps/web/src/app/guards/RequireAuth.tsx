import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../shared/auth/useSession';
import { Skeleton } from '../../shared/ui/Skeleton';

/** Redirects guests to /auth/login?next=<current>. Renders a skeleton while the session boots. */
export function RequireAuth() {
  const { phase, isAuthed } = useSession();
  const location = useLocation();
  if (phase === 'booting') return <div className="section" aria-busy="true"><Skeleton lines={4} /></div>;
  if (!isAuthed) return <Navigate to={`/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}
