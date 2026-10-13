import type { ReactNode } from 'react';
import { useAdminSession } from '../../shared/auth/useAdminSession';
import { hasGrant } from '../../shared/auth/adminMenu';
import { StateBlock } from '../../shared/ui/StateBlock';
import { adm } from './strings';

/** Renders children only when the staff member holds the sub-menu grant (mirrors the API @Grant check). */
export function GrantGate({ grant, children }: { grant: string; children: ReactNode }) {
  const { admin } = useAdminSession();
  if (!hasGrant(admin, grant)) return <StateBlock code="NO_ACCESS" page title={adm.noGrant.title} body={adm.noGrant.body} hideActions />;
  return <>{children}</>;
}

/** Hook for pages: `const { canWrite } = useWriteGate();` → disable mutation controls. */
export function useWriteGate(): { canWrite: boolean; readOnlyTitle: string | undefined } {
  const { canWrite } = useAdminSession();
  return { canWrite, readOnlyTitle: canWrite ? undefined : adm.readOnly };
}
