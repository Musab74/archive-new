import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, DesignConfigSchema, LEGACY_DEFAULT_DESIGN_V1, LEGACY_EDITORIAL_DEFAULT_DESIGN_V2, LEGACY_EDITORIAL_DEFAULT_DESIGN_V3, THEME_PRESETS, contrastRatio, validateDesignContrast } from '@ainex/contracts';

describe('ainex-premium preset / DEFAULT_DESIGN', () => {
  const preset = THEME_PRESETS.find((p) => p.id === 'ainex-premium');
  it('exists, is the default, and passes the publish contrast gate without warnings', () => {
    expect(preset).toBeDefined();
    expect(DEFAULT_DESIGN.presetId).toBe('ainex-premium');
    expect(DEFAULT_DESIGN.theme).toEqual(preset!.theme);
    expect(validateDesignContrast(DEFAULT_DESIGN)).toEqual([]);
  });
  it('keeps white text on primary, coral and the navy ink at or above 4.5:1', () => {
    expect(contrastRatio('#ffffff', preset!.theme.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', preset!.theme.accentWarm)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', preset!.theme.ink)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(preset!.theme.muted, preset!.theme.background)).toBeGreaterThanOrEqual(4.5);
  });
  it('uses the editorial hero and the redesigned home sequence; storyboard sections stay available but hidden', () => {
    expect(DEFAULT_DESIGN.layout.heroVariant).toBe('visual-right');
    expect(DEFAULT_DESIGN.typography).toMatchObject({ baseFontSize: 16, lineHeight: 1.7 });
    const order = DEFAULT_DESIGN.layout.homeSections.filter((s) => s.visible).map((s) => s.key);
    expect(order).toEqual(['hero', 'intro', 'contentTabs', 'aiZone', 'journey', 'ctaBand']);
    expect(DesignConfigSchema.safeParse(DEFAULT_DESIGN).success).toBe(true);
  });
  it('keeps every earlier system default parseable and verbatim, so already-published files keep working', () => {
    for (const legacy of [LEGACY_DEFAULT_DESIGN_V1, LEGACY_EDITORIAL_DEFAULT_DESIGN_V2, LEGACY_EDITORIAL_DEFAULT_DESIGN_V3]) expect(DesignConfigSchema.safeParse(legacy).success).toBe(true);
    expect(LEGACY_EDITORIAL_DEFAULT_DESIGN_V3.presetId).toBe('editorial-warm');
    expect(LEGACY_EDITORIAL_DEFAULT_DESIGN_V3.layout.radius).toEqual({ sm: 6, md: 12, lg: 20 });
    expect(THEME_PRESETS.find((p) => p.id === 'editorial-warm')).toBeDefined();
  });
});
