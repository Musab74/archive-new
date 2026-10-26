/**
 * 토론방·라이브 (/live, GET /v1/support/live, POST /v1/support/live/entry) — docs/learner-parity/support.md §2 라이브:
 * the learner's 실시간 강의실 (Course.ctype R) enrolments with their window label, the PHP SSO address
 * (live.hrdeedu.co.kr?token=<JWT>, include/sso_jwt_generator.php), and the stated blocked parts (MongoDB schedules, no 토론방 tables).
 * The harness blocks every non-local request, so the Live Class site is never loaded — the spec asserts the address.
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { jwtPayload } from './helpers';

test.use({ area: 'support' });

test.beforeEach(async ({ page }) => { await hidePopups(page); });

test('guest: login button, no enrolment list, blocked schedule / 토론방 reasons', async ({ page, checks }) => {
  await page.goto('/live');
  await expect(page.getByRole('heading', { level: 1, name: /함께 묻고 배우는/ })).toBeVisible();
  await expect(page.getByRole('link', { name: '라이브 입장은 로그인 후 이용할 수 있습니다.' })).toHaveAttribute('href', `/auth/login?next=${encodeURIComponent('/live')}`);
  await expect(page.getByText('로그인하면 배정된 실시간 강의실 과정과 이용기간을 확인할 수 있습니다.')).toBeVisible();
  await expect(page.getByText(/라이브 일정\(On Air·On Meeting\)과 본인 참여기록은/)).toBeVisible();
  await expect(page.getByText('토론방은 현재 운영하지 않습니다. 학습 관련 질문은 1:1 문의로 남겨 주세요.')).toBeVisible();
  await checks.checkpoint('live-guest');
});

test('my 실시간 강의실: window labels, 입장하기 only while open, entry → PHP SSO address', async ({ page, db, checks }) => {
  await openAs(page, 'xsupport01', '/live');
  const items = page.locator('article').filter({ hasText: '[E2E] 라이브 특강: 생성형 AI 업무 활용' });
  await expect(items).toHaveCount(3);
  // LectureStart DESC: not started (+10 d), open (−5 d), ended (−60 d)
  await expect(items.nth(0)).toContainText('이용 시작 전');
  await expect(items.nth(1)).toContainText('이용 중');
  await expect(items.nth(2)).toContainText('이용기간 종료');
  const open = await db.one<{ a: string; b: string }>("SELECT DATE_FORMAT(LectureStart, '%Y.%m.%d') a, DATE_FORMAT(LectureEnd, '%Y.%m.%d') b FROM Study WHERE Seq = 26102");
  await expect(items.nth(1)).toContainText(`이용기간 ${open!.a} ~ ${open!.b} · 교강사 정라이브`);
  await expect(items.nth(0).getByRole('button', { name: '입장하기' })).toHaveCount(0);
  await expect(items.nth(2).getByRole('button', { name: '입장하기' })).toHaveCount(0);
  await checks.checkpoint('live-mine');
  const tab = page.context().waitForEvent('page');
  const blocked = page.context().waitForEvent('requestfailed', (r) => r.url().startsWith('https://live.hrdeedu.co.kr'));
  const entry = page.waitForResponse((r) => r.url().endsWith('/v1/support/live/entry'));
  await items.nth(1).getByRole('button', { name: '입장하기' }).click();
  const body = await (await entry).json();
  expect(body.records).toBe(false);
  const url = new URL(body.launchUrl);
  expect(`${url.origin}${url.pathname}`).toMatch(/^https:\/\/live\.hrdeedu\.co\.kr\/?$/); // header.html:217-219: LIVE_CLASS_URL + ?token=
  const claims = jwtPayload(url.searchParams.get('token')!);
  expect(claims).toMatchObject({ user_id: 'xsupport01', name: '서포일', email: 'xsupport01@e2e.example', member_type: 'M', role: 'member' });
  expect(Number(claims.exp) - Number(claims.iat)).toBe(7 * 24 * 3600);
  // a new tab towards the Live Class (the harness blocks it: never loaded) and no "새 창을 열지 못했습니다" note
  expect((await blocked).failure()?.errorText).toMatch(/BLOCKED_BY_CLIENT/);
  await (await tab).close().catch(() => undefined);
  await expect(page.getByText('새 창을 열지 못했습니다. 팝업 허용 상태를 확인한 뒤 다시 입장해 주세요.')).toHaveCount(0);
});

test('a learner without live enrolments sees the empty state', async ({ page, checks }) => {
  await openAs(page, 'xsupport02', '/live');
  await expect(page.getByText('배정된 실시간 강의실 과정이 없습니다. 라이브 클래스에서 공개된 수업을 확인할 수 있습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '라이브 클래스 입장' })).toBeVisible();
  await checks.checkpoint('live-empty');
});
