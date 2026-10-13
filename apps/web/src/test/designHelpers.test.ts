import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, THEME_PRESETS, type DesignConfig } from '@ainex/contracts';
import { diffConfigs, isHex, issuesForToken, normalizeHex, presetThemeFor, tokenIssues, validateDraft, withTheme } from '../features/admin/design/designHelpers';

const clone = (c: DesignConfig): DesignConfig => JSON.parse(JSON.stringify(c)) as DesignConfig;

describe('Design Studio — token editor validation', () => {
  it('normalises HEX input', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('4873B8')).toBe('#4873b8');
    expect(normalizeHex(' #153f73 ')).toBe('#153f73');
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
    expect(isHex('#4873b8')).toBe(true);
    expect(isHex('#4873b')).toBe(false);
  });

  it('reports no issues for the storyboard default theme', () => {
    expect(tokenIssues(DEFAULT_DESIGN).filter((i) => i.level === 'error')).toEqual([]);
    expect(validateDraft(DEFAULT_DESIGN).ok).toBe(true);
  });

  it('flags an invalid HEX before computing contrast', () => {
    const c = clone(DEFAULT_DESIGN);
    c.theme.primary = 'blue';
    const issues = tokenIssues(c);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: 'error', path: 'theme.primary', tokens: ['primary'] });
    expect(validateDraft(c).ok).toBe(false);
    expect(validateDraft(c).schemaErrors[0]!.path).toBe('theme.primary');
  });

  it('maps contrast errors to the tokens involved', () => {
    const c = clone(DEFAULT_DESIGN);
    c.theme.text = '#f0f0f0'; // light text on white background/surface
    const issues = tokenIssues(c);
    expect(issues.some((i) => i.level === 'error' && i.path === 'theme.text/background')).toBe(true);
    expect(issuesForToken(issues, 'text').length).toBeGreaterThan(0);
    expect(issuesForToken(issues, 'background').length).toBeGreaterThan(0);
    expect(issuesForToken(issues, 'accent')).toEqual([]);
    const v = validateDraft(c);
    expect(v.ok).toBe(false);
    expect(v.errors).toBeGreaterThan(0);
  });

  it('white-on-primary check names only the primary token', () => {
    const c = clone(DEFAULT_DESIGN);
    c.theme.primary = '#ffffff';
    const issues = tokenIssues(c);
    const p = issues.find((i) => i.path.startsWith('white/primary'));
    expect(p?.tokens).toEqual(['primary']);
  });

  it('resets to the preset theme of the draft (fallback DEFAULT)', () => {
    expect(presetThemeFor('modern-green').primary).toBe(THEME_PRESETS.find((p) => p.id === 'modern-green')!.theme.primary);
    expect(presetThemeFor('nope')).toEqual(DEFAULT_DESIGN.theme);
    const c = withTheme(DEFAULT_DESIGN, presetThemeFor('modern-green'), 'modern-green');
    expect(c.presetId).toBe('modern-green');
    expect(c.typography).toEqual(DEFAULT_DESIGN.typography);
  });
});

describe('Design Studio — diff helper', () => {
  it('returns token-level rows for changed values only', () => {
    const a = clone(DEFAULT_DESIGN);
    const b = clone(DEFAULT_DESIGN);
    expect(diffConfigs(a, b)).toEqual([]);
    b.theme.primary = '#2e8b57';
    b.typography.baseFontSize = 17;
    b.layout.homeSections = b.layout.homeSections.filter((s) => s.key !== 'faq');
    b.branding.logoAssetId = '11111111-1111-4111-8111-111111111111';
    const diff = diffConfigs(a, b);
    expect(diff.map((d) => d.path)).toEqual(['branding.logoAssetId', 'layout.homeSections', 'theme.primary', 'typography.baseFontSize']);
    expect(diff.find((d) => d.path === 'theme.primary')).toEqual({ path: 'theme.primary', a: '#1f3a5f', b: '#2e8b57' });
    expect(diff.find((d) => d.path === 'branding.logoAssetId')!.a).toBe('');
  });
});
