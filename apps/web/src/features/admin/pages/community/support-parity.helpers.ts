/** Pure helpers for the 커뮤니티관리 / 수강신청관리 parity pages (unit-tested in test/support-parity.test.tsx). */

/** PHP $PAGE_UNCOUNT: 번호 counts down from the total. */
export const rowNo = (total: number, page: number, size: number, index: number): number => total - (page - 1) * size - index;

/** qna.php 처리상태 checkboxes (전체 / 대기 / 완료) → StatusFilter: '' (all), 'A', 'B' or 'A,B'. */
export function statusFilterOf(wait: boolean, done: boolean): string {
  return [wait ? 'A' : '', done ? 'B' : ''].filter(Boolean).join(',');
}
export function statusChecks(v: string): { all: boolean; wait: boolean; done: boolean } {
  const parts = v.split(',').map((s) => s.trim());
  const wait = parts.includes('A'); const done = parts.includes('B');
  return { all: !wait && !done, wait, done };
}

/** Information_protection_regist2 client check (same as the server): 한글/영문/숫자/공백만. */
export function revealReasonError(reason: string): string {
  const r = reason.trim();
  if (!r) return '사유를 입력하세요.';
  if (!/^[가-힣a-zA-Z0-9\s]+$/u.test(r)) return '사유에는 한글, 영문, 숫자, 공백만 입력 가능합니다.';
  return '';
}

/** SubmitOk() of notice_write / qna_read / inquiry_read: the editor content must be 15+ characters. */
export const tooShort = (html: string): boolean => html.length < 15;

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The entities Replace_Check_XSS2 (include_function.php) and htmlspecialchars write into stored text: '<s' → '&lt;s', '<f' → '&lt;f'.
 * PHP prints the stored value raw, so the browser shows '<s'; decoding them first keeps that look without rendering markup.
 */
export function decodeStoredEntities(s: string): string {
  return s.replace(/&(lt|gt|quot|#0*39|apos|amp);/gi, (_m, e: string) => {
    const k = e.toLowerCase();
    return k === 'lt' ? '<' : k === 'gt' ? '>' : k === 'quot' ? '"' : k === 'amp' ? '&' : "'";
  });
}

/**
 * inquiry_read.php shows nl2br(Contents). The stored entities are decoded once (so '&lt;s' reads '<s' like the PHP page) and the
 * text is escaped again, so the visible text matches while no markup from the public form can render.
 */
export const nl2br = (s: string | null | undefined): string => escapeHtml(decodeStoredEntities(String(s ?? ''))).replace(/\r?\n/g, '<br>');

/** True when the string already carries HTML markup (SmartEditor2 output) rather than plain text. */
export const looksLikeHtml = (s: string | null | undefined): boolean => /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>/i.test(String(s ?? ''));

/** SmartEditor2 TEXT → Editor: plain text becomes HTML with <br> line breaks. */
export const textToHtml = (s: string): string => escapeHtml(s).replace(/\r?\n/g, '<br>');

/**
 * Value handed to the rich editor: SmartEditor2 HTML stays as is; a plain-text answer (old rows, or typed in a textarea) keeps its
 * line breaks the way inquiry_read.php loads nl2br(Contents2) into the editor.
 */
export const toEditorHtml = (s: string | null | undefined): string => { const v = String(s ?? ''); return !v || looksLikeHtml(v) ? v : textToHtml(v); };

/** SmartEditor2 Editor → TEXT: markup removed, <br>/<p>/<div>/<li> become line breaks, entities decoded. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');
  return decodeStoredEntities(withBreaks.replace(/&nbsp;/gi, ' ')).replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}

const DROP_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'meta', 'link', 'base', 'form', 'input', 'button', 'textarea', 'select', 'frame', 'frameset'];

/**
 * Cleans HTML pasted into the editor (Word / web pages): removes active elements, event handlers and javascript: URLs.
 * The HTML source tab is not filtered, as SmartEditor2's HTML mode was not.
 */
export function sanitizePastedHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return textToHtml(html.replace(/<[^>]+>/g, ''));
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll(DROP_TAGS.join(',')).forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const name = a.name.toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action') && /^\s*(javascript|vbscript|data:text\/html)/i.test(a.value))) el.removeAttribute(a.name);
    }
  });
  doc.body.innerHTML = doc.body.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
  return doc.body.innerHTML;
}

/** Page size of every hrd_manager list (include_top.php $page_size = 30). */
export const PHP_PAGE_SIZE = 30;
