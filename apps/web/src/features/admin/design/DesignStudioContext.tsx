import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DesignConfig, DesignValidationIssue, PublicDesign } from '@ainex/contracts';
import { designApi } from '../../../shared/api/endpoints/design';
import { fetchPublicDesign } from '../../../shared/api/endpoints/design';
import { isAppError } from '../../../shared/api/client';
import { useToast } from '../../../app/providers/ToastProvider';
import { useWriteGate } from '../GrantGate';
import { tokenIssues, validateDraft, type TokenIssue } from './designHelpers';
import { adm } from '../strings';

export type SaveState = 'idle' | 'saving' | 'conflict';

export interface DesignStudioState {
  /** Working copy (local edits). */
  draft: DesignConfig | null;
  /** Last server state. */
  server: { config: DesignConfig; updatedBy: string; updatedAt: string; baseVersion: number; issues: DesignValidationIssue[] } | null;
  live: PublicDesign | null;
  loading: boolean;
  error: unknown;
  dirty: boolean;
  canWrite: boolean;
  saveState: SaveState;
  /** Client-side issues for the working copy (HEX validity + contrast). */
  issues: TokenIssue[];
  update: (fn: (d: DesignConfig) => DesignConfig) => void;
  save: () => Promise<boolean>;
  discard: () => void;
  reload: () => Promise<void>;
  /** Replace the working copy from a server response (apply-preset, restore). */
  adopt: (config: DesignConfig, baseVersion: number) => void;
  refetchLive: () => void;
}

const Ctx = createContext<DesignStudioState | null>(null);

export function DesignStudioProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = useWriteGate();
  const draftQ = useQuery({ queryKey: ['design', 'draft'], queryFn: ({ signal }) => designApi.draft(signal), staleTime: 30_000 });
  const liveQ = useQuery({ queryKey: ['design', 'live'], queryFn: async ({ signal }) => { const r = await fetchPublicDesign(null, signal); return r.design ?? null; }, staleTime: 60_000 });
  const [draft, setDraft] = useState<DesignConfig | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const adoptedVersion = useRef<string | null>(null);

  // Adopt the server draft the first time (or after reload) — never clobber local edits silently.
  useEffect(() => {
    if (!draftQ.data) return;
    const stamp = `${draftQ.data.baseVersion}:${draftQ.data.updatedAt}`;
    if (adoptedVersion.current === stamp) return;
    if (draft === null || adoptedVersion.current === null || saveState !== 'conflict') { setDraft(draftQ.data.config); adoptedVersion.current = stamp; }
  }, [draftQ.data, draft, saveState]);

  const server = draftQ.data ?? null;
  const dirty = useMemo(() => !!draft && !!server && JSON.stringify(draft) !== JSON.stringify(server.config), [draft, server]);
  const issues = useMemo(() => (draft ? tokenIssues(draft) : []), [draft]);

  const update = useCallback((fn: (d: DesignConfig) => DesignConfig) => setDraft((d) => (d ? fn(d) : d)), []);
  const adopt = useCallback((config: DesignConfig, baseVersion: number) => {
    setDraft(config);
    adoptedVersion.current = `${baseVersion}:adopted`;
    setSaveState('idle');
    void qc.invalidateQueries({ queryKey: ['design', 'draft'] });
  }, [qc]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!draft || !server || !canWrite) return false;
    const v = validateDraft(draft);
    if (v.schemaErrors.length) { toast(`${adm.design.invalid} ${v.schemaErrors.map((e) => e.path).slice(0, 3).join(', ')}`, { tone: 'danger' }); return false; }
    setSaveState('saving');
    try {
      const res = await designApi.saveDraft(draft, server.baseVersion);
      qc.setQueryData(['design', 'draft'], res);
      adoptedVersion.current = `${res.baseVersion}:${res.updatedAt}`;
      setDraft(res.config);
      setSaveState('idle');
      toast(adm.design.actions.saved, { tone: 'ok' });
      return true;
    } catch (err) {
      if (isAppError(err) && (err.status === 409 || err.code === 'CONFLICT')) { setSaveState('conflict'); toast(adm.design.conflict, { tone: 'danger', duration: 8000 }); return false; }
      setSaveState('idle');
      if (isAppError(err) && err.code === 'WRITE_DISABLED') toast(adm.design.writeDisabled, { tone: 'danger' });
      else if (isAppError(err) && err.code === 'VALIDATION') toast(`${err.message} ${Array.isArray(err.details) ? (err.details as { path?: string }[]).map((d) => d.path).filter(Boolean).slice(0, 3).join(', ') : ''}`, { tone: 'danger', duration: 8000 });
      else toast(isAppError(err) ? err.message : adm.common.failed, { tone: 'danger' });
      return false;
    }
  }, [draft, server, canWrite, qc, toast]);

  const reload = useCallback(async () => {
    adoptedVersion.current = null;
    setSaveState('idle');
    const res = await qc.fetchQuery({ queryKey: ['design', 'draft'], queryFn: ({ signal }) => designApi.draft(signal), staleTime: 0 });
    setDraft(res.config);
    adoptedVersion.current = `${res.baseVersion}:${res.updatedAt}`;
  }, [qc]);

  const discard = useCallback(() => { if (server) { setDraft(server.config); setSaveState('idle'); } }, [server]);

  const value = useMemo<DesignStudioState>(() => ({
    draft, server, live: liveQ.data ?? null, loading: draftQ.isPending, error: draftQ.error, dirty, canWrite, saveState, issues, update, save, discard, reload, adopt, refetchLive: () => void liveQ.refetch(),
  }), [draft, server, liveQ, draftQ.isPending, draftQ.error, dirty, canWrite, saveState, issues, update, save, discard, reload, adopt]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDesignStudio(): DesignStudioState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDesignStudio must be used inside <DesignStudioProvider>');
  return ctx;
}
