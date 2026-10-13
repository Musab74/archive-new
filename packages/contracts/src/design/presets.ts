import type { DesignConfig, ThemeTokens } from './schema';

const storyboardTheme: ThemeTokens = {
  primary: '#4873b8',
  primaryDeep: '#153f73',
  accent: '#56bdb6',
  accentWarm: '#e25a4b',
  ink: '#101828',
  text: '#344054',
  muted: '#667085',
  line: '#d0d5dd',
  lineSoft: '#e4e7ec',
  surfaceSoft: '#f5f8fc',
  surface: '#ffffff',
  background: '#ffffff',
  headingBand: '#f3f6fa',
  success: '#067647',
  warning: '#b54708',
  danger: '#b42318',
  bandDarkInk: '#ffffff',
  bandDarkText: '#d6e2f0',
  gradientHero: 'linear-gradient(112deg,#f8fafc,#eef4fb 55%,#f3fbf9)',
  gradientBrand: 'linear-gradient(120deg,#4873b8,#287d9d 55%,#56bdb6)',
  bandDark: 'linear-gradient(130deg,#173f73,#398c9a)',
  bandGraphite: 'linear-gradient(120deg,#23272e,#3a3f47)',
};


/**
 * Editorial Warm — the 2026-10 home redesign brief: warm off-white paper with a barely visible vertical gradient,
 * deep-navy ink, ONE coral accent (primary CTA, eyebrow pill, 공지 pill) and a pale warm taupe used for the big
 * hero ring (`headingBand`). Only existing token keys are remapped, so designs published earlier keep parsing.
 */
const editorialWarmTheme: ThemeTokens = {
  primary: '#1f3a5f',
  primaryDeep: '#14213d',
  accent: '#5b8c84',
  accentWarm: '#cf3f27',
  ink: '#14213d',
  text: '#3b4252',
  muted: '#6b7280',
  line: '#d9d2c7',
  lineSoft: '#ebe5dc',
  surfaceSoft: '#f3eee6',
  surface: '#faf7f2',
  background: '#faf7f2',
  headingBand: '#e8dfd3',
  success: '#067647',
  warning: '#b54708',
  danger: '#b42318',
  bandDarkInk: '#ffffff',
  bandDarkText: '#cfd8e6',
  gradientHero: 'linear-gradient(180deg,#fcfaf6 0%,#f5efe6 100%)',
  gradientBrand: 'linear-gradient(120deg,#14213d,#1f3a5f 55%,#5b8c84)',
  bandDark: 'linear-gradient(130deg,#14213d,#1f3a5f)',
  bandGraphite: 'linear-gradient(120deg,#23272e,#3a3f47)',
};

const legacyTypography: DesignConfig['typography'] = {
  fontFamily: 'Pretendard',
  headingFont: 'Pretendard',
  baseFontSize: 15,
  headingScale: 1.2,
  lineHeight: 1.75,
  letterSpacing: -0.02,
  weights: { regular: 400, semibold: 600, bold: 700, black: 800 },
};
const typography: DesignConfig['typography'] = {
  ...legacyTypography,
  baseFontSize: 16,
  lineHeight: 1.7,
};
const branding: DesignConfig['branding'] = { siteName: 'AINEX Archive', tagline: '필요한 배움을, 필요한 순간에.', logoAssetId: null, faviconAssetId: null, heroAssetId: null, logoAlt: 'AINEX Archive' };
const links: DesignConfig['links'] = { axisUrl: '', liveClassUrl: 'https://live.hrdeedu.co.kr', kakaoUrl: '' };

/**
 * The default design shipped until 2026-10-13 (storyboard palette, split hero, storyboard home sections).
 * Kept verbatim so the API can recognise an untouched system-published v1 and upgrade it to the new default.
 */
export const LEGACY_DEFAULT_DESIGN_V1: DesignConfig = {
  schemaVersion: 1,
  presetId: 'corporate-blue',
  theme: storyboardTheme,
  typography: legacyTypography,
  branding,
  layout: {
    headerVariant: 'standard',
    heroVariant: 'split',
    footerVariant: 'columns',
    cardVariant: 'elevated',
    radius: { sm: 4, md: 10, lg: 20 },
    container: 1200,
    homeSections: [
      { key: 'hero', visible: true },
      { key: 'aiZone', visible: true },
      { key: 'operatingTypes', visible: true },
      { key: 'featured', visible: true },
      { key: 'competencyBrowse', visible: true },
      { key: 'journey', visible: true },
      { key: 'axis', visible: true },
      { key: 'consulting', visible: true },
      { key: 'faq', visible: true },
    ],
  },
  links,
};

