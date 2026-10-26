/**
 * Small helpers shared by the catalog-area specs (home, catalog, content detail, AI ZONE, chatbots). Not a spec file.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from '../support/test';
import { db } from '../support/db';

export const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1440) < 768;

/** LectureCodes of the content cards inside `scope`, in DOM order (the card title link is /courses/<code>). */
export async function cardCodes(scope: Locator): Promise<string[]> {
  return scope.locator('article a[href^="/courses/"]').evaluateAll((els) =>
    els.map((e) => decodeURIComponent((e.getAttribute('href') ?? '').replace(/^\/courses\//, ''))));
}

/** Waits until the cards inside `scope` are exactly `codes` (in this order). */
export async function expectCards(scope: Locator, codes: string[], message?: string): Promise<void> {
  await expect.poll(() => cardCodes(scope), { message: message ?? `cards ${codes.join(', ')}`, timeout: 10_000 }).toEqual(codes);
}

/** The visible catalog results grid (the only content cards on /catalog). */
export const catalogGrid = (page: Page): Locator => page.locator('main');

/** Opens the radix select labelled `label` and picks the option `option`. */
export async function pickSelect(page: Page, label: string | RegExp, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Options the radix select labelled `label` currently offers. */
export async function selectOptions(page: Page, label: string | RegExp): Promise<string[]> {
  await page.getByRole('combobox', { name: label }).click();
  const opts = await page.getByRole('option').allInnerTexts();
  await page.keyboard.press('Escape');
  return opts.map((t) => t.trim());
}

/**
 * Catalog filter controls: the desktop sidebar is used directly; on phones the "분야·유형 선택" sheet is opened, the clicks
 * are made inside it and 적용 is pressed (FilterSheet keeps a draft until then).
 */
export async function applyFilters(page: Page, clicks: Array<{ group: '역량' | '세부 분야' | '콘텐츠 유형'; label: string }>): Promise<void> {
  const phone = isPhone(page);
  let scope: Locator = page.getByRole('complementary', { name: '분야·유형' });
  if (phone) {
    await page.getByRole('button', { name: /분야·유형 선택/ }).click();
    scope = page.getByRole('dialog', { name: '분야·유형' });
    await expect(scope).toBeVisible();
  }
  for (const c of clicks) {
    await scope.getByRole('group', { name: c.group }).getByRole('button', { name: c.label, exact: true }).click();
  }
  if (phone) await scope.getByRole('button', { name: '적용', exact: true }).click();
}

/** Temporary visible courses for paging / cap tests (ids 21100+); always removed with dropTempCourses(). */
export async function addTempCourses(n: number, opts: { package?: boolean; prefix?: string } = {}): Promise<string[]> {
  const prefix = opts.prefix ?? 'XCATP';
  const codes: string[] = [];
  for (let i = 1; i <= n; i++) {
    const code = `${prefix}${String(i).padStart(2, '0')}`;
    codes.push(code);
    await db.exec(`INSERT INTO Course (idx, ctype, LectureCode, ClassGrade, UseYN, Category1, Category2, Keyword1, Keyword2, Keyword3, Keyword4, ServiceType, ContentsName, ContentsTime, Mobile, BookPrice, PreviewImage, Intro, EduTarget, EduGoal, Del, RegDate, ContentsURLSelect, ContentsURL, MobileURL, Chapter, ContentsStart, ContentsEnd, UploadDate, PackageYN, PackageRef, PackageLectureCode, cnt, Professor, Price, PassTime)
      VALUES (?, ?, ?, 'A', 'Y', 9020, 9022, '사원', '', '', '', ?, ?, '10', 'Y', 0, NULL, '<p>임시</p>', '전 직원', '임시 과정', 'N', DATE_SUB(NOW(), INTERVAL ? DAY), 'A', '', '', '1', '2026-01-01', '2026-12-31', NOW(), ?, 0, '', 0, '임시', 0, 0)`,
    [21100 + i + (opts.package ? 100 : 0), opts.package ? 'A' : 'X', code, opts.package ? 'A' : 'X', `[E2E 임시] ${prefix} ${String(i).padStart(2, '0')}`, 200 + i, opts.package ? 'Y' : 'N']);
  }
  return codes;
}

export async function dropTempCourses(prefix = 'XCATP'): Promise<void> {
  await db.exec('DELETE FROM ContentsList WHERE LectureCode LIKE ?', [`${prefix}%`]);
  await db.exec('DELETE FROM Course WHERE LectureCode LIKE ? AND idx BETWEEN 21100 AND 21399', [`${prefix}%`]);
}
