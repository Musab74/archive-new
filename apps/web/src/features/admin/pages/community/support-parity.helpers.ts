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

/** inquiry_read.php shows nl2br(Contents); keep line breaks when rendering plain text. */
export const nl2br = (s: string | null | undefined): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>');
