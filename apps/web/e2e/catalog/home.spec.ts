/**
 * Public home (/) and learning home (/home) — docs/learner-parity/catalog.md §1, §2, §6 (소개).
 * Fixture lists (fixtures/catalog.sql): PICK D00001, E2EZ01, E2EX01 · TOP10 E2EY01, E2EX01, E2EZ01 (deleted / hidden courses and a
 * Del-Y list row skipped) · NEW E2EX02, D00002.
 */
import type { Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { addTempCourses, cardCodes, dropTempCourses, expectCards } from './helpers';

test.use({ area: 'catalog' });

test.beforeEach(async ({ page }) => { await hidePopups(page); });

/** Rewrites the published design in this browser only (no server state): AR-01 order with AI ZONE right under the hero. */
async function withHomeSections(page: Page, visible: string[]): Promise<void> {
  await page.route('**/v1/public/design', async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    const keys: string[] = body.config.layout.homeSections.map((s: { key: string }) => s.key);
    const order = [...visible, ...keys.filter((k) => !visible.includes(k))];
    body.config.layout.homeSections = order.map((key) => ({ key, visible: visible.includes(key) }));
    await route.fulfill({ response: res, json: body });
  });
}

test('guest home: live stats, content tabs (popular / TOP10 / NEW / AI), CTA policy links', async ({ page, checks }) => {
  await page.goto('/');
  // hero stats = GET /v1/catalog/stats: visible children 7, Deep-2 categories 5, content types 3
  const stats = page.getByRole('list', { name: /아카이브 현황/ });
  await expect(stats.getByRole('group', { name: '공개 콘텐츠 7개' })).toBeVisible();
  await expect(stats.getByRole('group', { name: '세부 분야 5개' })).toBeVisible();
  await expect(stats.getByRole('group', { name: '콘텐츠 유형 3가지' })).toBeVisible();
  const tabsSection = page.locator('section[aria-labelledby="home-tabs-h"]');
  const tabs = tabsSection.getByRole('group', { name: '콘텐츠 목록 선택' });
  // 전체 = most viewed visible contents (8 cards max)
  await expectCards(tabsSection, ['E2EY01', 'E2EX01', 'E2EZ01', 'E2EH01', 'E2EX02', 'D00002', 'D00001']);
  await checks.checkpoint('home-guest');
  await tabs.getByText('인기', { exact: true }).click();
  await expectCards(tabsSection, ['E2EY01', 'E2EX01', 'E2EZ01'], 'TOP10 in OrderByNum order, deleted/hidden courses and Del-Y rows skipped');
  await tabs.getByText('최신', { exact: true }).click();
  await expectCards(tabsSection, ['E2EX02', 'D00002'], 'NEW list');
  await tabs.getByText('AI 추천', { exact: true }).click();
  await expectCards(tabsSection, ['E2EX01', 'E2EX02'], 'AI ZONE condition (title / EduGoal terms), popular first');
  await expect(tabsSection.getByRole('link', { name: '콘텐츠 더 보기' })).toHaveAttribute('href', '/ai-zone');
  await checks.checkpoint('home-guest-ai-tab');
  // the AI ZONE strip is hidden by the published (Editorial Warm) design
  await expect(page.locator('#home-ai-h')).toHaveCount(0);
  // intro band → 훈련제도 안내; CTA band: 수강신청, phone, 안내정책 (main.html:432-434: introduce/archive.html, etc/guide.html, etc/cheating_guide.html)
  await expect(page.getByRole('link', { name: '이용 방법 보기' })).toHaveAttribute('href', '/about');
  const cta = page.locator('section[aria-labelledby="home-cta-h"]');
  await expect(cta.getByRole('link', { name: '수강신청' })).toHaveAttribute('href', '/support/inquiry/new');
  await expect(cta.getByRole('link', { name: '1811-9530' })).toHaveAttribute('href', 'tel:18119530');
  const policy = cta.getByRole('navigation', { name: '안내정책' });
  await expect(policy.getByRole('link', { name: '훈련제도 안내' })).toHaveAttribute('href', '/about');
  await expect(policy.getByRole('link', { name: '학습 유의사항' })).toHaveAttribute('href', '/support/cheating?tab=guide');
  await expect(policy.getByRole('link', { name: '부정행위방지정책' })).toHaveAttribute('href', '/support/cheating?tab=policy');
  await policy.getByRole('link', { name: '부정행위방지정책' }).click();
  await expect(page).toHaveURL(/\/support\/cheating\?tab=policy$/);
  await expect(page.getByText('부정행위 적발 기준').or(page.getByRole('heading', { name: /적발/ })).first()).toBeVisible();
});

