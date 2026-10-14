import { createContext, useContext } from 'react';

/**
 * Admin console language (KO / EN). Only the /admin console is bilingual: the public site and the manager console
 * stay Korean. The choice lives in localStorage and is fixed for the page's lifetime: switching reloads the page,
 * so module-level copy (column headers, option lists, `adm`) is rebuilt in the new language without stale strings.
 */
export type AdminLang = 'ko' | 'en';

export const ADMIN_LANG_KEY = 'admin.lang';

function readStored(): AdminLang {
  try { return window.localStorage.getItem(ADMIN_LANG_KEY) === 'en' ? 'en' : 'ko'; } catch { return 'ko'; }
}

const lang: AdminLang = typeof window === 'undefined' ? 'ko' : readStored();

/** Stored admin language for this page load. */
export function getAdminLang(): AdminLang { return lang; }

/** Persist the choice and reload so every admin module re-evaluates its copy. No-op when unchanged. */
export function setAdminLang(next: AdminLang) {
  if (next === lang) return;
  try { window.localStorage.setItem(ADMIN_LANG_KEY, next); } catch { return; }
  window.location.reload();
}

/** Admin-only copy: `tr('검색', 'Search')`. Use it in /admin modules (and adminMenu) only — never in shared UI. */
export function tr(ko: string, en: string): string { return lang === 'en' ? en : ko; }

/** Provided by the /admin route root; 'ko' everywhere else, so shared components stay Korean outside the console. */
export const ConsoleLangContext = createContext<AdminLang>('ko');

/** Language for shared UI (admin kit, StateBlock, AppSelect…): the admin choice inside /admin, Korean elsewhere. */
export function useUiLang(): AdminLang { return useContext(ConsoleLangContext); }

/** `const t = useT(); t('닫기', 'Close')` — shared-component counterpart of `tr`. */
export function useT(): (ko: string, en: string) => string {
  const l = useUiLang();
  return l === 'en' ? (_ko, en) => en : (ko) => ko;
}
