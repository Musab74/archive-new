import { describe, expect, it, beforeEach } from 'vitest';
import { DEFAULT_DESIGN, LEGACY_DEFAULT_DESIGN_V1, THEME_PRESETS } from '@ainex/contracts';
import { applyTokens, clearTokens, readCachedDesign, writeCachedDesign } from '../shared/design/applyTokens';
import { designToCssVars, fontStack } from '../shared/design/tokens';

describe('designToCssVars / applyTokens', () => {
  beforeEach(() => { clearTokens(); localStorage.clear(); });

  it('maps the storyboard theme to the expected CSS custom properties', () => {
    const vars = designToCssVars(LEGACY_DEFAULT_DESIGN_V1);
    expect(vars['--c-primary']).toBe('#4873b8');
    expect(vars['--c-primary-deep']).toBe('#153f73');
    expect(vars['--c-accent']).toBe('#56bdb6');
    expect(vars['--c-ink']).toBe('#101828');
    expect(vars['--c-text']).toBe('#344054');
    expect(vars['--c-muted']).toBe('#667085');
    expect(vars['--c-line']).toBe('#d0d5dd');
    expect(vars['--c-line-2']).toBe('#e4e7ec');
    expect(vars['--c-soft']).toBe('#f5f8fc');
    expect(vars['--c-paper']).toBe('#ffffff');
    expect(vars['--g-brand']).toBe('linear-gradient(120deg,#4873b8,#287d9d 55%,#56bdb6)');
    expect(vars['--g-band-dark']).toBe('linear-gradient(130deg,#173f73,#398c9a)');
    expect(vars['--fs-base']).toBe('15px');
    expect(vars['--lh-body']).toBe('1.75');
    expect(vars['--r-sm']).toBe('4px');
    expect(vars['--r-md']).toBe('10px');
    expect(vars['--r-pill']).toBe('999px');
    expect(vars['--container']).toBe('1200px');
    expect(vars['--font-sans']).toMatch(/^"Pretendard","Noto Sans KR"/);
  });

  it('writes the variables on :root and sets layout data attributes', () => {
    applyTokens(DEFAULT_DESIGN);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--c-primary')).toBe('#1b2cc1'); // royal blue
    expect(root.style.getPropertyValue('--c-ink')).toBe('#091540'); // deep navy
    expect(root.style.getPropertyValue('--c-heading-band')).toBe('#e6eefc'); // sky-tinted band
    expect(root.style.getPropertyValue('--c-accent-warm')).toBe('#c9472f'); // the single coral accent
    expect(root.getAttribute('data-design')).toBe('applied');
    expect(root.getAttribute('data-header')).toBe('standard');
    expect(root.getAttribute('data-hero')).toBe('visual-right');
    applyTokens(LEGACY_DEFAULT_DESIGN_V1);
    expect(root.getAttribute('data-hero')).toBe('split');
    expect(root.style.getPropertyValue('--c-heading-band')).toBe('#f3f6fa');
  });

  it('applies a preset theme and clears it again', () => {
    const green = THEME_PRESETS.find((p) => p.id === 'modern-green')!;
    applyTokens({ ...DEFAULT_DESIGN, theme: green.theme });
    expect(document.documentElement.style.getPropertyValue('--c-primary')).toBe('#2e8b57');
    clearTokens();
    expect(document.documentElement.style.getPropertyValue('--c-primary')).toBe('');
  });

  it('round-trips the localStorage cache (design.v1)', () => {
    writeCachedDesign({ etag: 'W/"abc"', config: DEFAULT_DESIGN });
    const cached = readCachedDesign();
    expect(cached?.etag).toBe('W/"abc"');
    expect(cached?.config.presetId).toBe('ainex-blue');
    localStorage.setItem('design.v1', '{broken');
    expect(readCachedDesign()).toBeNull();
  });

  it('builds font stacks with Korean fallbacks', () => {
    expect(fontStack('Pretendard')).toContain('"Noto Sans KR"');
    expect(fontStack('system-ui').startsWith('system-ui')).toBe(true);
  });
});
