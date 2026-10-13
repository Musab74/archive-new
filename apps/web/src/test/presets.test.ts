import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, DesignConfigSchema, LEGACY_DEFAULT_DESIGN_V1, LEGACY_EDITORIAL_DEFAULT_DESIGN_V2, THEME_PRESETS, contrastRatio, validateDesignContrast } from '@ainex/contracts';

describe('editorial-warm preset / DEFAULT_DESIGN', () => {
  const preset = THEME_PRESETS.find((p) => p.id === 'editorial-warm');
  it('exists, is the default, and passes the publish contrast gate', () => {
    expect(preset).toBeDefined();
    expect(DEFAULT_DESIGN.presetId).toBe('editorial-warm');
    expect(DEFAULT_DESIGN.theme).toEqual(preset!.theme);
    expect(validateDesignContrast(DEFAULT_DESIGN).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('keeps white text on the coral CTA at or above 4.5:1', () => {
    expect(contrastRatio('#ffffff', preset!.theme.accentWarm)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(preset!.theme.ink, preset!.theme.headingBand)).toBeGreaterThanOrEqual(7); // badges/text over the ring
  });
  it('uses the orbit hero and the old-site sections by default; storyboard sections stay available but hidden', () => {
    expect(DEFAULT_DESIGN.layout.heroVariant).toBe('visual-right');
    expect(DEFAULT_DESIGN.typography).toMatchObject({ baseFontSize: 16, lineHeight: 1.7 });
    expect(DEFAULT_DESIGN.layout.radius).toEqual({ sm: 6, md: 12, lg: 20 });
    const vis = Object.fromEntries(DEFAULT_DESIGN.layout.homeSections.map((s) => [s.key, s.visible]));
    expect(vis).toMatchObject({ hero: true, intro: true, contentTabs: true, ctaBand: true, aiZone: false, operatingTypes: false, featured: false, axis: false, consulting: false, faq: false });
    expect(DesignConfigSchema.safeParse(DEFAULT_DESIGN).success).toBe(true);
    expect(DesignConfigSchema.safeParse(LEGACY_DEFAULT_DESIGN_V1).success).toBe(true); // already-published v1 files keep parsing
    expect(DesignConfigSchema.safeParse(LEGACY_EDITORIAL_DEFAULT_DESIGN_V2).success).toBe(true);
  });
});
