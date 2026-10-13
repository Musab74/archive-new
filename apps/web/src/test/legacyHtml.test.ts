import { describe, expect, it } from 'vitest';
import { looksLikeHtml, sanitizeLegacyHtml } from '../shared/utils/legacyHtml';

describe('sanitizeLegacyHtml', () => {
  it('strips inline styles, scripts and event handlers but keeps structure', () => {
    const out = sanitizeLegacyHtml('<p style="color: rgb(255,255,255)"><span style="font-size:12pt" onclick="x()">안내</span></p><script>alert(1)</script><a href="javascript:void(0)">x</a>');
    expect(out).toBe('<p><span>안내</span></p><a href="void(0)">x</a>');
  });
  it('converts font tags and drops color attributes', () => {
    expect(sanitizeLegacyHtml('<font color="#fff" face="Arial">t</font>')).toBe('<span>t</span>');
  });
  it('detects html vs plain text', () => {
    expect(looksLikeHtml('<p>a</p>')).toBe(true);
    expect(looksLikeHtml('plain text')).toBe(false);
    expect(looksLikeHtml('')).toBe(false);
  });
});
