/** Helpers shared by the 역량진단 specs. */
import { expect, type Locator } from '@playwright/test';

/**
 * Checks a (visually hidden) radio / checkbox of the assessment forms. The forms scroll to the top on every step change, so a forced
 * click can land while the page is still moving; retry until the input reports checked.
 */
export async function choose(input: Locator): Promise<void> {
  await expect(async () => {
    await input.check({ force: true, timeout: 2_000 });
    await expect(input).toBeChecked({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
}
