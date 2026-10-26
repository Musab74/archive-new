/**
 * 수료 관리 cards (tab-manager-complete.php + manager-complete-aggregate.php) and 자부담금 관리 (tab-manager-payment.php) —
 * manager.md §2.5, §2.7 — figures recomputed from the stored rows (PassOK, Study.Progress, Progress.StudyTime, rPrice2), plus every
 * manager screen on the phone (no horizontal overflow, the menu reachable).
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { COMPANY } from '../support/accounts';

test.use({ area: 'manager', contextOptions: { reducedMotion: 'reduce' } });

const MGR = 'e2emgr01';
const AB = [COMPANY.A.code, COMPANY.B.code];

test('수료 관리: one card per company × 과정 × 유형 × 기간 with 전체/수료 인원 and the effective progress average', async ({ page, checks, db }) => {
  await hidePopups(page);
  await openAs(page, MGR, '/manager/completion');
  const year = new Date().getFullYear();
  const cohorts = await db.query<{ CompanyCode: string; ServiceType: string; s: string; e: string; n: number; done: number }>(
    `SELECT s.CompanyCode, s.ServiceType, DATE_FORMAT(s.LectureStart, '%Y-%m-%d') s, DATE_FORMAT(s.LectureEnd, '%Y-%m-%d') e, COUNT(DISTINCT s.ID) n,
            COUNT(DISTINCT CASE WHEN s.PassOK = 'Y' THEN s.ID END) done
       FROM Study s JOIN Course c ON c.LectureCode = s.LectureCode AND c.PackageYN = 'Y'
      WHERE s.CompanyCode IN (?, ?) AND s.ServiceType IN ('A','W','Z') AND YEAR(s.LectureStart) = ?
      GROUP BY s.CompanyCode, s.ServiceType, s.LectureStart, s.LectureEnd`, [...AB, year]);
  const cards = page.locator('main article');
  await expect(cards).toHaveCount(cohorts.length);
  for (const c of cohorts) {
    const name = c.CompanyCode === COMPANY.A.code ? COMPANY.A.name : COMPANY.B.name;
    const card = cards.filter({ hasText: `${name}의 ${year}년 HRD 아카이브 2026 · ${c.ServiceType === 'A' ? '환급' : '비환급'}` }).filter({ hasText: `${c.s} ~ ${c.e} 개강` });
    await expect(card, `${name} ${c.s}`).toHaveCount(1);
    await expect(card.locator('li').filter({ hasText: '전체 인원' })).toContainText(`${c.n}명`);
    await expect(card.locator('li').filter({ hasText: '수료 인원' })).toContainText(`${c.done}명`);
    // 평균 진도율 = round(avg per learner of max(round(Study.Progress), FLOOR(Σ seconds / 54,000 × 100)))
    const per = await db.query<{ p: number; t: number }>(
      `SELECT MAX(s.Progress) p, MAX((SELECT COALESCE(SUM(StudyTime), 0) FROM Progress x WHERE x.Study_Seq = s.Seq)) t FROM Study s
        WHERE s.CompanyCode = ? AND s.ServiceType = ? AND s.LectureStart = ? AND s.LectureEnd = ? GROUP BY s.ID`, [c.CompanyCode, c.ServiceType, c.s, c.e]);
    const avg = Math.round(per.reduce((a, r) => a + Math.min(100, Math.max(Math.round(Number(r.p)), Math.floor((Number(r.t) / 54000) * 100))), 0) / per.length);
    await expect(card.locator('li').filter({ hasText: '평균 진도율' })).toContainText(`${avg}%`);
  }
  await expect(page.getByText('E2E 타사상사')).toHaveCount(0);
  await checks.checkpoint('completion-cards');
  // company B: its own cards only, report button disabled (본인 기업만)
  await page.locator('#mgr-company').click();
  await page.getByRole('option', { name: COMPANY.B.name }).click();
  await expect(cards.filter({ hasText: COMPANY.A.name })).toHaveCount(0);
  await expect(cards.first().getByRole('button', { name: '교육결과보고서' })).toBeDisabled();
  await expect(cards.first()).toContainText('교육결과보고서는 본인 기업(회원 정보의 소속 기업)만 열 수 있습니다.');
  await checks.checkpoint('completion-company-b');
});

test('자부담금 관리: 환급 rows of the year, 140,000 / 14,000 per row, deposits = Σ rPrice2, 10 per page with 이전/다음', async ({ page, checks, db }) => {
  await hidePopups(page);
  await openAs(page, MGR, '/manager/payments');
  const year = new Date().getFullYear();
  const rows = await db.query<{ ID: string; d: number }>("SELECT ID, rPrice2 d FROM Study WHERE CompanyCode IN (?, ?) AND ServiceType = 'A' AND IFNULL(StudyEnd, 'N') = 'N' AND YEAR(LectureStart) = ?", [...AB, year]);
  const n = rows.length;
  const deposit = rows.reduce((a, r) => a + Number(r.d), 0);
  const kpis = page.locator('main [class*="kpis"]').first();
  await expect(kpis).toContainText(`교육비 총액${(140_000 * n).toLocaleString('ko-KR')}원`);
  await expect(kpis).toContainText(`자부담금${(14_000 * n).toLocaleString('ko-KR')}원`);
  await expect(kpis).toContainText(`입금액${deposit.toLocaleString('ko-KR')}원`);
  await expect(kpis).toContainText(`결제완료율${Math.round((deposit / (14_000 * n)) * 100)}%`);
  await expect(page.getByText(`수강생 ${new Set(rows.map((r) => r.ID)).size}명`)).toBeVisible();
  const table = page.locator('main table tbody tr');
  await expect(table).toHaveCount(Math.min(10, n));
  await expect(table.first()).toContainText('140,000원');
  await expect(table.first()).toContainText('14,000원');
  await checks.checkpoint('payments');
  if (n > 10) {
    await page.getByRole('navigation', { name: '페이지' }).getByRole('button', { name: '다음' }).click();
    await expect(table).toHaveCount(n - 10);
    await expect(table.first().locator('td').first()).toHaveText('11');
  }
});

test('mobile manager screens: every page renders inside 390 px, menu reachable', async ({ page, checks }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout check');
  await hidePopups(page);
  await openAs(page, MGR, '/manager');
  for (const [path, heading] of [['/manager', '기업 운영현황'], ['/manager/trainees', '수강생 관리'], ['/manager/completion', '수료 관리'], ['/manager/payments', '자부담금 관리'], ['/manager/nudge', '확인·독려'], ['/manager/reports', '보고서·증빙']] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    const nav = page.getByRole('navigation', { name: '기업 교육담당자' });
    await expect(nav.getByRole('link', { name: heading })).toBeAttached();
    await checks.checkpoint(`mobile-${path.replace(/\//g, '_')}`);
  }
});
