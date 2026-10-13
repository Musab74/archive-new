import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { managerApi } from '../../shared/api/endpoints/manager';
import type { ManagerCompany } from '../../shared/api/schemas';

const KEY = 'manager.company.v1';

export interface ManagerState {
  companies: ManagerCompany[];
  loading: boolean;
  error: unknown;
  /** '' = all companies in scope. */
  companyCode: string;
  setCompanyCode: (code: string) => void;
  company: ManagerCompany | null;
  refetch: () => void;
}

const Ctx = createContext<ManagerState | null>(null);

/** Company selection shared by every manager page (persisted in sessionStorage). */
export function ManagerProvider({ children }: { children: ReactNode }) {
  const q = useQuery({ queryKey: ['manager', 'companies'], queryFn: ({ signal }) => managerApi.companies(signal), staleTime: 5 * 60_000 });
  const [companyCode, setCode] = useState<string>(() => { try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; } });
  const companies = useMemo(() => q.data ?? [], [q.data]);
  useEffect(() => { if (companyCode && companies.length && !companies.some((c) => c.companyCode === companyCode)) setCode(''); }, [companies, companyCode]);
  const setCompanyCode = useCallback((code: string) => { setCode(code); try { sessionStorage.setItem(KEY, code); } catch { /* ignore */ } }, []);
  const value = useMemo<ManagerState>(() => ({ companies, loading: q.isPending, error: q.error, companyCode, setCompanyCode, company: companies.find((c) => c.companyCode === companyCode) ?? null, refetch: () => void q.refetch() }), [companies, q, companyCode, setCompanyCode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useManager(): ManagerState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useManager must be used inside <ManagerProvider>');
  return ctx;
}
