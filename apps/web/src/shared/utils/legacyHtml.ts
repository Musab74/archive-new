/**
 * Legacy CMS content (Notice/Faq/StudyPDS/Course intro) comes from the PHP editor with inline styles written for the
 * old dark theme (white text, fixed fonts) and occasionally scripts. Strip what would break the light theme or safety;
 * keep structural tags so paragraphs, lists, links and images still render.
 */
export function sanitizeLegacyHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(color|face|size|bgcolor|background)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<font\b[^>]*>/gi, '<span>')
    .replace(/<\/font>/gi, '</span>')
    .replace(/javascript:/gi, '');
}

/** True when the string contains HTML tags (legacy content) rather than plain text. */
export const looksLikeHtml = (s: string | null | undefined): boolean => !!s && /<[a-z][\s\S]*>/i.test(s);
