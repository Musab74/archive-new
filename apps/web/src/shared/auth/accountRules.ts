import { LEGACY_ADMIN_BASE } from './adminMenu';

/**
 * Account rules the PHP member screens check in the browser (include/function.js) — the API checks the same rules again
 * (apps/api/src/modules/auth/password.ts, members.helpers.ts), so these only give the learner the message early.
 */

export const PASSWORD_RULE_MESSAGE = '비밀번호는 영문, 숫자, 특수문자 중 2개 이상의 조합으로 10자 이상 또는 3개 이상의 조합으로 8자 이상 사용하세요.';
export const PASSWORD_REPEAT_MESSAGE = '비밀번호에 6자 이상의 연속 또는 반복 문자 및 숫자를 사용하실 수 없습니다.';

/** function.js isContinuedValue(str, limit): `limit` characters stepping by the same -1/0/+1 code-unit difference. */
export function isContinuedValue(str: string, limit = 4): boolean {
  let o: number | undefined;
  let d: number | undefined;
  let p: number | undefined;
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (i > 0) {
      p = (o as number) - c;
      if (p > -2 && p < 2) {
        n = p === d ? n + 1 : 0;
        if (n > limit - 3) return true;
      }
    }
    d = p;
    o = c;
  }
  return false;
}

/** function.js CheckPassword(): the PHP alert text, or null when acceptable. */
export function passwordPolicyError(pw: string): string | null {
  if (/(\w)\1\1\1\1\1/.test(pw) || isContinuedValue(pw, 6)) return PASSWORD_REPEAT_MESSAGE;
  const letter = /[a-z]/i.test(pw);
  const digit = /[0-9]/.test(pw);
  const special = /[!@#$%^*+=-]/.test(pw);
  if (pw.length >= 10) { if ((letter && digit) || (letter && special) || (digit && special)) return null; }
  else if (pw.length >= 8) { if (letter && digit && special) return null; }
  return PASSWORD_RULE_MESSAGE;
}

/** function.js ID_Validity(): 6-20 characters, letters and digits only. */
export function loginIdError(id: string): string | null {
  if (!id) return '아이디를 입력하세요.';
  if (id.length < 6 || id.length > 20) return '아이디는 6자이상 20자 이내로 입력하세요.';
  if (!/^[a-zA-Z0-9]+$/.test(id)) return '아이디는 영문/숫자만 입력 가능합니다.';
  return null;
}

/** function.js chkEmail(). */
export const isPhpEmail = (s: string) => /^([0-9a-zA-Z_.-]+)@([0-9a-zA-Z_-]+)(\.[0-9a-zA-Z_-]+){1,2}$/.test(s);

/** Mobile typed as 01012345678 or 010-1234-5678 (PHP Mobile01-02-03, digits only). */
export const isMobile = (s: string) => /^\d{2,3}-?\d{3,4}-?\d{4}$/.test(s.trim());

/**
 * 휴대폰 본인인증 (NICE) and SMS still run on the existing PHP site, which shares the same accounts. Screens whose step needs
 * them link to the same screen there. Base = the legacy admin URL without /hrd_manager.
 */
export const LEGACY_SITE_URL = LEGACY_ADMIN_BASE.replace(/\/hrd_manager$/, '');
export const LEGACY_MEMBER_PAGES = {
  join: `${LEGACY_SITE_URL}/public/member/join_terms.html`,
  findId: `${LEGACY_SITE_URL}/public/member/find_id.html`,
  findPassword: `${LEGACY_SITE_URL}/public/member/find_pw.html`,
  memberInfo: `${LEGACY_SITE_URL}/public/mypage/memberinfo.html`,
};

/**
 * m/m_public/member/pwd_first_change.html 「나중에 변경하기」: the PHP sets a SkipPasswordChange cookie for 90 days and the
 * login then skips the forced password change. Kept per browser here (localStorage, per id).
 */
const SKIP_KEY = 'auth.skipPasswordChange.v1';
const SKIP_MS = 90 * 24 * 60 * 60 * 1000;
export function rememberPasswordSkip(id: string): void {
  try { const all = JSON.parse(localStorage.getItem(SKIP_KEY) ?? '{}') as Record<string, number>; all[id] = Date.now() + SKIP_MS; localStorage.setItem(SKIP_KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
}
export function hasPasswordSkip(id: string): boolean {
  try { const all = JSON.parse(localStorage.getItem(SKIP_KEY) ?? '{}') as Record<string, number>; return (all[id] ?? 0) > Date.now(); } catch { return false; }
}
