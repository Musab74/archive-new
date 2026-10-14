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

/**
 * AINEX Premium — the 2026-10 full redesign: navy ink (#142544) and deep navy (#0c1930) for weight, a professional
 * blue (#3468d5) for actions and active states, cyan (#18a6c9) as the accent, ONE coral (#c9472f) for promotional
 * details, white surfaces on a warm off-white page (#faf9f6) and a cool soft surface (#f3f6fa). Category hues
 * (teal / violet / amber / emerald …) are support tokens in tokens.css, not tenant branding.
 */
const ainexPremiumTheme: ThemeTokens = {
  primary: '#3468d5',
  primaryDeep: '#0c1930',
  accent: '#18a6c9',
  accentWarm: '#c9472f',
  ink: '#142544',
  text: '#334155',
  muted: '#64748b',
  line: '#e2e8f0',
  lineSoft: '#edf1f6',
  surfaceSoft: '#f3f6fa',
  surface: '#ffffff',
  background: '#faf9f6',
  headingBand: '#f3f6fa',
  success: '#067647',
  warning: '#b54708',
  danger: '#b42318',
  bandDarkInk: '#ffffff',
  bandDarkText: '#c3cee0',
  gradientHero: 'linear-gradient(180deg,#ffffff 0%,#faf9f6 100%)',
  gradientBrand: 'linear-gradient(120deg,#142544,#3468d5 60%,#18a6c9)',
  bandDark: 'linear-gradient(135deg,#0c1930 0%,#142544 55%,#1b3767 100%)',
  bandGraphite: 'linear-gradient(120deg,#23272e,#3a3f47)',
};

/**
 * AINEX Blue — the 2026-10 brand palette: deep navy #091540 (ink, dark bands), royal blue #1b2cc1 (actions, active
 * states), cornflower #7692ff (accent — never under white text: 2.9:1) and sky #abd2fa (light fills, always with navy
 * text). Cool white surfaces; coral stays only for the 공지 tag.
 */
