/**
 * 나의학습실 홈 (/my) — tab-status.php + sections/data-logic.php (docs/learner-parity/myroom.md §2.1, AR-11).
 * 15-hour clock from the stored seconds (floor, never rounded up), 수료 label, D-day from the newest Seq, coach comment
 * fallback tiers, 진행중 과정 cards, 학습시간 재계산 popup on every /my/* page, 법정교육 link, no AI ZONE block.
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { authed, popupUrl } from './helpers';

test.use({ area: 'myroom' });

const statusCard = (page: import('@playwright/test').Page) => page.getByRole('region', { name: '이용기간' });

test('e2elearn01 14h59m: clock, 남은 1분, 미수료 label, D-day, coach comment, 진행중 과정', async ({ page, checks, db }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, 'e2elearn01', '/my');
  await expect(page.getByRole('heading', { name: '김학습님의 학습실' })).toBeVisible();
  // stored seconds → the clock: 53,940 s = 14시간 59분 (floor; never "15시간")
  const seconds = Number(await db.scalar('SELECT SUM(StudyTime) FROM Progress WHERE Study_Seq = 9401'));
  expect(seconds).toBe(53_940);
  const ring = page.getByRole('region', { name: '환급 인정 수강시간' });
  await expect(ring.getByText('남은 인정시간 1분')).toBeVisible();
  await expect(ring.getByText('14시간 59분 / 15시간 이상')).toBeVisible();
  await expect(ring.getByText('15시간을 달성했습니다.')).toHaveCount(0);
  // 상태: "미수료 (미수료)" with the PHP hint as title (data-logic.php:412-416, tab-status.php:263)
  const pass = statusCard(page).getByText('미수료 (미수료)', { exact: true });
  await expect(pass).toBeVisible();
  await expect(pass).toHaveAttribute('title', '수료기준(15시간) 학습을 완료해 주세요.');
  await expect(statusCard(page).getByRole('button', { name: '수료증 출력' })).toHaveCount(0);
  // 학습 리마인더 from the newest Seq (LectureEnd = today + 70)
  await expect(statusCard(page).getByText('수료까지 D-70', { exact: true })).toBeVisible();
  // coach comment tier ≥85 % (tab-status.php getProgressFallback): hours = floor(899/60), remaining = floor(1/60)
  await expect(page.getByRole('region', { name: '학습 코멘트' })).toHaveText('수료까지 정말 가까워졌습니다! 현재까지 14시간을 학습하셨고, 남은 시간은 약 0시간입니다. 마지막까지 화이팅!');
  // 진행중 과정 (tab-status.php:529-702): E2EX01 on Seq 9401, time = SUM(StudyTime) by Seq + code, progress = chapter based
  const recent = page.getByRole('region', { name: '최근 학습' });
  const card = recent.getByRole('listitem').filter({ hasText: '[E2E] 데이터 리터러시 실무' });
  await expect(card).toHaveCount(1);
  // FLOOR(SUM(LEAST(Progress,100)) / (4 chapters × 100) × 100) = FLOOR(374 / 4) = 93
  await expect(card.getByText('93% (14시간 59분)', { exact: false })).toBeVisible();
  await expect(card.getByRole('link', { name: '이어서 학습하기' })).toHaveAttribute('href', /\/learn\/9401\/\d+\?lectureCode=E2EX01$/);
  // AR-11: no AI ZONE block on the my-room home; 법정교육 link opens the PHP site in a new window
  await expect(page.locator('main [class*="roomMain"]').getByText(/AI ZONE|AI 존/i)).toHaveCount(0); // the header's AI ZONE menu link is not a block
  const legal = page.getByRole('link', { name: /법정교육바로가기/ });
  await expect(legal).toHaveAttribute('href', 'https://www.hrdeedu.com/');
  await expect(legal).toHaveAttribute('target', '_blank');
  // no pending correction notice → no popup
  await expect(page.getByRole('dialog', { name: '학습시간 재계산 안내' })).toHaveCount(0);
  await checks.checkpoint('home-e2elearn01');
  // the API figures behind the page are the stored ones
  const st = await (await authed(page, accessToken).get('/v1/my/status')).json();
  expect(st).toMatchObject({ completionSeconds: 53_940, percent: 99, achieved: false, currentMinutes: 899, passOk: false });
});

test('e2elearn15 exactly 15h: achieved, 미수료 · 사후역량진단 필요, 축하 comment', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'e2elearn15', '/my');
  const ring = page.getByRole('region', { name: '환급 인정 수강시간' });
  await expect(ring.getByText('15시간을 달성했습니다.')).toBeVisible();
  await expect(ring.getByText('15시간 0분 / 15시간 이상')).toBeVisible();
  const pass = statusCard(page).getByText('미수료 (미수료 · 사후역량진단 필요)', { exact: true });
  await expect(pass).toBeVisible();
  await expect(pass).toHaveAttribute('title', '학습시간은 충족되었습니다. 사후역량진단을 완료하면 수료로 처리됩니다.');
  await expect(page.getByRole('region', { name: '학습 코멘트' })).toHaveText('축하합니다! 15시간 0분의 학습을 완료하셨습니다. 수료증을 출력하여 성과를 인정받으세요.');
  await checks.checkpoint('home-e2elearn15');
});

test('e2epass02 수료 but refund certificate waits until LectureEnd + 7; D-3 warning', async ({ page, checks, db }) => {
  await hidePopups(page);
  await openAs(page, 'e2epass02', '/my');
  const end = String(await db.scalar("SELECT DATE_FORMAT(DATE_ADD(LectureEnd, INTERVAL 7 DAY), '%Y-%m-%d') FROM Study WHERE Seq = 9404"));
  await expect(statusCard(page).getByText('수료 (수료)', { exact: true })).toBeVisible();
  const wait = statusCard(page).getByText(`수료증 대기중 ${end}부터 출력`, { exact: true });
  await expect(wait).toBeVisible();
  await expect(wait).toHaveAttribute('title', '환급 과정 수료증은 학습 종료 후 7일 뒤 출력할 수 있습니다.');
  await expect(statusCard(page).getByRole('button', { name: '수료증 출력' })).toHaveCount(0);
  await expect(statusCard(page).getByText('수료까지 D-3', { exact: true })).toBeVisible();
  await checks.checkpoint('home-e2epass02');
});

test('e2epass01 ended + 수료: 수료증 출력 opens the PDF; reminder says the period ended', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'e2epass01', '/my');
  await expect(statusCard(page).getByText('수료 (수료)', { exact: true })).toBeVisible();
  await expect(statusCard(page).getByText('수료기간이 종료되었습니다', { exact: true })).toBeVisible();
  await checks.checkpoint('home-e2epass01');
  const pdf = page.waitForResponse((r) => r.url().endsWith('/v1/my/certificates/9403/pdf'));
  const url = await popupUrl(page, () => statusCard(page).getByRole('button', { name: '수료증 출력' }).click());
  expect(url).toMatch(/^blob:http:\/\/127\.0\.0\.1:/);
  const res = await pdf;
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('application/pdf');
});

test('e2ewfree01 비환급(W): cumulative record only — no 15h ring, no 수료 label, no coach comment', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'e2ewfree01', '/my');
  const general = page.getByRole('region', { name: '나의 누적 학습기록' });
  await expect(general.getByText('3시간 10분', { exact: true })).toBeVisible(); // 11,400 s
  await expect(page.getByRole('region', { name: '환급 인정 수강시간' })).toHaveCount(0);
  await expect(page.locator('main [class*="roomMain"]').getByText(/미수료|수료증/)).toHaveCount(0); // (the side menu keeps its 수료증 link)
  await expect(page.getByRole('region', { name: '학습 코멘트' })).toHaveCount(0);
  await checks.checkpoint('home-e2ewfree01');
});

test('xmyroom01 carry-over: 1차 수강기간 line, clocks from stored seconds; correction popup on every /my page until acknowledged', async ({ page, checks, db, clientIp }) => {
  await db.exec("UPDATE StudyCorrectionNotice SET acknowledged_at = NULL, ack_ip = NULL WHERE ID = 'xmyroom01'");
  await hidePopups(page);
  await openAs(page, 'xmyroom01', '/my/records');
  // popup on a non-home /my page too (correction-notice-popup.php is included by every my-room page)
  const dlg = page.getByRole('dialog', { name: '학습시간 재계산 안내' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText('안녕하세요. 시스템 점검 중 일부 학습 기록에서 실제 콘텐츠 길이를 초과해 누적된 학습시간이 발견되어 정정하였습니다.')).toBeVisible();
  await expect(dlg.getByText('회원님의 누적 학습시간이 약 1시간 30분 만큼 조정되었습니다.')).toBeVisible();
  await expect(dlg.getByText(/각 차시의 학습시간은 해당 콘텐츠의 실제 재생시간까지만 인정됩니다\(정부 인정 LMS 기준\)/)).toBeVisible();
  await expect(dlg.getByText(/이 정정은 2026년 이후 학습 기록에만 적용되었으며/)).toBeVisible();
  const applied = String(await db.scalar("SELECT DATE_FORMAT(applied_at, '%Y-%m-%d %H:%i:%s') FROM StudyCorrectionNotice WHERE ID = 'xmyroom01'"));
  await expect(dlg.getByText(`적용 시각: ${applied}`)).toBeVisible();
  await checks.checkpoint('correction-popup');
  // navigating inside the my room keeps it up until it is acknowledged
  await page.goto('/my');
  await expect(dlg).toBeVisible();
  const ack = page.waitForResponse((r) => r.url().endsWith('/v1/my/notices/ack') && r.request().method() === 'POST');
  await dlg.getByRole('button', { name: '확인했습니다' }).click();
  expect((await ack).status()).toBeLessThan(300);
  await expect(dlg).toHaveCount(0);
  const row = await db.one<{ acknowledged_at: string | null; ack_ip: string | null }>("SELECT acknowledged_at, ack_ip FROM StudyCorrectionNotice WHERE ID = 'xmyroom01'");
  expect(row?.acknowledged_at).not.toBeNull();
  expect(row?.ack_ip).toBe(clientIp);
  await page.reload();
  await expect(page.getByRole('heading', { name: '나보정님의 학습실' })).toBeVisible();
  await expect(dlg).toHaveCount(0);
  // carry-over (data-logic.php:254-264): 1차 = ended Seq 24401 15,835 s (04시간 23분), 신규 = 24402 25,561 s (7시간 6분)
  const ring = page.getByRole('region', { name: '환급 인정 수강시간' });
  await expect(ring.getByText('7시간 6분 / 15시간 이상')).toBeVisible();
  const prev = await db.one<{ s: string; e: string }>("SELECT DATE_FORMAT(LectureStart, '%Y-%m-%d') s, DATE_FORMAT(LectureEnd, '%Y-%m-%d') e FROM Study WHERE Seq = 24401");
  const cur = await db.one<{ s: string; e: string }>("SELECT DATE_FORMAT(LectureStart, '%Y-%m-%d') s, DATE_FORMAT(LectureEnd, '%Y-%m-%d') e FROM Study WHERE Seq = 24402");
  await expect(ring.getByText(`1차 수강기간 : ${prev!.s} ~ ${prev!.e} / 04시간 23분`)).toBeVisible();
  await expect(ring.getByText(`신규 수강기간 : ${cur!.s} ~ ${cur!.e} / 7시간 6분`)).toBeVisible();
  // 전체 학습기록 = current + carry (41,396 s = 11시간 29분); 환급 인정시간 = current only
  const kv = statusCard(page);
  await expect(kv.getByText('11시간 29분', { exact: true })).toBeVisible();
  await expect(kv.getByText('7시간 6분', { exact: true })).toBeVisible();
  // coach tier 30–49 %: ceil(remainingHours / 4) = ceil(floor(474 / 60) / 4) = 2
  await expect(page.getByRole('region', { name: '학습 코멘트' })).toHaveText('학습을 진행하고 계시는군요. 목표 달성을 위해 주 2시간씩 학습하는 것을 추천합니다.');
  // 진행중 과정: RecentDate DESC LIMIT 3 of the in-window enrollment (E2EH01 −3 d, E2EY01 −5 d, E2EZ01 −7 d)
  const cards = page.getByRole('region', { name: '최근 학습' }).getByRole('listitem');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('[E2E] 패키지형 HTML 차시 체험');
  await expect(cards.nth(1)).toContainText('[E2E] 1분 엑셀 단축키');
  await expect(cards.nth(2)).toContainText('[E2E] 5분 보고서 작성법');
  await expect(cards.nth(1).getByRole('link', { name: '다시 학습하기' })).toBeVisible(); // 180/180 s → chapter progress 100
  await expect(cards.nth(2)).toContainText('74% (14분)'); // (100 + 49) / 200 chapters → 74, 899 s → 14분
  await checks.checkpoint('home-carryover');
});

test('xmyroom02 without enrollment: 진행중인 과정이 없습니다', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'xmyroom02', '/my');
  await expect(page.getByRole('heading', { name: '두찜님의 학습실' })).toBeVisible();
  await expect(page.getByText('진행중인 과정이 없습니다.')).toBeVisible();
  await checks.checkpoint('home-no-enrollment');
});
