/**
 * 학습결과보고서 (/my/report, AR-14 + tab-report.php), 랭킹·뱃지·레벨 (/my/ranking, tab-ranking-badges.php + api/my/*.php) and the
 * 출석 체크 stamps (lecture_event.html) — myroom.md §2.5–2.7.
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { authed } from './helpers';

test.use({ area: 'myroom' });

const quiet = (db: { exec: (s: string) => Promise<number> }) => db.exec("UPDATE StudyCorrectionNotice SET acknowledged_at = NOW() WHERE ID = 'xmyroom01'");

test('학습결과보고서 per enrollment: own Seqs only, stored figures, recent 4 of that Seq, AI not connected', async ({ page, checks, db }) => {
  await quiet(db);
  await hidePopups(page);
  const { accessToken } = await openAs(page, 'xmyroom01', '/my/report');
  await expect(page.getByRole('heading', { name: '나보정님의 학습결과보고서' })).toBeVisible();
  const sel = page.getByLabel('보고서 이용건 선택');
  await expect(sel.locator('option')).toHaveCount(2); // the learner's two Study rows, newest first
  await expect(sel).toHaveValue('24402');
  const sum = page.getByRole('region', { name: '01 나의 학습 요약' });
  await expect(sum).toContainText('11시간 29분'); // 전체 = 25,561 + carry 15,835
  await expect(sum).toContainText('7시간 6분'); // 환급 인정 = current enrollment only
  await expect(sum).toContainText('7시간 53분'); // 남은 인정시간 = 54,000 − 25,561 = 28,439 s
  await expect(sum).toContainText('6개 (이수완료 1개)');
  await expect(page.getByRole('region', { name: '04 AI 학습 설명' })).toContainText('보고서용 AI 설명은 아직 연결되지 않았습니다.');
  await checks.checkpoint('report-current');

  await sel.selectOption('24401');
  await expect(page).toHaveURL(/studySeq=24401/);
  await expect(sum).toContainText('4시간 23분');
  await expect(sum).toContainText('미수료');
  await expect(sum).toContainText('훈련 종료 시 수료 요건을 충족하지 않았습니다.');
  await expect(page.getByRole('region', { name: '이용정보' })).toContainText('이용기간 종료');
  const recent = page.getByRole('region', { name: '02 최근 학습기록' }).locator('tbody tr');
  await expect(recent).toHaveCount(4); // newest four of Seq 24401
  await expect(recent.first()).toContainText('[E2E] 라이브 특강: 생성형 AI 업무 활용');
  await expect(recent.first()).toContainText('59분'); // 3,599 s
  await expect(recent.first()).toContainText('99%');
  await checks.checkpoint('report-ended');

  // print view: the same page with the selector / links / AXIS (and the site chrome) hidden
  await page.evaluate(() => { (window as unknown as { __printed: number }).__printed = 0; window.print = () => { (window as unknown as { __printed: number }).__printed++; }; });
  await page.getByRole('button', { name: '보고서 출력용 보기' }).click();
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(sel).toBeHidden();
  await expect(page.getByRole('navigation', { name: '나의 학습실' })).toBeHidden();
  await expect(page.locator('header').first()).toBeHidden();
  await expect(sum).toBeVisible();
  await checks.screenshot('report-print');
  await page.emulateMedia({ media: 'screen' });

  // another learner's enrollment → 404, the page shows the error state (never someone else's report)
  checks.allow(/\/v1\/my\/report\?studySeq=9401$/, 404);
  const api = authed(page, accessToken);
  const res = await api.get('/v1/my/report?studySeq=9401');
  expect(res.status()).toBe(404);
  expect((await res.json()).error.message).toBe('본인의 이용건을 찾을 수 없습니다.');
  await page.goto('/my/report?studySeq=9401');
  await expect(page.getByText('보고서 집계를 확인하지 못했습니다.')).toBeVisible();
  await expect(page.getByText('김학습')).toHaveCount(0);
});

test('랭킹·뱃지: masked other learners, own row, level/XP from the activity, badge summary', async ({ page, checks, db }) => {
  await quiet(db);
  await hidePopups(page);
  const { accessToken } = await openAs(page, 'xmyroom01', '/my/ranking');
  const api = authed(page, accessToken);
  const [rk, lv, bd] = await Promise.all(['/v1/my/ranking?scope=all', '/v1/my/level', '/v1/my/badges'].map(async (u) => (await api.get(u)).json()));
  // ranking (api/my/ranking.php): minutes = SUM(StudyTime)/60 of every Progress row, other IDs masked by the API
  const sec = Number(await db.scalar("SELECT SUM(StudyTime) FROM Progress WHERE ID = 'xmyroom01'"));
  expect(rk.my.studyMinutes).toBe(Math.round(sec / 60));
  for (const r of rk.top10) if (!r.isMe) expect(r.id).toMatch(/\*\*\*$/);
  expect(JSON.stringify(rk)).not.toMatch(/e2elearn|e2epass|e2ecco/);
  const ranking = page.getByRole('region', { name: '학습 랭킹' });
  await expect(ranking.getByText(`${rk.rank}위`, { exact: true })).toBeVisible();
  const meRow = ranking.locator('tbody tr').filter({ hasText: '나' });
  await expect(meRow.first()).toContainText(rk.my.score.toLocaleString('ko-KR'));
  await expect(ranking).not.toContainText('e2elearn01');
  // level (api/my/level.php)
  const level = page.getByRole('region', { name: '나의 레벨' });
  await expect(level).toContainText(`Lv.${lv.level} ${lv.levelName}`);
  await expect(level).toContainText(`총 XP ${lv.totalXP.toLocaleString('ko-KR')} XP`);
  await expect(level).toContainText(`다음 레벨까지 ${lv.xpToNextLevel.toLocaleString('ko-KR')} XP`);
  // badges (api/user/badges.php): "a/t개 획득"
  const badges = page.getByRole('region', { name: '나의 뱃지' });
  await expect(badges).toContainText(`${bd.summary.achieved}/${bd.summary.total}개 획득`);
  expect(bd.summary.total).toBe(12);
  await expect(badges).toContainText(`${bd.stats.totalHours}시간`);
  // company scope
  await ranking.getByRole('button', { name: '소속 기업' }).click();
  await expect(ranking.getByText('E2E 타사상사')).toBeVisible(); // xmyroom01 is in company C
  await expect(ranking.getByText(`${rk.companyRank}위`, { exact: true })).toBeVisible();
  await checks.checkpoint('ranking');
});

test('출석 체크: Stage 20 has 4 stamps (first LectureEvent row), the other stages none', async ({ page, checks, db }) => {
  await quiet(db);
  await hidePopups(page);
  await openAs(page, 'xmyroom01', '/my/ranking');
  const ev = page.getByRole('region', { name: '출석 체크' });
  await expect(ev).toContainText('HRDe Archive 매일매일 출석체크 이벤트');
  await expect(ev).toContainText('1일 1시간 이상을 수강한 수강생 여러분께 출석 도장이 발행됩니다.');
  await expect(ev).toContainText('출석 도장을 10개 이상 모아 주시면 커피 쿠폰을 증정해드립니다.');
  await expect(ev).toContainText('매일 매일 1시간! 최대 40일 4개의 커피 쿠폰을 모아 보세요!');
  for (const [label, n] of [['10 Days', 0], ['20 Days', 4], ['30 Days', 0], ['40 Days', 0]] as const) {
    const stamps = ev.getByLabel(`${label} ${n}/10`);
    await expect(stamps).toBeVisible();
    await expect(stamps.locator('span')).toHaveCount(10);
    await expect(stamps.locator('span[class*="stampOn"]')).toHaveCount(n);
  }
  await checks.checkpoint('events');
});
