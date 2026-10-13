import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminSession } from '../../shared/auth/useAdminSession';
import { Skeleton } from '../../shared/ui/Skeleton';

/** Staff-only subtree: guests go to /admin/login?next=<current>. Renders a skeleton while the admin session boots. */
export function RequireAdmin() {
  const { phase, isAuthed } = useAdminSession();
  const location = useLocation();
  if (phase === 'booting') return <div className="section" aria-busy="true"><Skeleton lines={4} /></div>;
  if (!isAuthed) return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}
