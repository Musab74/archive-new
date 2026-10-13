import { z } from 'zod';

/** Design tokens follow the approved AINEX storyboards (light mode). */
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'HEX color like #153f73');

export const ThemeTokensSchema = z.object({
  primary: HexColor, // blue #4873b8
  primaryDeep: HexColor, // navy #153f73
  accent: HexColor, // mint #56bdb6
  accentWarm: HexColor, // AXIS warm point
  ink: HexColor,
  text: HexColor,
  muted: HexColor,
  line: HexColor,
  lineSoft: HexColor,
  surfaceSoft: HexColor,
  surface: HexColor,
  background: HexColor,
  headingBand: HexColor,
  success: HexColor,
  warning: HexColor,
  danger: HexColor,
  bandDarkInk: HexColor,
  bandDarkText: HexColor,
  gradientHero: z.string().max(400),
  gradientBrand: z.string().max(400),
  bandDark: z.string().max(400),
  bandGraphite: z.string().max(400),
});
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

export const CURATED_FONTS = ['Pretendard', 'Noto Sans KR', 'Inter', 'system-ui'] as const;

export const TypographySchema = z.object({
  fontFamily: z.enum(CURATED_FONTS),
  headingFont: z.enum(CURATED_FONTS),
  baseFontSize: z.number().int().min(14).max(18),
  headingScale: z.number().min(1.1).max(1.35),
  lineHeight: z.number().min(1.4).max(2),
  letterSpacing: z.number().min(-0.05).max(0.05),
  weights: z.object({ regular: z.number().int(), semibold: z.number().int(), bold: z.number().int(), black: z.number().int() }),
});

export const BrandingSchema = z.object({
  siteName: z.string().min(1).max(60),
  tagline: z.string().max(120).default(''),
  logoAssetId: z.string().uuid().nullable().default(null),
  faviconAssetId: z.string().uuid().nullable().default(null),
  heroAssetId: z.string().uuid().nullable().default(null),
  logoAlt: z.string().max(120).default(''),
});

export const HEADER_VARIANTS = ['standard', 'compact', 'centered'] as const;
export const HERO_VARIANTS = ['split', 'centered', 'visual-right'] as const;
export const FOOTER_VARIANTS = ['columns', 'compact'] as const;
export const CARD_VARIANTS = ['elevated', 'outlined'] as const;
export const HOME_SECTION_KEYS = [
  'hero', 'intro', 'contentTabs', 'ctaBand', 'aiZone', 'operatingTypes', 'featured', 'competencyBrowse', 'journey', 'axis', 'consulting', 'faq',
] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const LayoutSchema = z.object({
  headerVariant: z.enum(HEADER_VARIANTS),
  heroVariant: z.enum(HERO_VARIANTS),
  footerVariant: z.enum(FOOTER_VARIANTS),
  cardVariant: z.enum(CARD_VARIANTS),
  radius: z.object({ sm: z.number().int(), md: z.number().int(), lg: z.number().int() }),
  container: z.number().int().min(960).max(1440),
  homeSections: z.array(z.object({ key: z.enum(HOME_SECTION_KEYS), visible: z.boolean() })),
});

export const LinksSchema = z.object({
  axisUrl: z.string().url().or(z.literal('')).default(''),
  liveClassUrl: z.string().url().or(z.literal('')).default(''),
  kakaoUrl: z.string().url().or(z.literal('')).default(''),
});

export const DesignConfigSchema = z.object({
  schemaVersion: z.literal(1),
  presetId: z.string().max(40),
  theme: ThemeTokensSchema,
  typography: TypographySchema,
  branding: BrandingSchema,
  layout: LayoutSchema,
  links: LinksSchema,
});
export type DesignConfig = z.infer<typeof DesignConfigSchema>;

export const CompanyInfoSchema = z.object({
  companyName: z.string().default(''),
  ceo: z.string().default(''),
  companyNumber: z.string().default(''),
  salesReportNumber: z.string().default(''),
  phone: z.string().default(''),
  fax: z.string().default(''),
  email: z.string().default(''),
  privacyManager: z.string().default(''),
  address: z.string().default(''),
  copyright: z.string().default(''),
  kakaoUrl: z.string().default(''),
});
export type CompanyInfo = z.infer<typeof CompanyInfoSchema>;

/** What GET /public/design returns. */
export const PublicDesignSchema = z.object({
  tenantId: z.string(),
  versionNumber: z.number().int(),
  etag: z.string(),
  publishedAt: z.string().nullable(),
  config: DesignConfigSchema,
  company: CompanyInfoSchema,
  assets: z.record(z.string(), z.string()), // assetId -> public URL
});
export type PublicDesign = z.infer<typeof PublicDesignSchema>;

export const DesignVersionMetaSchema = z.object({
  versionNumber: z.number().int(),
  publishedBy: z.string(),
  publishedAt: z.string(),
  description: z.string().default(''),
  checksum: z.string(),
});
export type DesignVersionMeta = z.infer<typeof DesignVersionMetaSchema>;

export const MediaAssetSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  fileName: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  alt: z.string().default(''),
  sha256: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  url: z.string(),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

/** WCAG relative luminance contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const l1 = lum(a);
  const l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export interface DesignValidationIssue { level: 'error' | 'warning'; path: string; message: string; ratio?: number }

/** Contrast rules: body text on background/surface >= 4.5; button text (white) on primary >= 3. */
export function validateDesignContrast(config: DesignConfig): DesignValidationIssue[] {
  const t = config.theme;
  const issues: DesignValidationIssue[] = [];
  const check = (fg: string, bg: string, path: string, min: number, warnAt: number) => {
    const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
    if (ratio < min) issues.push({ level: 'error', path, message: `contrast ${ratio}:1 below ${min}:1`, ratio });
    else if (ratio < warnAt) issues.push({ level: 'warning', path, message: `contrast ${ratio}:1 below recommended ${warnAt}:1`, ratio });
  };
  check(t.text, t.background, 'theme.text/background', 3, 4.5);
  check(t.text, t.surface, 'theme.text/surface', 3, 4.5);
  check(t.text, t.surfaceSoft, 'theme.text/surfaceSoft', 3, 4.5);
  check(t.muted, t.background, 'theme.muted/background', 3, 4.5);
  check('#ffffff', t.primary, 'white/primary (buttons)', 3, 4.5);
  check('#ffffff', t.primaryDeep, 'white/primaryDeep', 3, 4.5);
  check(t.bandDarkText, t.ink, 'bandDarkText/ink', 3, 4.5);
  return issues;
}
