/*
 * No-FOUC design token bootstrap.
 * Runs before the app bundle: reads the cached design config (localStorage "design.v1" = {etag, config})
 * and writes the same CSS custom properties that src/shared/design/applyTokens.ts writes.
 * Keep the mapping below in sync with src/shared/design/tokens.ts (designToCssVars).
 */
(function () {
  try {
    var raw = window.localStorage.getItem('design.v1');
    if (!raw) return;
    var cached = JSON.parse(raw);
    var c = cached && cached.config;
    if (!c || c.schemaVersion !== 1 || !c.theme || !c.typography || !c.layout) return;
    var t = c.theme, ty = c.typography, l = c.layout;
    var fallback = '"Noto Sans KR","Malgun Gothic",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
    function stack(name) {
      if (name === 'system-ui') return 'system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans KR","Malgun Gothic",sans-serif';
      return '"' + name + '",' + fallback;
    }
    var vars = {
      '--c-primary': t.primary, '--c-primary-deep': t.primaryDeep, '--c-accent': t.accent, '--c-accent-warm': t.accentWarm,
      '--c-ink': t.ink, '--c-text': t.text, '--c-muted': t.muted, '--c-line': t.line, '--c-line-2': t.lineSoft,
      '--c-soft': t.surfaceSoft, '--c-paper': t.surface, '--c-bg': t.background, '--c-heading-band': t.headingBand,
      '--c-ok': t.success, '--c-warn': t.warning, '--c-danger': t.danger, '--c-band-ink': t.bandDarkInk, '--c-band-text': t.bandDarkText,
      '--g-hero': t.gradientHero, '--g-brand': t.gradientBrand, '--g-band-dark': t.bandDark, '--g-band-graphite': t.bandGraphite,
      '--font-sans': stack(ty.fontFamily), '--font-heading': stack(ty.headingFont),
      '--fs-base': ty.baseFontSize + 'px', '--lh-body': String(ty.lineHeight), '--ls-body': ty.letterSpacing + 'em', '--heading-scale': String(ty.headingScale),
      '--fw-regular': String(ty.weights.regular), '--fw-semibold': String(ty.weights.semibold), '--fw-bold': String(ty.weights.bold), '--fw-black': String(ty.weights.black),
      '--r-sm': l.radius.sm + 'px', '--r-md': l.radius.md + 'px', '--r-lg': l.radius.lg + 'px', '--r-pill': '999px',
      '--container': l.container + 'px'
    };
    var s = document.documentElement.style;
    for (var k in vars) if (vars[k] != null) s.setProperty(k, String(vars[k]));
    document.documentElement.setAttribute('data-design', 'cached');
  } catch (e) { /* ignore: defaults from tokens.css apply */ }
})();
