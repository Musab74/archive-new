import type { DesignConfig } from '@ainex/contracts';
import { CSS_VAR_NAMES, DESIGN_CACHE_KEY, designToCssVars } from './tokens';

export interface CachedDesign { etag: string; config: DesignConfig }

/** Writes the design tokens on :root (and data attributes used by layout variants). */
export function applyTokens(config: DesignConfig, root: HTMLElement = document.documentElement): void {
  const vars = designToCssVars(config);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.setAttribute('data-design', 'applied');
  root.setAttribute('data-header', config.layout.headerVariant);
  root.setAttribute('data-hero', config.layout.heroVariant);
  root.setAttribute('data-footer', config.layout.footerVariant);
  root.setAttribute('data-card', config.layout.cardVariant);
}

/** Removes every runtime token so tokens.css defaults apply again. */
export function clearTokens(root: HTMLElement = document.documentElement): void {
  for (const k of CSS_VAR_NAMES) root.style.removeProperty(k);
  root.removeAttribute('data-design');
}

export function readCachedDesign(storage: Storage | undefined = safeStorage()): CachedDesign | null {
  try {
    const raw = storage?.getItem(DESIGN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDesign>;
    if (!parsed || typeof parsed.etag !== 'string' || !parsed.config || parsed.config.schemaVersion !== 1) return null;
    return parsed as CachedDesign;
  } catch {
    return null;
  }
}

export function writeCachedDesign(entry: CachedDesign, storage: Storage | undefined = safeStorage()): void {
  try { storage?.setItem(DESIGN_CACHE_KEY, JSON.stringify(entry)); } catch { /* quota / private mode */ }
}

function safeStorage(): Storage | undefined {
  try { return typeof window !== 'undefined' ? window.localStorage : undefined; } catch { return undefined; }
}
