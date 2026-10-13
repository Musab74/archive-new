import { createContext, useContext } from 'react';
import type { CompanyInfo, DesignConfig } from '@ainex/contracts';

export interface DesignState {
  config: DesignConfig;
  company: CompanyInfo;
  assets: Record<string, string>;
  etag: string | null;
  /** 'default' = DEFAULT_DESIGN fallback, 'cached' = localStorage, 'live' = GET /public/design, 'preview' = admin preview. */
  source: 'default' | 'cached' | 'live' | 'preview';
  preview: boolean;
  reload: () => void;
}

export const DesignContext = createContext<DesignState | null>(null);

export function useDesign(): DesignState {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesign must be used inside <DesignProvider>');
  return ctx;
}

/** Resolves an asset id from the design config to a public URL. */
export function useAssetUrl(assetId: string | null | undefined): string | null {
  const { assets } = useDesign();
  if (!assetId) return null;
  return assets[assetId] ?? null;
}
