import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, HOME_SECTION_KEYS, LEGACY_DEFAULT_DESIGN_V1 } from '@ainex/contracts';
import { moveSection, normalizeHomeSections, toggleSection, type HomeSection } from '../features/admin/design/designHelpers';
import { moveItem } from '../features/admin/pages/courses/ListsPage';

const base: HomeSection[] = [{ key: 'hero', visible: true }, { key: 'aiZone', visible: true }, { key: 'featured', visible: false }];

describe('homeSections reorder helpers', () => {
  it('moves a section up/down immutably', () => {
    expect(moveSection(base, 1, -1).map((s) => s.key)).toEqual(['aiZone', 'hero', 'featured']);
    expect(moveSection(base, 1, 1).map((s) => s.key)).toEqual(['hero', 'featured', 'aiZone']);
    expect(base.map((s) => s.key)).toEqual(['hero', 'aiZone', 'featured']);
  });
  it('ignores out-of-range moves', () => {
    expect(moveSection(base, 0, -1)).toEqual(base);
    expect(moveSection(base, 2, 1)).toEqual(base);
    expect(moveSection(base, 9, 1)).toEqual(base);
  });
  it('toggles visibility by key', () => {
    expect(toggleSection(base, 'featured', true)[2]).toEqual({ key: 'featured', visible: true });
    expect(toggleSection(base, 'hero', false)[0]!.visible).toBe(false);
  });
  it('normalises to HOME_SECTION_KEYS: drops unknown, de-duplicates, appends missing as visible', () => {
    const out = normalizeHomeSections([{ key: 'faq', visible: false }, { key: 'bogus', visible: true }, { key: 'faq', visible: true }, { key: 'hero', visible: true }]);
    expect(out[0]).toEqual({ key: 'faq', visible: false });
    expect(out[1]).toEqual({ key: 'hero', visible: true });
    expect(out.map((s) => s.key).sort()).toEqual([...HOME_SECTION_KEYS].sort());
    expect(out).toHaveLength(HOME_SECTION_KEYS.length);
    expect(new Set(out.map((s) => s.key)).size).toBe(HOME_SECTION_KEYS.length);
  });
  it('appends keys a stored config predates as hidden when missingVisible is false (public site / Design Studio)', () => {
    const out = normalizeHomeSections(LEGACY_DEFAULT_DESIGN_V1.layout.homeSections, { missingVisible: false });
    expect(out.slice(0, 9).map((s) => s.key)).toEqual(LEGACY_DEFAULT_DESIGN_V1.layout.homeSections.map((s) => s.key));
    expect(out.find((s) => s.key === 'intro')).toEqual({ key: 'intro', visible: false });
    expect(out.find((s) => s.key === 'ctaBand')).toEqual({ key: 'ctaBand', visible: false });
    expect(out).toHaveLength(HOME_SECTION_KEYS.length);
    expect(normalizeHomeSections(DEFAULT_DESIGN.layout.homeSections, { missingVisible: false })).toEqual(DEFAULT_DESIGN.layout.homeSections);
  });
  it('curation list reorder uses the same semantics', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
  });
});
