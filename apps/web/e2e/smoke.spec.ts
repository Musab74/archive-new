/**
 * Harness smoke: one pass through the main learner/manager surfaces on both viewports, proving the stack, the fixtures and the
 * helpers work. Area specs go deeper (e2e/<area>/*.spec.ts).
 */
import { test, expect, dismissPopups, hidePopups } from './support/test';
import { ACCOUNTS, COURSES } from './support/accounts';
import { loginViaUi, openAs } from './support/login';
import { clearPlayLock, progressLogCount, progressRows } from './support/db';

test.use({ area: 'smoke' });

test('guest home renders with the fixture catalog and the site popup', async ({ page, checks }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '로그인' }).first()).toBeVisible();
  // the active fixture popup (9801) opens for guests; the expired one (9802) must not
  const popups = page.getByLabel('알림 팝업', { exact: true }).getByRole('dialog');
  await expect(popups).toHaveCount(1);
  await expect(popups.first()).toHaveAttribute('aria-label', '[E2E] 신규 과정 오픈 안내');
  await checks.checkpoint('guest-home-popup');
  expect(await dismissPopups(page)).toBe(1);
  await expect(page.getByText(COURSES.E2EX01.title).first()).toBeVisible();
  await checks.checkpoint('guest-home');
});

test('the browser never leaves the local stack', async ({ page, checks }) => {
  // support/test.ts aborts every non-127.0.0.1 request before it is sent (live site, PHP site, providers)
  await expect(page.goto('https://example.com/')).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/);
  expect(checks.external).toContain('https://example.com/');
});

test('learner login routes to the learning home and records the login', async ({ page, checks, db, clientIp }, testInfo) => {
  const me = ACCOUNTS.e2elearn01;
  await hidePopups(page);
  const before = Number(await db.scalar<number>('SELECT COUNT(*) FROM LoginHistory WHERE ID = ?', [me.id]));
  await loginViaUi(page, me.id); // next=home → /home
  await expect(page.getByText('이어서 학습하기').first()).toBeVisible();
  await expect(page.getByText(`${me.name} 님`).first()).toBeAttached(); // header (inside the menu drawer on phones)
  await checks.checkpoint('learner-home');
  const last = await db.one<{ Device: string; IP: string; c: number }>('SELECT Device, IP, (SELECT COUNT(*) FROM LoginHistory WHERE ID = ?) AS c FROM LoginHistory WHERE ID = ? ORDER BY idx DESC LIMIT 1', [me.id, me.id]);
  expect(last?.c).toBe(before + 1);
  expect(last?.Device).toBe(testInfo.project.name === 'phone' ? 'Mobile' : 'PC'); // login_ok.php 'PC' / m/…/login_ok.php 'Mobile'
  expect(last?.IP).toBe(clientIp);
  expect(await db.scalar<number>('SELECT COUNT(*) FROM LoginIng WHERE ID = ?', [me.id])).toBe(1);
});

test('my room shows the 15-hour clock of the seeded enrollment', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'e2elearn01', '/my');
  await expect(page.getByText('김학습님의 학습실')).toBeVisible();
  await expect(page.getByText('14시간 59분 / 15시간 이상')).toBeVisible(); // 53,940 s seeded
  await expect(page.getByText(COURSES.E2EX01.title).first()).toBeVisible();
  await checks.checkpoint('my-room');
});

test('catalog detail opens', async ({ page, checks }) => {
  await hidePopups(page);
  await page.goto('/courses/E2EX01');
  await expect(page.getByRole('heading', { name: COURSES.E2EX01.title })).toBeVisible();
  await expect(page.getByText('김데이터').first()).toBeVisible();
  await checks.checkpoint('course-detail');
});

test('notice attachment downloads with its original name', async ({ page, checks, db }) => {
  const views = Number(await db.scalar<number>('SELECT ViewCount FROM Notice WHERE idx = 9701'));
  await hidePopups(page);
  await page.goto('/support/notice/9701'); // guest
  await expect(page.getByText('[E2E] 학습 이용 안내').first()).toBeVisible();
  await checks.checkpoint('notice-detail');
  const dl = page.waitForEvent('download');
  await page.getByRole('link', { name: 'E2E_학습안내서.pdf' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('E2E_학습안내서.pdf');
  expect(file.url()).toMatch(/\/v1\/support\/notices\/9701\/files\/1$/);
  expect(Number(await db.scalar<number>('SELECT ViewCount FROM Notice WHERE idx = 9701'))).toBeGreaterThan(views);
});

test('player opens a lesson and the Start save writes Progress + ProgressLog', async ({ page, checks, db }) => {
  const me = ACCOUNTS.e2elearn01;
  const ch = COURSES.E2EY01.chapters[0];
  await clearPlayLock(me.id); // a previous run's window may still hold the 90 s lock
  const logsBefore = await progressLogCount(me.id, me.studySeq!, ch.chapterSeq);
  await hidePopups(page);
  await openAs(page, me.id, `/learn/${me.studySeq}/${ch.chapterSeq}?lectureCode=E2EY01`);
  await expect(page.getByText('엑셀 단축키 TOP 5').first()).toBeVisible();
  const tick = page.waitForResponse((r) => r.url().endsWith('/v1/player/progress') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '학습 시작하기' }).click();
  const res = await tick;
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ChkError).not.toBe('F');
  await expect.poll(() => progressLogCount(me.id, me.studySeq!, ch.chapterSeq)).toBe(logsBefore + 1);
  const rows = await progressRows(me.id, me.studySeq!, 'E2EY01');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ Chapter_Seq: ch.chapterSeq, Contents_idx: ch.contentsIdx, Chapter_Number: '1' });
  expect(rows[0].StudyTime).toBeLessThanOrEqual(COURSES.E2EY01.minutesPerChapter * 60); // first save of a chapter cannot credit more than the cap
  await checks.checkpoint('player', { settle: false });
  // leave the window so the pagehide release frees the PlayLock for the next test
  await page.goto('/my');
  await expect.poll(() => db.scalar<number>('SELECT COUNT(*) FROM PlayLock WHERE ID = ?', [me.id])).toBe(0);
});

test('manager dashboard opens scoped to his companies', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'e2emgr01', '/manager');
  await expect(page.getByText('2개 기업 · 전체 합계')).toBeVisible();
  await expect(page.getByRole('heading', { name: '기업 운영현황' }).first()).toBeVisible();
  await checks.checkpoint('manager-overview');
  await page.goto('/manager/trainees');
  await expect(page.getByText('e2elearn01').first()).toBeVisible();
  await expect(page.getByText('e2ebco01').first()).toBeVisible(); // company B via MemberCompany
  await expect(page.getByText('e2ecco01')).toHaveCount(0); // company C: not his
  await expect(page.getByText('test01')).toHaveCount(0); // base company: not his
  await checks.checkpoint('manager-trainees');
});
