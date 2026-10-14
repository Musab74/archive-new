import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, DesignConfigSchema, LEGACY_DEFAULT_DESIGN_V1, LEGACY_EDITORIAL_DEFAULT_DESIGN_V2, LEGACY_EDITORIAL_DEFAULT_DESIGN_V3, LEGACY_PREMIUM_DEFAULT_DESIGN_V4, THEME_PRESETS, contrastRatio, validateDesignContrast } from '@ainex/contracts';

describe('ainex-blue preset / DEFAULT_DESIGN', () => {
  const preset = THEME_PRESETS.find((p) => p.id === 'ainex-blue');
  it('exists, is the default, and passes the publish contrast gate without warnings', () => {
    expect(preset).toBeDefined();
    expect(DEFAULT_DESIGN.presetId).toBe('ainex-blue');
    expect(preset!.theme).toMatchObject({ ink: '#091540', primary: '#1b2cc1', accent: '#7692ff' }); // the brand palette
    expect(DEFAULT_DESIGN.theme).toEqual(preset!.theme);
    expect(validateDesignContrast(DEFAULT_DESIGN)).toEqual([]);
  });
  it('keeps white text on primary, coral and the navy ink at or above 4.5:1 (never on the light cornflower accent)', () => {
    expect(contrastRatio('#ffffff', preset!.theme.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', preset!.theme.accentWarm)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', preset!.theme.ink)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(preset!.theme.muted, preset!.theme.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', preset!.theme.accent)).toBeLessThan(3); // why the accent only carries navy text
    expect(contrastRatio(preset!.theme.ink, preset!.theme.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('uses the editorial hero and the redesigned home sequence; storyboard sections stay available but hidden', () => {
    expect(DEFAULT_DESIGN.layout.heroVariant).toBe('visual-right');
    expect(DEFAULT_DESIGN.typography).toMatchObject({ baseFontSize: 16, lineHeight: 1.7 });
    const order = DEFAULT_DESIGN.layout.homeSections.filter((s) => s.visible).map((s) => s.key);
    expect(order).toEqual(['hero', 'intro', 'contentTabs', 'aiZone', 'journey', 'ctaBand']);
    expect(DesignConfigSchema.safeParse(DEFAULT_DESIGN).success).toBe(true);
  });
  it('keeps every earlier system default parseable and verbatim, so already-published files keep working', () => {
    for (const legacy of [LEGACY_DEFAULT_DESIGN_V1, LEGACY_EDITORIAL_DEFAULT_DESIGN_V2, LEGACY_EDITORIAL_DEFAULT_DESIGN_V3, LEGACY_PREMIUM_DEFAULT_DESIGN_V4]) expect(DesignConfigSchema.safeParse(legacy).success).toBe(true);
    expect(LEGACY_PREMIUM_DEFAULT_DESIGN_V4).toMatchObject({ presetId: 'ainex-premium', theme: { primary: '#3468d5' } });
    expect(THEME_PRESETS.find((p) => p.id === 'ainex-premium')).toBeDefined();
    expect(LEGACY_EDITORIAL_DEFAULT_DESIGN_V3.presetId).toBe('editorial-warm');
    expect(LEGACY_EDITORIAL_DEFAULT_DESIGN_V3.layout.radius).toEqual({ sm: 6, md: 12, lg: 20 });
    expect(THEME_PRESETS.find((p) => p.id === 'editorial-warm')).toBeDefined();
  });
});