test('home with the AR-01 order (design override): AI ZONE strip under the hero, PICK section, 직무분야 links', async ({ page, checks }) => {
  await withHomeSections(page, ['hero', 'aiZone', 'featured', 'competencyBrowse', 'contentTabs', 'ctaBand']);
  await page.goto('/');
  const strip = page.locator('section[aria-labelledby="home-ai-h"]');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText('AI 기초부터 업무 활용까지');
  await expect(strip.getByRole('link', { name: 'AI ZONE 바로가기' })).toHaveAttribute('href', '/ai-zone');
  await expect(strip.getByRole('link', { name: /AI 입문·기초/ })).toHaveAttribute('href', `/catalog?competency=ai&field=${encodeURIComponent('AI 입문·기초')}`);
  // the strip sits right below the hero (the element before it holds the page h1)
  expect(await strip.evaluate((el) => !!el.previousElementSibling?.querySelector('h1'))).toBe(true);
  // 대표 콘텐츠 (featured) = the PICK list, first four
  const featured = page.locator('section').filter({ has: page.getByRole('heading', { name: '어떤 배움이 필요한가요?' }) });
  await expectCards(featured, ['D00001', 'E2EZ01', 'E2EX01']);
  await checks.checkpoint('home-ar01');
  // 역량과 분야로 찾는 배움: ContentsKeyword 직무분야 has fewer than 12 labels here → the 12 fixed AR-01 job fields
  const browse = page.locator('section').filter({ has: page.getByRole('heading', { name: '역량과 분야로 찾는 배움' }) });
  await expect(browse.getByRole('navigation', { name: '직무역량 · 12개 분야' }).getByRole('link')).toHaveCount(12);
  await expect(browse.getByRole('link', { name: /공통역량/ })).toHaveAttribute('href', '/catalog?competency=common');
  await strip.getByRole('link', { name: 'AI 콘텐츠 보기' }).click();
  await expect(page).toHaveURL(/\/catalog\?competency=ai$/);
  await expectCards(page.locator('main'), ['E2EX02', 'E2EX01']);
});

test('curated lists are capped at 50 rows (tab-top10.php / tab-new.php LIMIT 50)', async ({ page, db, checks }) => {
  await dropTempCourses('XCATL');
  try {
    // 55 extra visible package rows (packages never reach the catalogue list) placed in TOP10 after the fixture rows
    const codes = await addTempCourses(55, { package: true, prefix: 'XCATL' });
    for (const [i, code] of codes.entries()) {
      await db.exec("INSERT INTO ContentsList (gubun, LectureCode, OrderByNum, RegDate, UseYN, Del) VALUES ('2', ?, ?, NOW(), 'Y', 'N')", [code, 100 + i]);
    }
    const res = await page.request.get('/v1/catalog/lists/2');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(50);
    expect(body.items.slice(0, 4).map((c: { lectureCode: string }) => c.lectureCode)).toEqual(['E2EY01', 'E2EX01', 'E2EZ01', 'XCATL01']);
    expect(body.items[49].lectureCode).toBe('XCATL47');
    // the home 인기 tab still shows eight cards of it
    await page.goto('/');
    const tabsSection = page.locator('section[aria-labelledby="home-tabs-h"]');
    await tabsSection.getByText('인기', { exact: true }).click();
    await expect.poll(() => cardCodes(tabsSection)).toEqual(['E2EY01', 'E2EX01', 'E2EZ01', 'XCATL01', 'XCATL02', 'XCATL03', 'XCATL04', 'XCATL05']);
    await checks.checkpoint('home-top10-capped', { overflow: true });
  } finally {
    await dropTempCourses('XCATL');
  }
});

