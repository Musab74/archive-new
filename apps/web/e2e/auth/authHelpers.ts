/**
 * Helpers shared by the 회원/인증 specs (e2e/auth/*.spec.ts). Accounts xauth* come from e2e/fixtures/auth.sql; the PHP reference
 * hashes below were computed with the PHP site's own KISA SHA-256 + Replace_Check_XSS2 (include/include_function.php).
 */
import type { Page, TestInfo } from '@playwright/test';
import { expect } from '../support/test';
import { db } from '../support/db';

/** SHA-256 of '1111' — every seeded learner password. */
export const HASH_1111 = '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c';

/** Passwords with characters Replace_Check_XSS2 escapes or drops, and the hash login_ok.php compares (fixtures/auth.sql). */
export const SPECIAL = {
  /** quote, double quote, backslash, `--` → posted as Ab\'cd\"ef\\ghij1! */
  xauthq01: { password: `Ab'cd"ef\\gh--ij1!`, hash: '39cc7b7fbe8b8866f61fa13a46b5d79f3a70c8a19dafc31f01ba11cbbec45451' },
  /** "type" and "--" are removed, "Hex" stays (case-sensitive) → posted as Hex2026! */
  xauthq02: { password: 'Hex-type-2026!', hash: '64a55631b057b920f8c42b0a9f38f0d7286135349343dd37de29d61b49a5e58b' },
} as const;

/** New passwords used by the change specs, with the hash the PHP join/first-change handlers would store. */
export const NEW_PASSWORDS = {
  /** passes CheckPassword (3 kinds, 13 chars); contains a quote → stored as SHA-256("O\'Neil\"2026!x") */
  quoted: { password: `O'Neil"--2026!x`, hash: '0ab3a589d4f540f9c5fff133e6137ef9894c4553923d69dd204605b1da6f0c1d' },
  plain: { password: 'Newpass#2026a', hash: 'bf38ea0168583d678d2e2dd731c4e90536a04a5810c8926d9998c7c08d4ef985' },
} as const;

export const isPhone = (info: TestInfo) => info.project.name === 'phone';

/** The PHP-text messages the API answers for refused logins (login_ok.php alerts). */
export const LOGIN_MESSAGES = {
  invalid: '아이디 또는 비밀번호를 잘못 입력했습니다.',
  dormant: '현재 휴면계정 상태입니다. [휴면계정 복구] 메뉴를 통해 계정을 복구하세요.',
  withdrawn: '탈퇴한 회원입니다.',
  tooMany: '로그인 시도가 너무 많습니다. 1분 후에 다시 시도해 주세요.',
} as const;

/** Puts an xauth account back to its fixture state (password 1111 unless given, flags, no session rows). */
export async function resetMember(id: string, set: Record<string, string | null> = {}): Promise<void> {
  const fields = { Pwd: HASH_1111, ...set };
  const cols = Object.keys(fields);
  await db.exec(`UPDATE Member SET ${cols.map((c) => `\`${c}\` = ?`).join(', ')} WHERE ID = ?`, [...cols.map((c) => fields[c as keyof typeof fields]), id]);
  await db.exec('DELETE FROM LoginIng WHERE ID = ?', [id]);
}

/** The form message under the login button (FormMessage role=alert). */
export const loginFormMessage = (page: Page) => page.locator('form').getByRole('alert');

/** Fills /auth/login and submits (no navigation assertion). */
export async function submitLogin(page: Page, id: string, password: string): Promise<void> {
  await page.locator('#login-id').fill(id);
  await page.locator('#login-pw').fill(password);
  await page.locator('form').getByRole('button', { name: '로그인', exact: true }).click();
}

/** Clicks 로그아웃 where the viewport shows it: the header bar on desktop, the 전체메뉴 drawer on phones. */
export async function logoutViaHeader(page: Page, info: TestInfo): Promise<void> {
  if (isPhone(info)) {
    await page.getByRole('button', { name: '전체메뉴' }).filter({ visible: true }).first().click();
    await page.getByRole('dialog', { name: '전체메뉴' }).getByRole('button', { name: '로그아웃' }).click();
  } else {
    await page.locator('header').getByRole('button', { name: '로그아웃' }).click();
  }
}

/** Opens the site menu the viewport uses (desktop mega menu / phone drawer) and returns the dialog. */
export async function openSiteMenu(page: Page) {
  await page.getByRole('button', { name: '전체메뉴' }).filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '전체메뉴' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Decodes a JWT payload (no verification — the API signed it; the spec checks the claims). */
export function jwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>;
}

export const count = async (sql: string, params: unknown[] = []) => Number((await db.scalar<number>(sql, params)) ?? 0);

/** A fresh 10.78.x.y client address (for limits the API keeps per IP across runs: signup 5/10 min, 인증번호 sends 5/15 min). */
export const randomIp = () => `10.78.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
