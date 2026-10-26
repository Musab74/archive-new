/**
 * 학습창 entry gates in player2.php order (player2.php:62-924; enrollment_resolver.php): enrollment / 수강기간, 사전역량진단, 조회수, chapter,
 * 8-hour daily gate (TestID exempt), 본인인증 (입과 00 / 진도 01). Every blocked case asserts the exact message, that no PlayLock was taken,
 * that no media and no progress save was requested, and what was (not) written.
 */
import type { Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { openAs, loginViaApi } from '../support/login';
import { db } from '../support/db';
import { ACCOUNTS, COURSES } from '../support/accounts';
import { XP, resetLearner, leavePlayer } from './kit';

test.use({ area: 'player' });

const CH1 = COURSES.E2EX01.chapters[0];
const PERIOD_MSG = '수강기간이 종료되었습니다.\n문의 1811-9530';
const lockCount = (id: string) => db.scalar<number>('SELECT COUNT(*) FROM PlayLock WHERE ID = ?', [id]);
const courseCnt = async (code: string) => Number(await db.scalar('SELECT cnt FROM Course WHERE LectureCode = ?', [code]));

/** Records every /contents (media) request and every progress save the page makes. */
function watchTraffic(page: Page) {
  const media: string[] = [];
  const saves: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/contents/') || u.pathname.startsWith('/contents-hls/')) media.push(u.pathname);
    if (u.pathname === '/v1/player/progress') saves.push(r.postData() ?? '');
  });
  return { media, saves };
}

