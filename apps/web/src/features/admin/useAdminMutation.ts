import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from '../../app/providers/ToastProvider';
import { isAppError } from '../../shared/api/client';
import { adm } from './strings';

/** Mutation with toast on success/error and query invalidation. Error message comes from the API (AppError.message). */
export function useAdminMutation<TVars, TData>(opts: { fn: (vars: TVars) => Promise<TData>; invalidate?: QueryKey[]; success?: string | ((data: TData, vars: TVars) => string); onSuccess?: (data: TData, vars: TVars) => void; onError?: (err: unknown) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: opts.fn,
    onSuccess: (data, vars) => {
      for (const key of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: key });
      const msg = typeof opts.success === 'function' ? opts.success(data, vars) : opts.success;
      if (msg) toast(msg, { tone: 'ok' });
      opts.onSuccess?.(data, vars);
    },
    onError: (err) => {
      if (opts.onError) { opts.onError(err); return; }
      toast(isAppError(err) ? `${err.message}${err.code === 'WRITE_DISABLED' || err.code === 'FORBIDDEN' ? '' : ` (${err.code})`}` : adm.common.failed, { tone: 'danger' });
    },
  });
}

export function errorMessage(err: unknown): string { return isAppError(err) ? err.message : adm.common.failed; }
