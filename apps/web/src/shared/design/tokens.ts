import type { DesignConfig } from '@ainex/contracts';

export const DESIGN_CACHE_KEY = 'design.v1';

const KO_FALLBACK = '"Noto Sans KR","Malgun Gothic",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

/** Font family → CSS font stack (Pretendard first, Korean system fonts as fallback). */
export function fontStack(name: string): string {
  if (name === 'system-ui') return 'system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans KR","Malgun Gothic",sans-serif';
  return `"${name}",${KO_FALLBACK}`;
}

export type CssVarMap = Record<string, string>;

/**
 * DesignConfig → CSS custom properties written on :root.
 * public/boot.js carries an identical mapping for the pre-bundle (no-FOUC) pass; keep both in sync.
 */
export function designToCssVars(config: DesignConfig): CssVarMap {
  const t = config.theme;
  const ty = config.typography;
  const l = config.layout;
  return {
    '--c-primary': t.primary,
    '--c-primary-deep': t.primaryDeep,
    '--c-accent': t.accent,
    '--c-accent-warm': t.accentWarm,
    '--c-ink': t.ink,
    '--c-text': t.text,
    '--c-muted': t.muted,
    '--c-line': t.line,
    '--c-line-2': t.lineSoft,
    '--c-soft': t.surfaceSoft,
    '--c-paper': t.surface,
    '--c-bg': t.background,
    '--c-heading-band': t.headingBand,
    '--c-ok': t.success,
    '--c-warn': t.warning,
    '--c-danger': t.danger,
    '--c-band-ink': t.bandDarkInk,
    '--c-band-text': t.bandDarkText,
    '--g-hero': t.gradientHero,
    '--g-brand': t.gradientBrand,
    '--g-band-dark': t.bandDark,
    '--g-band-graphite': t.bandGraphite,
    '--font-sans': fontStack(ty.fontFamily),
    '--font-heading': fontStack(ty.headingFont),
    '--fs-base': `${ty.baseFontSize}px`,
    '--lh-body': String(ty.lineHeight),
    '--ls-body': `${ty.letterSpacing}em`,
    '--heading-scale': String(ty.headingScale),
    '--fw-regular': String(ty.weights.regular),
    '--fw-semibold': String(ty.weights.semibold),
    '--fw-bold': String(ty.weights.bold),
    '--fw-black': String(ty.weights.black),
    '--r-sm': `${l.radius.sm}px`,
    '--r-md': `${l.radius.md}px`,
    '--r-lg': `${l.radius.lg}px`,
    '--r-pill': '999px',
    '--container': `${l.container}px`,
  };
}

export const CSS_VAR_NAMES = Object.keys(designToCssVars({
  schemaVersion: 1, presetId: '', links: { axisUrl: '', liveClassUrl: '', kakaoUrl: '' },
  branding: { siteName: 'x', tagline: '', logoAssetId: null, faviconAssetId: null, heroAssetId: null, logoAlt: '' },
  theme: { primary: '#000000', primaryDeep: '#000000', accent: '#000000', accentWarm: '#000000', ink: '#000000', text: '#000000', muted: '#000000', line: '#000000', lineSoft: '#000000', surfaceSoft: '#000000', surface: '#000000', background: '#000000', headingBand: '#000000', success: '#000000', warning: '#000000', danger: '#000000', bandDarkInk: '#000000', bandDarkText: '#000000', gradientHero: '', gradientBrand: '', bandDark: '', bandGraphite: '' },
  typography: { fontFamily: 'Pretendard', headingFont: 'Pretendard', baseFontSize: 15, headingScale: 1.2, lineHeight: 1.75, letterSpacing: 0, weights: { regular: 400, semibold: 600, bold: 700, black: 800 } },
  layout: { headerVariant: 'standard', heroVariant: 'split', footerVariant: 'columns', cardVariant: 'elevated', radius: { sm: 4, md: 10, lg: 20 }, container: 1200, homeSections: [] },
}));
