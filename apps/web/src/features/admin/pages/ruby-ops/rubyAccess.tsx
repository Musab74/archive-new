import type { ReactNode } from 'react';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { adm } from '../../strings';

type Src = { dept: string; subGrants: string[] } | null | undefined;

/** include_submenu.php case "R": Ruby 관리 only for the exact sub-grant F2 or dept A (no top-menu-letter fallback, unlike hasGrant()). */
export const rubyAllowed = (a: Src) => !!a && (a.dept === 'A' || a.subGrants.includes('F2'));
/** include_top.php "모니터링(test)" / abnormal_data_dashboard.php: dept A only. */
export const deptAAllowed = (a: Src) => !!a && a.dept === 'A';

function Gate({ ok, children }: { ok: boolean; children: ReactNode }) {
  if (!ok) return <StateBlock code="NO_ACCESS" page title={adm.noGrant.title} body={adm.noGrant.body} hideActions />;
  return <>{children}</>;
}

/** Wraps a Ruby 관리 page (the API answers 403 for the same accounts — RubyF2Guard). */
export function RubyGate({ children }: { children: ReactNode }) {
  const { admin } = useAdminSession();
  return <Gate ok={rubyAllowed(admin)}>{children}</Gate>;
}

/** Wraps the IP 모니터링 page: dept A only, like the PHP page and the API. */
export function DeptAGate({ children }: { children: ReactNode }) {
  const { admin } = useAdminSession();
  return <Gate ok={deptAAllowed(admin)}>{children}</Gate>;
}
