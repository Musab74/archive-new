import { DEFAULT_DESIGN, DesignConfigSchema, THEME_PRESETS, validateDesignContrast, type DesignConfig, type DesignValidationIssue, type HomeSectionKey, type ThemeTokens } from '@ainex/contracts';
import { designToCssVars, type CssVarMap } from '../../../shared/design/tokens';
import { getAdminLang, tr } from '../../../shared/i18n/adminLang';

// ---------------------------------------------------------------- colour tokens
export type ColorTokenKey = Exclude<keyof ThemeTokens, 'gradientHero' | 'gradientBrand' | 'bandDark' | 'bandGraphite'>;
export type GradientTokenKey = 'gradientHero' | 'gradientBrand' | 'bandDark' | 'bandGraphite';

export interface TokenGroup { key: string; label: string; tokens: { key: ColorTokenKey; label: string; hint: string }[] }
export const TOKEN_GROUPS: TokenGroup[] = [
  { key: 'brand', label: tr('브랜드', 'Brand'), tokens: [
    { key: 'primary', label: 'primary', hint: tr('주 버튼·링크·강조', 'Primary buttons · links · highlights') }, { key: 'primaryDeep', label: 'primaryDeep', hint: tr('버튼 hover·제목 강조(네이비)', 'Button hover · heading accent (navy)') }, { key: 'accent', label: 'accent', hint: tr('포커스 링·포인트(민트)', 'Focus ring · accents (mint)') }, { key: 'accentWarm', label: 'accentWarm', hint: tr('AXIS 포인트·미리보기 리본', 'AXIS accents · preview ribbon') },
  ] },
  { key: 'text', label: tr('텍스트', 'Text'), tokens: [
    { key: 'ink', label: 'ink', hint: tr('제목·가장 진한 글자', 'Headings · darkest text') }, { key: 'text', label: 'text', hint: tr('본문 글자', 'Body text') }, { key: 'muted', label: 'muted', hint: tr('보조 글자', 'Secondary text') },
  ] },
  { key: 'surface', label: tr('면·선', 'Surfaces · lines'), tokens: [
    { key: 'background', label: 'background', hint: tr('페이지 배경', 'Page background') }, { key: 'surface', label: 'surface', hint: tr('카드·헤더 면', 'Card · header surface') }, { key: 'surfaceSoft', label: 'surfaceSoft', hint: tr('연한 면(사이드바·입력)', 'Soft surface (sidebar · inputs)') }, { key: 'headingBand', label: 'headingBand', hint: tr('페이지 제목 띠', 'Page title band') }, { key: 'line', label: 'line', hint: tr('입력·테두리 선', 'Input · border lines') }, { key: 'lineSoft', label: 'lineSoft', hint: tr('연한 구분선', 'Soft dividers') },
  ] },
  { key: 'status', label: tr('상태', 'Status'), tokens: [
    { key: 'success', label: 'success', hint: tr('성공·완료', 'Success · completed') }, { key: 'warning', label: 'warning', hint: tr('주의', 'Caution') }, { key: 'danger', label: 'danger', hint: tr('오류·삭제', 'Errors · delete') },
  ] },
  { key: 'band', label: tr('다크 밴드', 'Dark band'), tokens: [
    { key: 'bandDarkInk', label: 'bandDarkInk', hint: tr('어두운 띠 위 제목', 'Headings on dark band') }, { key: 'bandDarkText', label: 'bandDarkText', hint: tr('어두운 띠 위 본문', 'Body text on dark band') },
  ] },
];
export const GRADIENT_TOKENS: { key: GradientTokenKey; label: string; hint: string }[] = [
  { key: 'gradientHero', label: 'gradientHero', hint: tr('메인 상단 배경', 'Hero background') }, { key: 'gradientBrand', label: 'gradientBrand', hint: tr('브랜드 띠', 'Brand band') }, { key: 'bandDark', label: 'bandDark', hint: tr('어두운 띠', 'Dark band') }, { key: 'bandGraphite', label: 'bandGraphite', hint: tr('그래파이트 띠', 'Graphite band') },
];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const isHex = (v: string): boolean => HEX_RE.test(v);
/** "#ABC" → "#aabbcc", "abc123" → "#abc123"; returns null when not a hex colour. */
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) return `#${s.split('').map((c) => c + c).join('')}`.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`.toLowerCase();
  return null;
}

export interface TokenIssue extends DesignValidationIssue { tokens: string[] }
/** Issues per theme token: invalid HEX (error) + contrast issues (from validateDesignContrast) mapped to their tokens. */
export function tokenIssues(config: DesignConfig): TokenIssue[] {
  const out: TokenIssue[] = [];
  for (const g of TOKEN_GROUPS) for (const t of g.tokens) if (!isHex(config.theme[t.key])) out.push({ level: 'error', path: `theme.${t.key}`, message: tr('HEX 색상(#rrggbb)이 아닙니다.', 'Not a HEX colour (#rrggbb).'), tokens: [t.key] });
  if (out.length) return out; // contrast maths needs valid colours
  for (const issue of validateDesignContrast(config)) {
    const tokens = issue.path.replace(/^theme\./, '').replace(/ \(.*\)$/, '').split('/').map((s) => s.trim()).filter((s) => s !== 'white');
    out.push({ ...issue, tokens });
  }
  return out;
}
export const issuesForToken = (issues: TokenIssue[], token: string): TokenIssue[] => issues.filter((i) => i.tokens.includes(token));

/** Theme a token resets to: the draft's preset, else DEFAULT_DESIGN. */
export function presetThemeFor(presetId: string): ThemeTokens {
  return THEME_PRESETS.find((p) => p.id === presetId)?.theme ?? DEFAULT_DESIGN.theme;
}

// ---------------------------------------------------------------- validation before PUT
export interface DraftValidation { ok: boolean; schemaErrors: { path: string; message: string }[]; issues: DesignValidationIssue[]; errors: number; warnings: number }
export function validateDraft(config: unknown): DraftValidation {
  const parsed = DesignConfigSchema.safeParse(config);
  if (!parsed.success) {
    const schemaErrors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return { ok: false, schemaErrors, issues: [], errors: schemaErrors.length, warnings: 0 };
  }
  const issues = validateDesignContrast(parsed.data);
  const errors = issues.filter((i) => i.level === 'error').length;
  return { ok: errors === 0, schemaErrors: [], issues, errors, warnings: issues.length - errors };
}

// ---------------------------------------------------------------- diff
export interface DiffRow { path: string; a: string; b: string }
function flatten(value: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (Array.isArray(value)) { out[prefix] = JSON.stringify(value); return out; }
  if (value && typeof value === 'object') { for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out); return out; }
  out[prefix] = value === null || value === undefined ? '' : String(value);
  return out;
}
/** Token-level diff between two configs (dot paths; arrays like homeSections compared as JSON). */
export function diffConfigs(a: DesignConfig, b: DesignConfig): DiffRow[] {
  const fa = flatten(a); const fb = flatten(b);
  const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].sort();
  return keys.filter((k) => fa[k] !== fb[k]).map((k) => ({ path: k, a: fa[k] ?? '', b: fb[k] ?? '' }));
}

// ---------------------------------------------------------------- home sections
export type { HomeSection } from '@ainex/contracts';
export { normalizeHomeSections } from '@ainex/contracts';
import { HOME_SECTION_LABELS as HOME_SECTION_LABELS_KO, type HomeSection } from '@ainex/contracts';

const HOME_SECTION_LABELS_EN: Record<HomeSectionKey, string> = {
  hero: 'Hero', intro: 'Intro band (navy)', contentTabs: 'Content tabs', ctaBand: 'Enrollment CTA', aiZone: 'AI ZONE band', operatingTypes: 'Operating types',
  featured: 'Featured content', competencyBrowse: 'Browse by competency', journey: 'Learning journey', axis: 'AXIS banner', consulting: 'Corporate training inquiry', faq: 'FAQ',
};
/** Home section labels in the admin language (Korean source: HOME_SECTION_LABELS in @ainex/contracts). */
export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = getAdminLang() === 'en' ? HOME_SECTION_LABELS_EN : HOME_SECTION_LABELS_KO;

/** Moves a section up (-1) or down (+1); out-of-range moves return a copy unchanged. */
export function moveSection(sections: readonly HomeSection[], index: number, dir: -1 | 1): HomeSection[] {
  const to = index + dir;
  if (index < 0 || index >= sections.length || to < 0 || to >= sections.length) return [...sections];
  const out = [...sections];
  const [s] = out.splice(index, 1);
  out.splice(to, 0, s as HomeSection);
  return out;
}
export function toggleSection(sections: readonly HomeSection[], key: HomeSectionKey, visible: boolean): HomeSection[] {
  return sections.map((s) => (s.key === key ? { ...s, visible } : s));
}
// ---------------------------------------------------------------- scoped preview vars
/** CSS custom properties for a wrapper element (mini previews, specimens) — same mapping as :root. */
export function scopedVars(config: DesignConfig): CssVarMap { return designToCssVars(config); }
export function withTheme(config: DesignConfig, theme: ThemeTokens, presetId?: string): DesignConfig { return { ...config, presetId: presetId ?? config.presetId, theme: { ...theme } }; }
