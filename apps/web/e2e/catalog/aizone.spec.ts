/**
 * AI ZONE (/ai-zone, GET /v1/catalog/ai-zone + GET /v1/catalog/courses?ai=) — docs/learner-parity/catalog.md §5.
 * AI contents of the fixture catalogue (api/aizone-content.php: ContentsName AI/인공지능/ChatGPT/머신러닝/딥러닝/데이터/빅데이터/생성형
 * or EduGoal AI/인공지능/머신러닝/딥러닝, any type, no package filter): E2EX01 (데이터, 960 min, ★5), E2ER01 (생성형 AI, live R,
 * 60 min), E2EX02 (AI, 30 min).
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { expectCards, pickSelect } from './helpers';

test.use({ area: 'catalog' });

test.beforeEach(async ({ page }) => { await hidePopups(page); });

const hub = (page: Page): Locator => page.locator('section').filter({ has: page.getByRole('heading', { name: 'AI 콘텐츠 허브', exact: true }) });
const filters = (page: Page): Locator => hub(page).getByRole('form', { name: '과정 필터' });
async function apply(page: Page, wait = true) {
  const res = wait ? page.waitForResponse((r) => r.url().includes('/v1/catalog/ai-zone?')) : null;
  await filters(page).getByRole('button', { name: '적용하기' }).click();
  if (res) await res;
}

test('AI ZONE page: hero, directions, AI catalog list per direction', async ({ page, checks }) => {
  await page.goto('/ai-zone');
  await expect(page.getByRole('heading', { level: 1, name: /AI를 배우는 교육에서/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'AI 콘텐츠 보기' }).first()).toHaveAttribute('href', '/catalog?competency=ai');
  // AR-04 나에게 제공되는 AI 콘텐츠 = catalog list (ctype X/Y/Z) with the AI condition, popular first
  const list = page.locator('section').filter({ has: page.getByRole('heading', { name: '나에게 제공되는 AI 콘텐츠' }) });
  await expectCards(list, ['E2EX01', 'E2EX02']);
  await checks.checkpoint('aizone');
  const dirs = list.getByRole('group', { name: '네 가지 방향으로 AI 학습을 찾으세요.' });
  await dirs.getByRole('button', { name: 'AI 입문·기초' }).click(); // 기초 · 데이터 리터러시 · 보안 · 프롬프트 terms
  await expectCards(list, ['E2EX01', 'E2EX02']);
  await dirs.getByRole('button', { name: 'AI·AX 프로젝트' }).click(); // 프로젝트 · API · 창의 terms: only the live E2ER01 matches, and lists show X/Y/Z
  await expect(list.getByText('검색 조건에 맞는 콘텐츠가 없습니다.')).toBeVisible();
});

test('AI 콘텐츠 허브: base condition, sorts, difficulty badges', async ({ page, checks }) => {
  await page.goto('/ai-zone');
  await expectCards(hub(page), ['E2EX01', 'E2ER01', 'E2EX02'], '조회순 = cnt DESC');
  await expect(hub(page).getByText('3개', { exact: true })).toBeVisible();
  const card = (code: string) => hub(page).locator('article').filter({ has: page.locator(`a[href="/courses/${code}"]`) });
  await expect(card('E2EX01')).toContainText('난이도 심화'); // > 90 min
  await expect(card('E2ER01')).toContainText('난이도 중급'); // 30–90 min
  await expect(card('E2ER01')).toContainText('라이브');
  await expect(card('E2EX02')).toContainText('평점 없음'); // unrated is not shown as 4.5 (AR-03)
  await pickSelect(page, '정렬', '최신순');
  await expectCards(hub(page), ['E2EX02', 'E2ER01', 'E2EX01'], 'RegDate DESC');
  await pickSelect(page, '정렬', '평점순');
  await expectCards(hub(page), ['E2EX01', 'E2EX02', 'E2ER01'], 'AVG(StarPoint) DESC, RegDate DESC');
  await checks.checkpoint('aizone-hub-rating');
});

test('AI 콘텐츠 허브 filters: 세부 분야, 콘텐츠 형태, 학습시간, 평점, 과정명 (aizone-content.php WHERE)', async ({ page, checks }) => {
  await page.goto('/ai-zone');
  await expectCards(hub(page), ['E2EX01', 'E2ER01', 'E2EX02']);
  const f = filters(page);
  await f.getByRole('checkbox', { name: 'AI 프롬프트' }).check(); // 프롬프트 / prompt / ChatGPT / GPT
  await apply(page);
  await expectCards(hub(page), ['E2EX02']);
  await f.getByRole('checkbox', { name: 'AI 창의·혁신' }).check(); // OR between groups: 생성형 AI
  await apply(page);
  await expectCards(hub(page), ['E2ER01', 'E2EX02']);
  await f.getByRole('button', { name: '초기화' }).click();
  await expectCards(hub(page), ['E2EX01', 'E2ER01', 'E2EX02']);
  await f.getByRole('checkbox', { name: '라이브' }).check(); // ServiceType IN ('R')
  await apply(page);
  await expectCards(hub(page), ['E2ER01']);
  await f.getByRole('checkbox', { name: '라이브' }).uncheck();
  await f.getByRole('checkbox', { name: '이러닝' }).check();
  await apply(page);
  await expectCards(hub(page), ['E2EX01', 'E2EX02']);
  await f.getByRole('button', { name: '초기화' }).click();
  await f.getByRole('slider').nth(0).fill('60'); // ContentsTime >= 60
  await apply(page);
  await expectCards(hub(page), ['E2EX01', 'E2ER01']);
  await f.getByRole('slider').nth(0).fill('1');
  await f.getByRole('slider').nth(2).fill('4.5'); // AVG(StarPoint) >= 4.5
  await apply(page);
  await expectCards(hub(page), ['E2EX01']);
  await checks.checkpoint('aizone-hub-filtered');
  await f.getByRole('button', { name: '초기화' }).click();
  await f.getByRole('searchbox', { name: '과정명 검색' }).fill('AI');
  await apply(page);
  await expectCards(hub(page), ['E2ER01', 'E2EX02']); // ContentsName LIKE '%AI%'
  await f.getByRole('searchbox', { name: '과정명 검색' }).fill('없는과정');
  await apply(page);
  await expect(hub(page).getByText('조건에 맞는 과정이 없습니다. 필터를 조정해보세요.')).toBeVisible();
});

test('실습형 AI and AI 관련 자격 tabs', async ({ page, checks }) => {
  await page.goto('/ai-zone');
  const tabs = hub(page).getByRole('group', { name: 'AI 콘텐츠 구분' });
  await tabs.getByRole('button', { name: '실습형 AI' }).click();
  await expectCards(hub(page), ['E2ER01', 'E2EX01'], 'title 실습/실전/활용/…/데이터, RegDate DESC');
  await expect(filters(page)).toHaveCount(0); // filters belong to the content tab only
  await tabs.getByRole('button', { name: 'AI 관련 자격' }).click();
  await expect(hub(page).getByText('자격 과정이 없습니다')).toBeVisible();
  await checks.checkpoint('aizone-cert-empty');
});