async function openSession(page: Page, token: string, body: Record<string, unknown>) {
  const res = await page.request.post('/v1/player/session', { data: body, headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status(), body: await res.json() };
}

test('수강기간: expired (e2eexp01) and not yet started (e2esoon01) both answer the PHP 수강기간 message; nothing is counted or locked', async ({ page, checks }) => {
  for (const id of ['e2eexp01', 'e2esoon01'] as const) {
    const me = ACCOUNTS[id];
    const cnt = await courseCnt('E2EX01');
    const traffic = watchTraffic(page);
    checks.allow(/\/v1\/player\/session$/, 403);
    await hidePopups(page);
    await openAs(page, id, `/learn/${me.studySeq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
    const block = page.locator('[data-state="ENDED"]');
    await expect(block).toBeVisible();
    // enrollment_resolver.php:217-240 (historical match) — PHP has no separate "not started" text in the player either (player2.php:164-172)
    await expect(block).toContainText('수강기간이 종료되었습니다.');
    await expect(block).toContainText('문의 1811-9530');
    await expect(block.getByRole('heading')).toHaveText('이용기간이 종료되었습니다');
    await checks.checkpoint(`period-${id}`);
    expect(await lockCount(id)).toBe(0);
    expect(traffic.media).toEqual([]);
    expect(traffic.saves).toEqual([]);
    expect(await courseCnt('E2EX01')).toBe(cnt); // the resolver blocks before 조회수 (player2.php:98-112 then 155-160)
    await page.context().clearCookies();
  }
});

test('enrollment resolver: E2EX02 (not in ARC2026) → PERIOD_EXPIRED with a Study_Seq, NO_ACCESS without one (both as enrollment_resolver.php)', async ({ page, checks }) => {
  const me = ACCOUNTS.e2elearn01;
  const login = await loginViaApi(page, me.id);
  // with Study_Seq: StudyLectureCode = ARC2026 (player2.php:63-69) → historical match on the ARC2026 row → 수강기간 message
  const withSeq = await openSession(page, login.accessToken, { lectureCode: 'E2EX02', chapterNumber: '1', studySeq: me.studySeq });
  expect(withSeq.status).toBe(403);
  expect(withSeq.body.error).toMatchObject({ code: 'PERIOD_EXPIRED', message: PERIOD_MSG, details: { hasHistoricalMatch: true, isPackageChild: false } });
  // without: StudyLectureCode falls back to the content code (player2.php:70-78) → standalone live course → auto_enroll_allowed → player2.php:102 default text
  const without = await openSession(page, login.accessToken, { lectureCode: 'E2EX02', chapterNumber: '1' });
  expect(without.status).toBe(403);
  expect(without.body.error).toMatchObject({ code: 'NO_ACCESS', message: '이 과정에 대한 활성 수강 정보가 없습니다.', details: { status: 'auto_enroll_allowed' } });
  // the SPA route always carries the enrollment → the 기간 종료 state
  checks.allow(/\/v1\/player\/session$/, 403);
  await hidePopups(page);
  await page.goto(`/learn/${me.studySeq}/${COURSES.E2EX02.chapters[0].chapterSeq}?lectureCode=E2EX02`);
  await expect(page.locator('[data-state="ENDED"]')).toContainText('수강기간이 종료되었습니다.');
  await checks.checkpoint('resolver-e2ex02');
  // unknown chapter order → player2.php:231-232
  const noChapter = await openSession(page, login.accessToken, { lectureCode: 'E2EX01', chapterNumber: '9', studySeq: me.studySeq });
  expect(noChapter).toMatchObject({ status: 404, body: { error: { code: 'NOT_FOUND', message: '강의 정보를 찾을 수 없습니다.' } } });
  expect(await lockCount(me.id)).toBe(0);
});

test('사전역량진단 required (e2epre01): blocked before 조회수, CTA to /assessment/pre, no lock / media / save', async ({ page, checks }) => {
  const me = ACCOUNTS.e2epre01;
  const cnt = await courseCnt('E2EX01');
  const traffic = watchTraffic(page);
  checks.allow(/\/v1\/player\/session$/, 403);
  await hidePopups(page);
  await openAs(page, me.id, `/learn/${me.studySeq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  const block = page.locator('[data-state="AUTH"]');
  await expect(block).toContainText('현재 수강 차수의 사전역량진단을 먼저 완료해주세요.');
  await checks.checkpoint('pre-required');
  expect(await courseCnt('E2EX01')).toBe(cnt); // player2.php:132-152 exits before the cnt+1 at :155-160
  expect(await lockCount(me.id)).toBe(0);
  expect(traffic.media).toEqual([]);
  expect(traffic.saves).toEqual([]);
  await block.getByRole('link', { name: '사전역량진단 하기' }).click();
  await expect(page).toHaveURL(/\/assessment\/pre$/);
});

test('본인인증 입과 (e2enocert01): 00 message, 서약 checkbox before the legacy popup, popup URL, no lock / media / save; 조회수 counted', async ({ page, checks }) => {
  const me = ACCOUNTS.e2enocert01;
  const cnt = await courseCnt('E2EX01');
  const traffic = watchTraffic(page);
  await hidePopups(page);
  await openAs(page, me.id, `/learn/${me.studySeq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  const modal = page.getByRole('dialog', { name: '과정 입과 본인인증이 필요합니다' });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('과정입과 시 본인인증이 필요합니다.'); // player2.php:843
  await checks.checkpoint('identity-00');
  const openBtn = modal.getByRole('button', { name: '본인인증 창 열기' });
  await expect(openBtn).toBeDisabled(); // play_study_auth.php:51-56 — 부정훈련 금지서약 first
  await modal.getByText('유의사항을 숙지했으며 부정훈련 금지서약에 동의합니다.').click();
  const popupReq = page.context().waitForEvent('request', (r) => r.url().includes('/player/motp.php'));
  await openBtn.click();
  const url = new URL((await popupReq).url());
  expect(url.origin + url.pathname).toBe('https://www.hrdeedu.co.kr/player/motp.php');
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ EvalCd: '00', LectureCode: 'E2EX01', COURSE_AGENT_PK: 'ARC2026', CLASS_AGENT_PK: 'ARC2026,9301', Study_Seq: String(me.studySeq), class_tme: '1', Chapter_Number: '1', Chapter_Seq: String(CH1.chapterSeq), Contents_idx: String(CH1.contentsIdx), mode: 'S' });
  expect(await lockCount(me.id)).toBe(0); // player2.php:884-888 releases the lock before the popup
  expect(traffic.media).toEqual([]);
  expect(traffic.saves).toEqual([]);
  expect(await courseCnt('E2EX01')).toBe(cnt + 1); // 조회수 runs before the 본인인증 gate (player2.php:155-160)
});

test('본인인증 진도 (e2eauth01): 01 message and popup query; 「인증 다시 확인」 after a cert row of today opens the lesson', async ({ page, checks, db: d }) => {
  const me = ACCOUNTS.e2eauth01;
  await d.exec('DELETE FROM UserCertOTP WHERE ID = ? AND EvalCD <> ?', [me.id, '00']);
  const traffic = watchTraffic(page);
  await hidePopups(page);
  await openAs(page, me.id, `/learn/${me.studySeq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  const modal = page.getByRole('dialog', { name: '오늘의 본인인증이 필요합니다' });
  await expect(modal).toContainText('학습 진행 시 본인인증이 필요합니다.'); // player2.php:857
  await checks.checkpoint('identity-01');
  const mode = (await d.scalar<number>('SELECT COUNT(*) FROM Progress WHERE ID = ? AND Study_Seq = ? AND Chapter_Seq = ?', [me.id, me.studySeq, CH1.chapterSeq])) ? 'C' : 'S';
  const popupReq = page.context().waitForEvent('request', (r) => r.url().includes('/player/motp.php'));
  await modal.getByRole('button', { name: '본인인증 창 열기' }).click();
  const q = Object.fromEntries(new URL((await popupReq).url()).searchParams);
  // player2.php:917 — class_tme / Chapter_Number = OrderByNum, course/class keys from the enrollment (never the package child code)
  expect(q).toEqual({ class_tme: '1', Chapter_Number: '1', EvalCd: '01', LectureCode: 'E2EX01', COURSE_AGENT_PK: 'ARC2026', CLASS_AGENT_PK: 'ARC2026,9301', Study_Seq: String(me.studySeq), Chapter_Seq: String(CH1.chapterSeq), Contents_idx: String(CH1.contentsIdx), mode });
  expect(await lockCount(me.id)).toBe(0);
  expect(traffic.media).toEqual([]);
  expect(traffic.saves).toEqual([]);
  // still not verified → the same gate again
  await modal.getByRole('button', { name: '인증 다시 확인' }).click();
  await expect(page.getByRole('dialog', { name: '오늘의 본인인증이 필요합니다' })).toContainText('본인인증 결과를 아직 확인하지 못했습니다.');
  // the legacy window inserted today's 01 row → re-check passes, the lock is taken and the lesson is ready
  try {
    await d.exec(`INSERT INTO UserCertOTP (Seq, ID, LectureCode, Study_Seq, CertDate, CertType, COURSE_AGENT_PK, CLASS_AGENT_PK, m_Ret, m_retCD, RegDate, UserIP, EvalCD, EvalType, ClassTime)
      VALUES (22599, ?, 'ARC2026', ?, CURDATE(), 'm', 'ARC2026', 'ARC2026,9301', 'Y', '0000', NOW(), '127.0.0.1', '01', '01', '01')`, [me.id, me.studySeq]);
    await page.getByRole('dialog', { name: '오늘의 본인인증이 필요합니다' }).getByRole('button', { name: '인증 다시 확인' }).click();
    await expect(page.getByRole('button', { name: '학습 시작하기' })).toBeVisible();
    await expect.poll(() => lockCount(me.id)).toBe(1);
    await checks.checkpoint('identity-passed', { settle: false });
    await leavePlayer(page, me.id);
  } finally {
    await d.exec('DELETE FROM UserCertOTP WHERE Seq = 22599');
  }
});

/**
 * Today's daily-seconds (study_daily_time_lib.php:330-388): per chapter MAX(StudyTime today) − the last value before today. The rows are
 * marked LastStudy 'e2e-8h' (a yesterday row at 0 + a today row per chapter) so a re-run replaces only them.
 */
async function setTodaySeconds(id: string, seq: number, ch1: number, ch2: number): Promise<void> {
  await db.exec("DELETE FROM ProgressLog WHERE ID = ? AND LastStudy = 'e2e-8h'", [id]);
  const rows: Array<[number, number, number, number, string, string]> = [
    [9201, 9101, 91011, 0, 'DATE_SUB(CURDATE(), INTERVAL 1 DAY) + INTERVAL 9 HOUR', '1'], [9201, 9101, 91011, ch1, 'CURDATE() + INTERVAL 1 SECOND', '1'],
    [9202, 9102, 91021, 0, 'DATE_SUB(CURDATE(), INTERVAL 1 DAY) + INTERVAL 9 HOUR', '2'], [9202, 9102, 91021, ch2, 'CURDATE() + INTERVAL 2 SECOND', '2'],
  ];
  for (const [ch, ci, cd, t, when, n] of rows) {
    await db.exec(`INSERT INTO ProgressLog (ID, LectureCode, Study_Seq, Chapter_Seq, Contents_idx, ContentsDetail_Seq, LastStudy, Progress, StudyTime, UserIP, RegDate, TriggerYN, Chapter_Number, TotalProgress, PositionSec)
      VALUES (?, 'E2EX01', ?, ?, ?, ?, 'e2e-8h', 0, ?, '127.0.0.1', ${when}, 'N', ?, 0, 30)`, [id, seq, ch, ci, cd, t, n]);
  }
}

test('8-hour daily gate: 28,770 s today opens, 28,771 s is refused (> 8 h − 30 s); TestID is exempt; the gate comes before 본인인증', async ({ page, checks }) => {
  const me = XP.daily;
  await resetLearner(me.id, me.seq);
  const daily = async (id: string, token: string) => (await page.request.get('/v1/player/daily-time', { headers: { Authorization: `Bearer ${token}` } })).json();
  // exactly 8 h − 30 s → allowed (player2.php:866 `$Today_Progress_count > $eight_hours`)
  await setTodaySeconds(me.id, me.seq, 14_400, 14_370);
  await hidePopups(page);
  const login = await openAs(page, me.id, `/learn/${me.seq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  expect((await daily(me.id, login.accessToken)).seconds).toBe(28_770);
  await expect(page.getByRole('button', { name: '학습 시작하기' })).toBeVisible();
  await leavePlayer(page, me.id);
  // one second more → refused with the PHP text, no lock
  await setTodaySeconds(me.id, me.seq, 14_400, 14_371);
  const traffic = watchTraffic(page);
  await page.goto(`/learn/${me.seq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  const block = page.locator('[data-state="ACCESS_ERROR"]');
  await expect(block).toContainText('디지털 아카이브 원격훈련 운영 규정 상 하루 최대 8시간까지만 수강이 가능합니다.');
  await checks.checkpoint('daily-cap');
  expect(await lockCount(me.id)).toBe(0);
  expect(traffic.media).toEqual([]);
  expect(traffic.saves).toEqual([]);
  await page.context().clearCookies();

  // TestID twin with the same 28,771 s (and no UserCertOTP at all): neither the 8-hour gate nor 본인인증 applies (player2.php:863, hrde_motp_test_id)
  const tid = XP.testId;
  await resetLearner(tid.id, tid.seq);
  await setTodaySeconds(tid.id, tid.seq, 14_400, 14_371);
  await openAs(page, tid.id, `/learn/${tid.seq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  await expect(page.getByRole('button', { name: '학습 시작하기' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await checks.checkpoint('daily-cap-testid', { settle: false });
  await leavePlayer(page, tid.id);
  await page.context().clearCookies();

  // order: a learner who needs 본인인증 AND is over 8 h sees the 8-hour refusal (player2.php:862-880 before :884)
  const auth = ACCOUNTS.e2eauth01;
  await db.exec('DELETE FROM UserCertOTP WHERE ID = ? AND EvalCD <> ?', [auth.id, '00']);
  await setTodaySeconds(auth.id, auth.studySeq!, 14_400, 14_371);
  try {
    await openAs(page, auth.id, `/learn/${auth.studySeq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
    await expect(page.locator('[data-state="ACCESS_ERROR"]')).toContainText('하루 최대 8시간까지만 수강이 가능합니다.');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await db.exec("DELETE FROM ProgressLog WHERE ID = ? AND LastStudy = 'e2e-8h'", [auth.id]);
  }
});

test('8-hour stop inside an open window: today + watched ≥ 8 h stops the media and sends no further save (End included)', async ({ page, checks }) => {
  const me = XP.daily;
  await resetLearner(me.id, me.seq);
  await setTodaySeconds(me.id, me.seq, 14_400, 14_370); // 28,770 s → the window may open; 30 watched seconds reach 8 h
  await hidePopups(page);
  await openAs(page, me.id, `/learn/${me.seq}/${CH1.chapterSeq}?lectureCode=E2EX01`);
  const traffic = watchTraffic(page);
  await page.getByRole('button', { name: '학습 시작하기' }).click();
  await expect.poll(() => traffic.saves.length).toBe(1); // Start
  await page.evaluate(() => { const v = document.querySelector('video')!; v.playbackRate = 4; });
  const block = page.locator('[data-state="ACCESS_ERROR"]');
  await expect(block).toContainText('하루 최대 8시간까지만 수강이 가능합니다.', { timeout: 30_000 });
  expect(await page.evaluate(() => document.querySelector('video')?.paused ?? true)).toBe(true);
  await checks.checkpoint('daily-cap-stop', { settle: false });
  const savesAtStop = traffic.saves.length;
  await page.goto('/my'); // unmount: no End beacon after the 8-hour stop (player2.php:3477-3483 "End도 추가 credit 방지")
  await page.waitForTimeout(1_000);
  expect(traffic.saves.length).toBe(savesAtStop);
  expect(traffic.saves.map((s) => JSON.parse(s).progressStep)).toEqual(['Start']);
  await expect.poll(() => lockCount(me.id)).toBe(0);
});
