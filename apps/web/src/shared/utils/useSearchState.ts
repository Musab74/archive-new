import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type Primitive = string | number | boolean;

/**
 * Typed URL search-param state. Types are inferred from the defaults (number → parsed, boolean → '1'/'0').
 * Values equal to their default are dropped from the URL. `set({...}, true)` resets `page` to 1 (list filters).
 */
export function useSearchState<T extends Record<string, Primitive>>(defaults: T): [T, (patch: Partial<T>, resetPage?: boolean) => void, () => void] {
  const [sp, setSp] = useSearchParams();
  const state = useMemo(() => {
    const out = { ...defaults } as Record<string, Primitive>;
    for (const [k, d] of Object.entries(defaults)) {
      const raw = sp.get(k);
      if (raw === null) continue;
      if (typeof d === 'number') { const n = Number(raw); if (!Number.isNaN(n)) out[k] = n; }
      else if (typeof d === 'boolean') out[k] = raw === '1' || raw === 'true';
      else out[k] = raw;
    }
    return out as T;
  }, [sp, defaults]);

  const set = useCallback((patch: Partial<T>, resetPage = false) => {
    const next = { ...state, ...patch } as Record<string, Primitive>;
    if (resetPage && 'page' in defaults) next.page = 1;
    const params = new URLSearchParams();
    for (const [k, d] of Object.entries(defaults)) {
      const v = next[k];
      if (v === undefined || v === d || v === '') continue;
      params.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    setSp(params);
  }, [state, defaults, setSp]);

  const reset = useCallback(() => setSp(new URLSearchParams()), [setSp]);
  return [state, set, reset];
}