const ainexBlueTheme: ThemeTokens = {
  primary: '#1b2cc1',
  primaryDeep: '#091540',
  accent: '#7692ff',
  accentWarm: '#c9472f',
  ink: '#091540',
  text: '#2b3553',
  muted: '#5d6888',
  line: '#d9e2f2',
  lineSoft: '#e8eef9',
  surfaceSoft: '#eef3fd',
  surface: '#ffffff',
  background: '#f7f9fe',
  headingBand: '#e6eefc',
  success: '#067647',
  warning: '#b54708',
  danger: '#b42318',
  bandDarkInk: '#ffffff',
  bandDarkText: '#c6d4f6',
  gradientHero: 'linear-gradient(180deg,#ffffff 0%,#f2f6fe 100%)',
  gradientBrand: 'linear-gradient(120deg,#091540,#1b2cc1 60%,#7692ff)',
  bandDark: 'linear-gradient(135deg,#060f30 0%,#091540 50%,#16229a 100%)',
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

/** Editorial Warm default shipped until the AINEX Premium redesign (kept verbatim so the API can recognise and upgrade it). */
export const LEGACY_EDITORIAL_DEFAULT_DESIGN_V3: DesignConfig = editorialDesign(typography, { sm: 6, md: 12, lg: 20 });

const premiumDesign = (presetId: string, theme: ThemeTokens): DesignConfig => ({
  schemaVersion: 1,
  presetId,
  theme,
  typography,
  branding,
  layout: {
    headerVariant: 'standard',
    heroVariant: 'visual-right',
    footerVariant: 'columns',
    cardVariant: 'elevated',
    radius: { sm: 8, md: 12, lg: 20 },
    container: 1200,
    homeSections: [
      { key: 'hero', visible: true },
      { key: 'intro', visible: true },
      { key: 'contentTabs', visible: true },
      { key: 'aiZone', visible: true },
      { key: 'journey', visible: true },
      { key: 'ctaBand', visible: true },
      { key: 'operatingTypes', visible: false },
      { key: 'featured', visible: false },
      { key: 'competencyBrowse', visible: false },
      { key: 'axis', visible: false },
      { key: 'consulting', visible: false },
      { key: 'faq', visible: false },
    ],
  },
  links,
});

/** AINEX Premium default shipped before the AINEX Blue palette (kept verbatim so the API can recognise and upgrade it). */
export const LEGACY_PREMIUM_DEFAULT_DESIGN_V4: DesignConfig = premiumDesign('ainex-premium', ainexPremiumTheme);

/**
 * Current default: AINEX Blue palette, the editorial hero (`visual-right`) and the redesigned home sequence
 * (hero → intro → content tabs → AI ZONE → learning journey → CTA). Storyboard-only sections stay available but hidden.
 */
export const DEFAULT_DESIGN: DesignConfig = premiumDesign('ainex-blue', ainexBlueTheme);

export interface ThemePreset { id: string; name: string; description: string; theme: ThemeTokens }

const variant = (overrides: Partial<ThemeTokens>): ThemeTokens => ({ ...storyboardTheme, ...overrides });

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'ainex-blue', name: 'AINEX Blue', description: '딥 네이비 · 로열 블루 · 콘플라워 · 스카이 (2026-10 브랜드 팔레트, 기본)', theme: ainexBlueTheme },
  { id: 'ainex-premium', name: 'AINEX Premium', description: '네이비 잉크 · 프로페셔널 블루 · 시안 포인트 · 웜 화이트', theme: ainexPremiumTheme },
  { id: 'editorial-warm', name: 'Editorial Warm', description: '웜 오프화이트 페이퍼 · 네이비 잉크 · 코랄 포인트 (이전 기본)', theme: editorialWarmTheme },
  { id: 'corporate-blue', name: 'Corporate Blue', description: '승인 스토리보드 기본 팔레트 (navy / blue / mint)', theme: storyboardTheme },
  { id: 'modern-green', name: 'Modern Green', description: '그린 계열의 차분한 기업 테마', theme: variant({ primary: '#2e8b57', primaryDeep: '#1f5f3c', accent: '#8fd3a6', gradientBrand: 'linear-gradient(120deg,#2e8b57,#2f9a7a 55%,#8fd3a6)', bandDark: 'linear-gradient(130deg,#1f5f3c,#2f9a7a)' }) },
  { id: 'professional-dark', name: 'Professional Dark', description: '진한 네이비 포인트의 전문적인 테마', theme: variant({ primary: '#1f3b64', primaryDeep: '#0f2340', accent: '#7aa6d9', gradientBrand: 'linear-gradient(120deg,#1f3b64,#2a4f85 55%,#7aa6d9)', bandDark: 'linear-gradient(130deg,#0f2340,#1f3b64)' }) },
  { id: 'premium-gold', name: 'Premium Gold', description: '골드 포인트의 프리미엄 테마', theme: variant({ primary: '#9a7b2f', primaryDeep: '#5c4717', accent: '#e0c374', accentWarm: '#c2410c', gradientBrand: 'linear-gradient(120deg,#9a7b2f,#b48a2c 55%,#e0c374)', bandDark: 'linear-gradient(130deg,#3a2f12,#7a5e1f)' }) },
  { id: 'minimal-gray', name: 'Minimal Gray', description: '그레이 중심의 미니멀 테마', theme: variant({ primary: '#475467', primaryDeep: '#1d2939', accent: '#98a2b3', gradientBrand: 'linear-gradient(120deg,#475467,#667085 55%,#98a2b3)', bandDark: 'linear-gradient(130deg,#1d2939,#475467)' }) },
  { id: 'modern-purple', name: 'Modern Purple', description: '퍼플 계열의 모던 테마', theme: variant({ primary: '#6941c6', primaryDeep: '#42307d', accent: '#b692f6', gradientBrand: 'linear-gradient(120deg,#6941c6,#7f56d9 55%,#b692f6)', bandDark: 'linear-gradient(130deg,#42307d,#6941c6)' }) },
];
