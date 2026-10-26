/**
 * 콘텐츠 탐색·목록 (/catalog, GET /v1/catalog/courses) — docs/learner-parity/catalog.md §3.
 * Visible children of the fixture catalogue (UseYN Y, Del N, no package, ctype X/Y/Z): D00001 X, D00002 Y, E2EX01 X, E2EZ01 Z,
 * E2EY01 Y, E2EH01 X, E2EX02 X — never E2EXDEL (Del Y), E2EXOFF (UseYN N), E2ER01 (ctype R) or the ARC2026 package.
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { addTempCourses, applyFilters, catalogGrid, dropTempCourses, expectCards, isPhone, pickSelect, selectOptions } from './helpers';

test.use({ area: 'catalog' });

/** RegDate DESC, idx DESC (운영 편성순 / 최신순): the two base-seed contents were registered at seed time. */
const LATEST = ['D00002', 'D00001', 'E2EX02', 'E2EY01', 'E2EH01', 'E2EZ01', 'E2EX01'];

test.beforeEach(async ({ page }) => { await hidePopups(page); });

test('guest list: visible contents only, type labels (Z 마이크로러닝, Y 숏폼), 비로그인 notice', async ({ page, checks }) => {
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { level: 1, name: '콘텐츠 탐색·목록' })).toBeVisible();
  await expect(page.getByText('콘텐츠 7개')).toBeVisible();
  await expectCards(catalogGrid(page), LATEST);
  // AR-03 비로그인 진입 notice with a login link back to the list
  await expect(page.getByText('공개 콘텐츠부터 둘러보세요.')).toBeVisible();
  await expect(page.getByRole('link', { name: '로그인', exact: true }).last()).toHaveAttribute('href', `/auth/login?next=${encodeURIComponent('/catalog')}`);
  // type badge on the card thumbnail: ctype Z = 마이크로러닝, Y = 숏폼, X = 이러닝 (main/sections/tab-all.php:145-154)
  const card = (code: string) => catalogGrid(page).locator('article').filter({ has: page.locator(`a[href="/courses/${code}"]`) });
  await expect(card('E2EZ01')).toContainText('마이크로러닝');
  await expect(card('E2EY01')).toContainText('숏폼');
  await expect(card('E2EX01')).toContainText('이러닝');
  await expect(card('E2EX01')).toContainText('5.0');
  await expect(card('E2EY01')).toContainText('평점 없음'); // its only review (9604) is Del Y
  for (const hidden of ['E2EXDEL', 'E2EXOFF', 'E2ER01', 'ARC2026']) await expect(page.locator(`a[href="/courses/${hidden}"]`)).toHaveCount(0);
  // guests get no 찜 buttons and no 찜한 콘텐츠순 / 검색 관련도순
  await expect(catalogGrid(page).getByRole('button', { name: '찜하기' })).toHaveCount(0);
  expect(await selectOptions(page, '콘텐츠 정렬')).toEqual(['운영 편성순', '조회순', '평점순', '제목순']);
  await checks.checkpoint('catalog-guest');
});

test('type filter: 이러닝 X, 마이크로러닝 Z, 숏폼 Y', async ({ page, checks }) => {
  await page.goto('/catalog');
  await expectCards(catalogGrid(page), LATEST);
  await applyFilters(page, [{ group: '콘텐츠 유형', label: '숏폼' }]);
  await expect(page).toHaveURL(/type=short/);
  await expectCards(catalogGrid(page), ['D00002', 'E2EY01'], '숏폼 = ctype Y');
  await expect(page.getByRole('group', { name: '선택한 조건' })).toContainText('숏폼');
  await checks.checkpoint('catalog-type-short');
  await applyFilters(page, [{ group: '콘텐츠 유형', label: '마이크로러닝' }]);
  await expect(page).toHaveURL(/type=micro/);
  await expectCards(catalogGrid(page), ['E2EZ01'], '마이크로러닝 = ctype Z');
  await expect(page.getByRole('group', { name: '선택한 조건' })).toContainText('마이크로러닝');
  await applyFilters(page, [{ group: '콘텐츠 유형', label: '이러닝' }]);
  await expectCards(catalogGrid(page), ['D00001', 'E2EX02', 'E2EH01', 'E2EX01'], '이러닝 = ctype X');
  // the old site's own ctype links (contents_list.html?ctype=Z) land on the same filter
  await page.goto('/catalog?type=Z');
  await expectCards(catalogGrid(page), ['E2EZ01']);
});