const editorialDesign = (type: DesignConfig['typography'], radius: DesignConfig['layout']['radius']): DesignConfig => ({
  schemaVersion: 1,
  presetId: 'editorial-warm',
  theme: editorialWarmTheme,
  typography: type,
  branding,
  layout: {
    headerVariant: 'standard',
    heroVariant: 'visual-right',
    footerVariant: 'columns',
    cardVariant: 'elevated',
    radius,
    container: 1200,
    homeSections: [
      { key: 'hero', visible: true },
      { key: 'intro', visible: true },
      { key: 'contentTabs', visible: true },
      { key: 'ctaBand', visible: true },
      { key: 'aiZone', visible: false },
      { key: 'operatingTypes', visible: false },
      { key: 'featured', visible: false },
      { key: 'competencyBrowse', visible: false },
      { key: 'journey', visible: false },
      { key: 'axis', visible: false },
      { key: 'consulting', visible: false },
      { key: 'faq', visible: false },
    ],
  },
  links,
});

/** Editorial default shipped before the 2026-10 typography and border refinement. */
export const LEGACY_EDITORIAL_DEFAULT_DESIGN_V2: DesignConfig = editorialDesign(legacyTypography, { sm: 4, md: 10, lg: 20 });

/** Current default: Editorial Warm palette, the orbit hero (`visual-right`), old-site home sections; storyboard sections stay available but hidden. */
export const DEFAULT_DESIGN: DesignConfig = editorialDesign(typography, { sm: 6, md: 12, lg: 20 });

export interface ThemePreset { id: string; name: string; description: string; theme: ThemeTokens }

const variant = (overrides: Partial<ThemeTokens>): ThemeTokens => ({ ...storyboardTheme, ...overrides });

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'editorial-warm', name: 'Editorial Warm', description: '웜 오프화이트 페이퍼 · 네이비 잉크 · 코랄 포인트 (2026-10 메인 리디자인 기본)', theme: editorialWarmTheme },
  { id: 'corporate-blue', name: 'Corporate Blue', description: '승인 스토리보드 기본 팔레트 (navy / blue / mint)', theme: storyboardTheme },
  { id: 'modern-green', name: 'Modern Green', description: '그린 계열의 차분한 기업 테마', theme: variant({ primary: '#2e8b57', primaryDeep: '#1f5f3c', accent: '#8fd3a6', gradientBrand: 'linear-gradient(120deg,#2e8b57,#2f9a7a 55%,#8fd3a6)', bandDark: 'linear-gradient(130deg,#1f5f3c,#2f9a7a)' }) },
  { id: 'professional-dark', name: 'Professional Dark', description: '진한 네이비 포인트의 전문적인 테마', theme: variant({ primary: '#1f3b64', primaryDeep: '#0f2340', accent: '#7aa6d9', gradientBrand: 'linear-gradient(120deg,#1f3b64,#2a4f85 55%,#7aa6d9)', bandDark: 'linear-gradient(130deg,#0f2340,#1f3b64)' }) },
  { id: 'premium-gold', name: 'Premium Gold', description: '골드 포인트의 프리미엄 테마', theme: variant({ primary: '#9a7b2f', primaryDeep: '#5c4717', accent: '#e0c374', accentWarm: '#c2410c', gradientBrand: 'linear-gradient(120deg,#9a7b2f,#b48a2c 55%,#e0c374)', bandDark: 'linear-gradient(130deg,#3a2f12,#7a5e1f)' }) },
  { id: 'minimal-gray', name: 'Minimal Gray', description: '그레이 중심의 미니멀 테마', theme: variant({ primary: '#475467', primaryDeep: '#1d2939', accent: '#98a2b3', gradientBrand: 'linear-gradient(120deg,#475467,#667085 55%,#98a2b3)', bandDark: 'linear-gradient(130deg,#1d2939,#475467)' }) },
  { id: 'modern-purple', name: 'Modern Purple', description: '퍼플 계열의 모던 테마', theme: variant({ primary: '#6941c6', primaryDeep: '#42307d', accent: '#b692f6', gradientBrand: 'linear-gradient(120deg,#6941c6,#7f56d9 55%,#b692f6)', bandDark: 'linear-gradient(130deg,#42307d,#6941c6)' }) },
];
