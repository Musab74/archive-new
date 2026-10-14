/** Pure helpers shared by the 커뮤니티관리 / 사이트관리 / 정보수정 pages (unit-tested in test/site-cms.test.tsx). */

export const COUNSEL_STATUS: { value: 'A' | 'B'; label: string }[] = [{ value: 'A', label: '대기' }, { value: 'B', label: '완료' }];
export const STA_YEARS = Array.from({ length: 14 }, (_, i) => 2017 + i); // sta.php 2017..2030
export const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** my_info.php splits "010-1234-5678" into three inputs; anything without two hyphens goes into the first box. */
export function splitPhone(v: string | null | undefined): [string, string, string] {
  const parts = String(v ?? '').split('-');
  if (parts.length >= 3) return [parts[0] ?? '', parts[1] ?? '', parts.slice(2).join('')];
  return [parts[0] ?? '', parts[1] ?? '', ''];
}
export function joinPhone(a: string, b: string, c: string): string {
  const p = [a, b, c].map((s) => s.replace(/\D/g, ''));
  return p.every((s) => !s) ? '' : p.join('-');
}

/** day part of a datetime string ("2026-10-01 08:10:00" → "2026-10-01"). */
export const dayOf = (v: string | null | undefined): string => (v ? String(v).slice(0, 10) : '');

/** 8-digit yyyymmdd → "yyyy-mm-dd" for display (popup 마감일). */
export const ymd8ToIso = (v: string | null | undefined): string => (v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v ?? '');
export const isoToYmd8 = (v: string): string => v.replace(/-/g, '');

/** isContinuedValue(str, limit) from my_info.php. */
export function isContinuedValue(str: string, limit = 4): boolean {
  let o = 0; let d = NaN; let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (i > 0) {
      const p = o - c;
      if (p > -2 && p < 2) { n = p === d ? n + 1 : 0; if (n > limit - 3) return true; }
      d = p;
    }
    o = c;
  }
  return false;
}

/** my_info.php CheckPassword(): '' when valid, otherwise the legacy alert text. The API applies the same rule. */
export function staffPasswordError(pw: string): string {
  if (/(\w)\1\1\1\1\1/.test(pw) || isContinuedValue(pw, 6)) return '비밀번호에 6자 이상의 연속 또는 반복 문자 및 숫자를 사용하실 수 없습니다.';
  const classes = [/[a-zA-Z]/.test(pw), /[0-9]/.test(pw), /[!@#$%^*+=-]/.test(pw)].filter(Boolean).length;
  return (pw.length >= 10 && classes >= 2) || (pw.length >= 8 && classes === 3) ? '' : '비밀번호는 영문, 숫자, 특수문자 중 2개 이상의 조합으로 10자 이상 또는 3개 이상의 조합으로 8자 이상 사용하세요.';
}

/** popup_reg.php send_ok() checks: required + numeric. Returns field → message. */
export function validatePopupForm(f: { EndDate: string; Title: string; ImgWidth: string; ImgHeight: string; PopupLeft: string; PopupTop: string; ImgWidthMobile: string; ImgHeightMobile: string; PopupLeftMobile: string; PopupTopMobile: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.EndDate) e.EndDate = '마감일을 입력하세요.'; else if (!/^\d{8}$/.test(f.EndDate)) e.EndDate = '마감일은 숫자 8자리(yyyymmdd)로 입력 하세요';
  if (!f.Title.trim()) e.Title = '제목을 입력하세요.';
  for (const [k, msg] of [['ImgWidth', '이미지 사이즈'], ['ImgHeight', '이미지 사이즈'], ['PopupLeft', '팝업 좌측 위치'], ['PopupTop', '팝업 상단 위치']] as const) {
    const v = f[k];
    if (!v) e[k] = `${msg}를 입력하세요.`; else if (!/^\d{1,4}$/.test(v)) e[k] = `${msg}는 숫자만 입력 하세요`;
  }
  for (const k of ['ImgWidthMobile', 'ImgHeightMobile', 'PopupLeftMobile', 'PopupTopMobile'] as const) if (f[k] && !/^\d{1,4}$/.test(f[k])) e[k] = '숫자만 입력 하세요';
  return e;
}

/** edudata list numbering: the legacy page shows "공지" for pinned rows and counts down for the rest. */
export const rowNumber = (total: number, page: number, size: number, index: number): number => total - (page - 1) * size - index;
