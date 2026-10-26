import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { managerApi, type ManagerCompany } from '../../shared/api/endpoints/manager';

const KEY = 'manager.company.v1';

export interface ManagerState {
  companies: ManagerCompany[];
  loading: boolean;
  error: unknown;
  /** '' = 사업장 전체 (every company in scope). */
  companyCode: string;
  setCompanyCode: (code: string) => void;
  company: ManagerCompany | null;
  /** The PHP shows the 사업장 select only when the manager has more than one company. */
  multiCompany: boolean;
  refetch: () => void;
}

const Ctx = createContext<ManagerState | null>(null);

/** Company selection shared by every manager page (persisted in sessionStorage; reset when outside the scope). */
export function ManagerProvider({ children }: { children: ReactNode }) {
  const q = useQuery({ queryKey: ['manager', 'companies'], queryFn: ({ signal }) => managerApi.companies(signal), staleTime: 5 * 60_000, retry: false });
  const [companyCode, setCode] = useState<string>(() => { try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; } });
  const companies = useMemo(() => q.data ?? [], [q.data]);
  useEffect(() => { if (companyCode && q.isSuccess && !companies.some((c) => c.companyCode === companyCode)) setCode(''); }, [companies, companyCode, q.isSuccess]);
  const setCompanyCode = useCallback((code: string) => { setCode(code); try { sessionStorage.setItem(KEY, code); } catch { /* ignore */ } }, []);
  const value = useMemo<ManagerState>(() => ({
    companies, loading: q.isPending, error: q.error, companyCode, setCompanyCode, company: companies.find((c) => c.companyCode === companyCode) ?? null,
    multiCompany: companies.length > 1, refetch: () => void q.refetch(),
  }), [companies, q, companyCode, setCompanyCode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useManager(): ManagerState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useManager must be used inside <ManagerProvider>');
  return ctx;
}
