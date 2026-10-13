import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_DESIGN, DesignConfigSchema, CompanyInfoSchema, type CompanyInfo, type DesignConfig, type PublicDesign } from '@ainex/contracts';
import { DesignContext, type DesignState } from '../../shared/design/useDesign';
import { applyTokens, readCachedDesign, writeCachedDesign } from '../../shared/design/applyTokens';
import { fetchDesignPreview, fetchPublicDesign } from '../../shared/api/endpoints/design';
import { common } from '../../shared/strings/ko';

const COMPANY_CACHE_KEY = 'design.company.v1';
const defaultCompany: CompanyInfo = CompanyInfoSchema.parse({});

interface Snapshot { config: DesignConfig; company: CompanyInfo; assets: Record<string, string>; etag: string | null; source: DesignState['source'] }

function readCompanyCache(): { company: CompanyInfo; assets: Record<string, string> } {
  try {
    const raw = localStorage.getItem(COMPANY_CACHE_KEY);
    if (!raw) return { company: defaultCompany, assets: {} };
    const parsed = JSON.parse(raw) as { company?: unknown; assets?: Record<string, string> };
    return { company: CompanyInfoSchema.parse(parsed.company ?? {}), assets: parsed.assets ?? {} };
  } catch { return { company: defaultCompany, assets: {} }; }
}

function initialSnapshot(): Snapshot {
  const cached = readCachedDesign();
  const extra = readCompanyCache();
  if (cached) {
    const parsed = DesignConfigSchema.safeParse(cached.config);
    if (parsed.success) return { config: parsed.data, company: extra.company, assets: extra.assets, etag: cached.etag, source: 'cached' };
  }
  return { config: DEFAULT_DESIGN, company: extra.company, assets: extra.assets, etag: null, source: 'default' };
}

function previewTokenFromUrl(): string | null {
  try { return new URLSearchParams(window.location.search).get('designPreview'); } catch { return null; }
}

/**
 * Loads the published design (GET /public/design with If-None-Match), applies tokens on :root,
 * caches {etag, config} in localStorage "design.v1" (boot.js reads it before the bundle), and falls back to
 * DEFAULT_DESIGN while offline. Supports ?designPreview=<token> and postMessage({type:'design:preview', config})
 * from a same-origin parent (admin preview iframe).
 */
export function DesignProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(initialSnapshot);
  const [preview, setPreview] = useState<boolean>(() => !!previewTokenFromUrl());
  const etagRef = useRef(snap.etag);
  const previewLocked = useRef(false);

  useEffect(() => { applyTokens(snap.config); }, [snap.config]);

  const adopt = useCallback((design: PublicDesign, source: DesignState['source']) => {
    if (!DesignConfigSchema.safeParse(design?.config).success) return; // never adopt a malformed payload
    etagRef.current = design.etag;
    setSnap({ config: design.config, company: design.company, assets: design.assets, etag: design.etag, source });
    if (source === 'live') {
      writeCachedDesign({ etag: design.etag, config: design.config });
      try { localStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify({ company: design.company, assets: design.assets })); } catch { /* ignore */ }
    }
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = previewTokenFromUrl();
    if (token) {
      try { adopt(await fetchDesignPreview(token, signal), 'preview'); setPreview(true); previewLocked.current = true; } catch { /* keep current */ }
      return;
    }
    try {
      const res = await fetchPublicDesign(etagRef.current, signal);
      if (res.status === 'modified' && res.design) adopt({ ...res.design, etag: res.etag ?? res.design.etag }, 'live');
      else setSnap((s) => (s.source === 'cached' ? { ...s, source: 'live' } : s));
    } catch {
      /* API unreachable → keep cached config or DEFAULT_DESIGN */
    }
  }, [adopt]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  // Admin preview iframe: parent posts {type:'design:preview', config, company?, assets?}
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; config?: unknown; company?: unknown; assets?: Record<string, string> } | null;
      if (!data || data.type !== 'design:preview') return;
      const parsed = DesignConfigSchema.safeParse(data.config);
      if (!parsed.success) return;
      const company = CompanyInfoSchema.safeParse(data.company ?? {});
      previewLocked.current = true;
      setPreview(true);
      setSnap((s) => ({ config: parsed.data, company: company.success ? company.data : s.company, assets: data.assets ?? s.assets, etag: s.etag, source: 'preview' }));
    };
    window.addEventListener('message', onMessage);
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: 'design:ready' }, window.location.origin); } catch { /* ignore */ }
    }
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const value = useMemo<DesignState>(() => ({ ...snap, preview, reload: () => { if (!previewLocked.current) void load(); } }), [snap, preview, load]);

  return (
    <DesignContext.Provider value={value}>
      {preview ? <div className="ribbon-preview" role="status">{common.preview} · {common.designPreview}</div> : null}
      {children}
    </DesignContext.Provider>
  );
}