test('learning home: operator lists, 추천 콘텐츠 with the profile reason line', async ({ page, checks }) => {
  await openAs(page, 'xcatalog01', '/home');
  await expect(page.getByRole('heading', { level: 1, name: '카탈일님, 오늘도 배움을 이어가세요.' })).toBeVisible();
  const pick = page.locator('section').filter({ has: page.getByRole('heading', { name: '지금 만나는 추천 콘텐츠' }) });
  await expectCards(pick, ['D00001', 'E2EZ01', 'E2EX01'], '운영자 추천 = PICK');
  await pick.getByRole('tab', { name: '신규 콘텐츠' }).click();
  await expectCards(pick, ['E2EX02', 'D00002'], '신규 = NEW');
  // top_header.html: MemberContents Keyword1 사원 (+40) / Keyword2 9051 (+30) → score, views; reason = "<직무분야> 역량 강화를 위한 추천"
  const next = page.locator('section').filter({ has: page.getByRole('heading', { name: '나에게 맞는 다음 학습' }) });
  await expectCards(next, ['E2EY01', 'E2EX01', 'E2EH01']);
  await expect(next.getByText('데이터분석 역량 강화를 위한 추천')).toHaveCount(3);
  await checks.checkpoint('learning-home');
});

test('learning home reasons: category / interest keyword (#tag) variants', async ({ page, db, checks }) => {
  const k3 = await db.scalar<string>("SELECT Keyword3 FROM Course WHERE LectureCode = 'E2EZ01'");
  await db.exec("DELETE FROM MemberContents WHERE ID = 'xcatalog03'");
  try {
    // no profile → score 0 for all → views order; reason "<대분류> 분야에서 인기 있는 과정이에요"
    await openAs(page, 'xcatalog03', '/home');
    const next = page.locator('section').filter({ has: page.getByRole('heading', { name: '나에게 맞는 다음 학습' }) });
    await expectCards(next, ['E2EY01', 'E2EX01', 'E2EZ01']);
    await expect(next.getByText('직무역량 분야에서 인기 있는 과정이에요')).toHaveCount(2);
    await expect(next.getByText('공통역량 분야에서 인기 있는 과정이에요')).toHaveCount(1);
    // 관심분야 (MemberContents.Keyword3 = ContentsKeyword 9052 보고서작성) found as '#보고서작성' in Course.Keyword3 → +8 and the tag reason
    await db.exec("INSERT INTO MemberContents (idx, ID, Keyword1, Keyword2, Keyword3, Keyword4) VALUES (21003, 'xcatalog03', '', '', '9052', '')");
    await db.exec("UPDATE Course SET Keyword3 = '9006,#보고서작성' WHERE LectureCode = 'E2EZ01'");
    await page.reload();
    await expectCards(next, ['E2EZ01', 'E2EY01', 'E2EX01']);
    await expect(next.getByText('#보고서작성 관심 키워드 기반 추천')).toBeVisible();
    await checks.checkpoint('learning-home-tag-reason');
  } finally {
    await db.exec("UPDATE Course SET Keyword3 = ? WHERE LectureCode = 'E2EZ01'", [k3]);
    await db.exec("DELETE FROM MemberContents WHERE ID = 'xcatalog03'");
  }
});

test('소개: 훈련제도 안내 and 회사소개', async ({ page, checks }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1, name: 'HRDe 아카이브란?' })).toBeVisible();
  await expect(page.getByText('140,000원')).toBeVisible();
  await expect(page.getByText(/개인별 학습시간 15시간/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HRDe 아카이브 운영 프로세스' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '고용보험환급과정 안내' })).toBeVisible();
  await checks.checkpoint('about-archive');
  await page.locator('#main').getByRole('navigation', { name: '소개' }).getByRole('link', { name: '회사소개' }).click();
  await expect(page).toHaveURL(/\/about\/company$/);
  await expect(page.getByRole('heading', { level: 1, name: 'HRDe 아카이브는 앞서 나가기 위해 노력합니다.' })).toBeVisible();
  await expect(page.getByText('HRDe 아카이브 오시는 길')).toBeVisible();
  await expect(page.getByText('1007-1, 5006, 5007, 7000')).toBeVisible();
  await checks.checkpoint('about-company');
});