test('category filter: competency → Category1, 세부 분야 → Category2 or keyword label', async ({ page, checks }) => {
  await page.goto('/catalog');
  await expectCards(catalogGrid(page), LATEST);
  await applyFilters(page, [{ group: '역량', label: '공통역량' }]);
  await expect(page).toHaveURL(/competency=common/);
  await expectCards(catalogGrid(page), ['E2EH01', 'E2EZ01'], '공통역량 = CourseCategory 9010');
  await applyFilters(page, [{ group: '세부 분야', label: '커뮤니케이션' }]);
  await expect(page).toHaveURL(/field=/);
  await expectCards(catalogGrid(page), ['E2EZ01'], '커뮤니케이션 = Category2 9011');
  await checks.checkpoint('catalog-common-communication');
  await page.goto('/catalog?competency=job');
  await expectCards(catalogGrid(page), ['E2EX02', 'E2EY01', 'E2EX01'], '직무역량 = 9020 (E2ER01 is ctype R)');
  await page.goto(`/catalog?competency=job&field=${encodeURIComponent('사무자동화')}`);
  await expectCards(catalogGrid(page), ['E2EY01']);
  // a 세부 분야 that is not a sub-category is an exact keyword label (home 직무분야 links): ContentsKeyword 데이터분석 = Keyword2 9051
  await page.goto(`/catalog?competency=job&field=${encodeURIComponent('데이터분석')}`);
  await expectCards(catalogGrid(page), ['E2EX02', 'E2EY01', 'E2EX01']);
  // … or an ArchiveQuestion col3 label (Keyword3): 리더십 = 9005 → E2EH01 only
  await page.goto(`/catalog?competency=common&field=${encodeURIComponent('리더십')}`);
  await expectCards(catalogGrid(page), ['E2EH01']);
  // 리더십역량 ↔ CourseCategory '리더십' (9030) has no visible contents → empty state with the reset action
  await page.goto('/catalog?competency=leadership');
  await expect(page.getByText('검색 조건에 맞는 콘텐츠가 없습니다.')).toBeVisible();
  await expectCards(catalogGrid(page), []);
  await page.getByRole('button', { name: '검색 조건 초기화' }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expectCards(catalogGrid(page), LATEST);
  // AI ZONE = the aizone-content.php title/EduGoal condition
  await page.goto('/catalog?competency=ai');
  await expectCards(catalogGrid(page), ['E2EX02', 'E2EX01']);
});

test('search over content names and keyword labels; 검색 관련도순 only with a search text', async ({ page, checks }) => {
  await page.goto('/catalog');
  await expectCards(catalogGrid(page), LATEST);
  const search = page.getByRole('searchbox', { name: '콘텐츠명·키워드' });
  await search.fill('커뮤니케이션');
  await search.press('Enter');
  await expect(page).toHaveURL(/q=%EC%BB%A4/);
  // no title contains it: the ArchiveQuestion label 커뮤니케이션 (9006) is E2EZ01's Keyword3
  await expectCards(catalogGrid(page), ['E2EZ01']);
  await expect(page.getByText('검색 결과')).toBeVisible();
  await page.goto(`/catalog?q=${encodeURIComponent('데이터')}`);
  // title (E2EX01) + ContentsKeyword 데이터분석 (Keyword2 9051) + ArchiveQuestion AI·데이터 (Keyword3 9004)
  await expectCards(catalogGrid(page), ['E2EX02', 'E2EY01', 'E2EH01', 'E2EX01']);
  expect(await selectOptions(page, '콘텐츠 정렬')).toEqual(['운영 편성순', '조회순', '평점순', '제목순', '검색 관련도순']);
  await pickSelect(page, '콘텐츠 정렬', '검색 관련도순');
  await expect(page).toHaveURL(/sort=relevance/);
  await expectCards(catalogGrid(page), ['E2EX01', 'E2EX02', 'E2EY01', 'E2EH01'], 'title match first');
  await checks.checkpoint('catalog-search-relevance');
  // relevance without q falls back to 운영 편성순 (and the option disappears)
  await page.goto('/catalog?sort=relevance');
  await expectCards(catalogGrid(page), LATEST);
  expect(await selectOptions(page, '콘텐츠 정렬')).not.toContain('검색 관련도순');
  // nothing found → EMPTY state, conditions kept
  await page.goto(`/catalog?q=${encodeURIComponent('존재하지않는콘텐츠')}`);
  await expect(page.getByText('검색 조건에 맞는 콘텐츠가 없습니다.')).toBeVisible();
  await expect(page.getByText('콘텐츠 0개')).toBeVisible();
  await checks.checkpoint('catalog-empty');
});

test('every sort: 조회순, 평점순, 제목순, 운영 편성순', async ({ page }) => {
  await page.goto('/catalog');
  await expectCards(catalogGrid(page), LATEST);
  await pickSelect(page, '콘텐츠 정렬', '조회순');
  await expect(page).toHaveURL(/sort=popular/);
  await expectCards(catalogGrid(page), ['E2EY01', 'E2EX01', 'E2EZ01', 'E2EH01', 'E2EX02', 'D00002', 'D00001'], 'Course.cnt DESC');
  await pickSelect(page, '콘텐츠 정렬', '평점순');
  // AVG(StarPoint) of visible reviews: E2EX01 5.0 (9602 hidden), E2EH01 4.5 (★1 hidden by staff skipped), E2EZ01 4.0; the rest unrated
  await expectCards(catalogGrid(page), ['E2EX01', 'E2EH01', 'E2EZ01', 'D00002', 'D00001', 'E2EX02', 'E2EY01'], 'rating DESC');
  await pickSelect(page, '콘텐츠 정렬', '제목순');
  await expectCards(catalogGrid(page), ['D00002', 'E2EY01', 'E2EZ01', 'E2EX02', 'E2EX01', 'E2EH01', 'D00001'], 'ContentsName ASC');
  await pickSelect(page, '콘텐츠 정렬', '운영 편성순');
  await expect(page).not.toHaveURL(/sort=/);
  await expectCards(catalogGrid(page), LATEST);
});

test('찜한 콘텐츠순: signed-in only, only the learner\'s CourseLike rows, newest like first', async ({ page, checks }) => {
  await openAs(page, 'e2elearn01', '/catalog');
  await expectCards(catalogGrid(page), LATEST);
  expect(await selectOptions(page, '콘텐츠 정렬')).toContain('찜한 콘텐츠순');
  await pickSelect(page, '콘텐츠 정렬', '찜한 콘텐츠순');
  await expect(page).toHaveURL(/sort=liked/);
  // seed: E2EX01 liked 8 days ago (CourseLike idx 1), E2EH01 2 days ago (idx 2) → ORDER BY cl.idx DESC
  await expectCards(catalogGrid(page), ['E2EH01', 'E2EX01']);
  await expect(catalogGrid(page).getByRole('button', { name: '찜 해제' })).toHaveCount(2);
  await checks.checkpoint('catalog-liked');
});

test('paging: 12 per page, page in the URL', async ({ page, checks }) => {
  await dropTempCourses();
  try {
    await addTempCourses(8); // 15 visible contents, the temporary ones registered 201–208 days ago (oldest)
    await page.goto('/catalog');
    await expect(page.getByText('콘텐츠 15개')).toBeVisible();
    await expect.poll(async () => (await catalogGrid(page).locator('article a[href^="/courses/"]').count())).toBe(12);
    const pager = page.getByRole('navigation', { name: /콘텐츠 탐색·목록/ });
    await pager.getByRole('button', { name: '2', exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expectCards(catalogGrid(page), ['XCATP06', 'XCATP07', 'XCATP08']);
    await checks.checkpoint('catalog-page-2');
    // a filter change goes back to page 1
    await applyFilters(page, [{ group: '콘텐츠 유형', label: '이러닝' }]);
    await expect(page).not.toHaveURL(/page=/);
  } finally {
    await dropTempCourses();
  }
});

test('enrollment notices: 기간 종료, 시작 전, active 환급형 / 비환급형 scope line', async ({ page, checks }) => {
  await openAs(page, 'e2eexp01', '/catalog');
  await expect(page.getByText('아카이브 이용기간이 종료되었습니다.')).toBeVisible();
  await expectCards(catalogGrid(page), LATEST); // browsing stays open
  await checks.checkpoint('catalog-ended');
});

test('enrollment notice: 이용 시작 전', async ({ page, checks }) => {
  await openAs(page, 'e2esoon01', '/catalog');
  await expect(page.getByText('아카이브 이용 시작 전입니다.')).toBeVisible();
  await checks.checkpoint('catalog-before');
});

test('active learners: no notice, scope line 환급형 / 비환급형 with the 이용기간', async ({ page, db }) => {
  const s = await db.one<{ a: string; b: string }>("SELECT DATE_FORMAT(LectureStart, '%Y.%m.%d') a, DATE_FORMAT(LectureEnd, '%Y.%m.%d') b FROM Study WHERE Seq = 9407");
  await openAs(page, 'e2ewfree01', '/catalog');
  await expect(page.getByText('비환급형', { exact: true })).toBeVisible();
  await expect(page.getByText(`이용기간 ${s!.a} ~ ${s!.b}`)).toBeVisible();
  await expect(page.getByText('아카이브 이용기간이 종료되었습니다.')).toHaveCount(0);
  await expect(page.getByText('공개 콘텐츠부터 둘러보세요.')).toHaveCount(0);
  if (!isPhone(page)) await expect(catalogGrid(page).getByRole('button', { name: '찜하기' }).first()).toBeVisible();
});
