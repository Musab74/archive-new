import type { ReactNode } from 'react';
import { useAdminSession } from '../../../../shared/auth/useAdminSession';
import { hasGrant, type AdminGrantSource } from '../../../../shared/auth/adminMenu';
import { StateBlock } from '../../../../shared/ui/StateBlock';
import { adm } from '../../strings';

/**
 * Old sub-menu codes of the 컨텐츠관리 / 아카이브 screens (hrd_manager/include/include_submenu.php), mirroring the API
 * @Grant of AdminCoursesController. hasGrant() keeps the AdminGuard rule (sub-menu code, or its top-menu letter).
 */
export const G = {
  categories: ['D1'],
  contents: ['D2'],
  packages: ['D6'],
  courses: ['E1', 'E2', 'E3'],
  lists: ['E5'],
} as const;
/** course.php?ctype=X → E1 (이러닝), Z → E2 (마이크로닝), Y → E3 (숏폼). */
export const CTYPE_GRANT: Record<string, string> = { X: 'E1', Z: 'E2', Y: 'E3' };

export const hasAnyGrant = (src: AdminGrantSource | null | undefined, codes: readonly string[]) => codes.some((c) => hasGrant(src, c));
/** Grant(s) of a course.php list / form for a ctype; ctypes without an own code (W, R) accept any of E1..E3. */
export const ctypeGrants = (ctype: string | null | undefined): readonly string[] => { const c = CTYPE_GRANT[ctype || 'X']; return c ? [c] : G.courses; };
/** Grant(s) of one Course row: a package belongs to 패키지컨텐츠관리 (D6), anything else to its ctype screen. */
export const courseRowGrants = (isPackage: boolean, ctype: string | null | undefined) => (isPackage ? G.packages : ctypeGrants(ctype));

/** Renders children only when the staff member holds one of the grants (else the same NO_ACCESS block as GrantGate). */
export function AnyGrantGate({ grants, children }: { grants: readonly string[]; children: ReactNode }) {
  const { admin } = useAdminSession();
  if (!hasAnyGrant(admin, grants)) return <StateBlock code="NO_ACCESS" page title={adm.noGrant.title} body={adm.noGrant.body} hideActions />;
  return <>{children}</>;
}
