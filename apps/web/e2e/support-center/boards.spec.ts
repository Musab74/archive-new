/**
 * 학습지원센터 boards — docs/learner-parity/support.md §2 공지사항, 자주 묻는 질문, 학습자료실 + 찜, 이벤트, PC 원격지원, 이용안내.
 * PHP rules: notice.html (Del N, UseYN Y, 공지 first, RegDate DESC, 25/page), faq.html (Del N, UseYN Y, OrderByNum ASC, RegDate ASC,
 * 10/page), edudata.html (Del N, UseYN Y, 분류 A default, RegDate ASC, 10/page); files stream with RealFileName (download.php).
 */
import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';

test.use({ area: 'support' });

test.beforeEach(async ({ page }) => { await hidePopups(page); });

/** Titles of the board rows (role=row links), in order. */
async function rowTitles(page: Page): Promise<string[]> {
  return page.locator('a[role="row"]').evaluateAll((els) => els.map((e) => (e.querySelector('.u-clamp-2')?.textContent ?? '').trim()));
}

test('공지사항 list: visible rows only, 공지 first then newest, 번호, 파일 and 조회 columns', async ({ page, checks }) => {
  await page.goto('/support/notice');
  await expect(page.getByRole('heading', { name: '공지사항' }).first()).toBeVisible();
  await expect(page.getByText('총 4건')).toBeVisible();
  await expect.poll(() => rowTitles(page)).toEqual(['서비스 오픈 안내', '[E2E] 학습 이용 안내', '정기 점검', '[E2E] 10월 정기 점검 안내']);
  const rows = page.locator('a[role="row"]');
  await expect(rows.nth(0).getByRole('cell').first()).toHaveText('공지');
  await expect(rows.nth(1).getByRole('cell').first()).toHaveText('공지');
  await expect(rows.nth(2).getByRole('cell').first()).toHaveText('2'); // $PAGE_UNCOUNT: total − offset − i
  await expect(rows.nth(3).getByRole('cell').first()).toHaveText('1');
  await expect(rows.nth(1)).toHaveAttribute('href', '/support/notice/9701');
  await checks.checkpoint('notice-list');
  // search in title + body
  await page.getByRole('searchbox', { name: '공지 검색' }).fill('학습안내서');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  await expect.poll(() => rowTitles(page)).toEqual(['[E2E] 학습 이용 안내']); // body text match
  await page.getByRole('searchbox', { name: '공지 검색' }).fill('숨김');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.getByText('검색어에 맞는 공지사항이 없습니다.')).toBeVisible(); // UseYN N / Del Y rows never match
  // the API keeps the PHP page size of 25
  const api = await (await page.request.get('/v1/support/notices')).json();
  expect(api).toMatchObject({ size: 25, total: 4, page: 1 });
});

test('공지사항 detail: 조회 +1, attachment with the original name; hidden / deleted → not found', async ({ page, db, checks }) => {
  const before = Number(await db.scalar('SELECT ViewCount FROM Notice WHERE idx = 9701'));
  await page.goto('/support/notice/9701');
  await expect(page.getByRole('heading', { name: /\[E2E\] 학습 이용 안내/ })).toContainText('공지');
  await expect(page.getByText(`조회 ${before + 1}`)).toBeVisible();
  expect(Number(await db.scalar('SELECT ViewCount FROM Notice WHERE idx = 9701'))).toBe(before + 1);
  await expect(page.getByText('E2E 공지 본문입니다.')).toBeVisible();
  await checks.checkpoint('notice-detail');
  const dl = page.waitForEvent('download');
  await page.getByRole('link', { name: 'E2E_학습안내서.pdf' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('E2E_학습안내서.pdf');
  expect(fs.readFileSync((await file.path())!).subarray(0, 5).toString()).toBe('%PDF-');
  for (const idx of [9703, 9704]) {
    checks.allow(new RegExp(`/v1/support/notices/${idx}$`), 404);
    await page.goto(`/support/notice/${idx}`);
    await expect(page.getByRole('button', { name: '목록' }).or(page.getByRole('link', { name: '목록' })).first()).toBeVisible();
    await expect(page.getByText(/숨김 공지|삭제된 공지/)).toHaveCount(0);
  }
  expect((await page.request.get('/v1/support/notices/9703/files/1')).status()).toBe(404);
});

test('자주 묻는 질문: 분류 tabs from $Faq_array, server-side filter and search, OrderByNum order, ?idx opens the answer', async ({ page, checks }) => {
  await page.goto('/support/faq');
  const titles = async () => (await page.locator('details summary').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
  await expect.poll(titles).toEqual(['[학습]학습시간은 어떻게 계산되나요?', '[일반][E2E] 수료 기준은 무엇인가요?', '[동영상][E2E] 동영상이 재생되지 않아요', '[학습진도][E2E] 학습진도가 반영되지 않아요', '[로그인][E2E] 비밀번호를 잊어버렸어요']);
  const pills = page.getByRole('group', { name: '자주 묻는 질문' });
  await expect(pills.getByRole('button')).toHaveText(['전체', '일반', '동영상', '학습진도', '로그인', '기타문의']);
  await checks.checkpoint('faq');
  const req = page.waitForResponse((r) => r.url().includes('/v1/support/faqs?') && r.url().includes('category=B'));
  await pills.getByRole('button', { name: '동영상' }).click();
  await req;
  await expect.poll(titles).toEqual(['[동영상][E2E] 동영상이 재생되지 않아요']);
  await pills.getByRole('button', { name: '기타문의' }).click();
  await expect(page.getByText('검색어에 맞는 안내가 없습니다.', { exact: false })).toBeVisible(); // 9725 (E) is UseYN N
  await pills.getByRole('button', { name: '전체' }).click();
  await page.getByRole('searchbox', { name: '찾고 싶은 내용' }).fill('새로고침');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect.poll(titles).toEqual(['[동영상][E2E] 동영상이 재생되지 않아요']); // answer text match
  await page.goto('/support/faq?idx=9723');
  await expect(page.locator('details[open] summary')).toHaveText('[학습진도][E2E] 학습진도가 반영되지 않아요');
  await expect(page.getByText('학습창을 닫을 때 진도가 저장됩니다.')).toBeVisible();
  expect(await (await page.request.get('/v1/support/faqs')).json()).toMatchObject({ size: 10, total: 5 });
});

test('학습자료실: 분류 A default, oldest first, downloads with original names, no login needed', async ({ page, db, checks }) => {
  await page.goto('/support/resources');
  await expect.poll(() => rowTitles(page)).toEqual(['[E2E] 업무 보고서 워크북']); // 분류 A (공통역량); 9744 is UseYN N
  const pills = page.getByRole('group', { name: '학습자료실' });
  await expect(pills.getByRole('button', { name: '공통역량' })).toHaveAttribute('aria-pressed', 'true');
  await expect(pills.getByRole('button', { name: '찜한 자료' })).toHaveCount(0); // guests
  await pills.getByRole('button', { name: '리더십' }).click();
  await expect.poll(() => rowTitles(page)).toEqual(['[E2E] 리더십 자료 안내 (첨부 없음)']); // Notice='Y' is not pinned specially (edudata.html)
  await checks.checkpoint('resources-list');
  const before = Number(await db.scalar('SELECT ViewCount FROM StudyPDS WHERE idx = 9742'));
  await page.goto('/support/resources/9742');
  await expect(page.getByRole('heading', { name: '[E2E] 데이터 분석 체크리스트' })).toBeVisible();
  await expect(page.getByText(`조회 ${before + 1}`)).toBeVisible();
  await expect(page.getByRole('button', { name: '학습자료 찜하기' })).toHaveCount(0); // guests cannot scrap
  const dl = page.waitForEvent('download');
  await page.getByRole('link', { name: 'E2E_체크리스트.txt' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('E2E_체크리스트.txt');
  await checks.checkpoint('resources-detail');
  await page.getByRole('link', { name: '목록' }).click();
  await expect(page).toHaveURL(/\/support\/resources\?category=B$/); // back to the same 분류
  await expect.poll(() => rowTitles(page)).toEqual(['[E2E] 데이터 분석 체크리스트']);
  expect(await (await page.request.get('/v1/support/edudata?category=A')).json()).toMatchObject({ size: 10, total: 1 });
});

test('학습자료 찜: POST adds one StudyPDS_Scrap row, 찜한 자료 lists it, DELETE removes it', async ({ page, db, checks }) => {
  await db.exec("DELETE FROM StudyPDS_Scrap WHERE ID = 'xsupport01'");
  const login = await openAs(page, 'xsupport01', '/support/resources/9741');
  const scrap = page.waitForResponse((r) => r.url().endsWith('/v1/support/edudata/9741/scrap') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '학습자료 찜하기' }).click();
  expect((await scrap).status()).toBe(200);
  await expect(page.getByText('학습자료 찜하기가 완료되었습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '학습자료 찜 취소하기' })).toHaveAttribute('aria-pressed', 'true');
  expect(await db.scalar("SELECT COUNT(*) FROM StudyPDS_Scrap WHERE ID = 'xsupport01' AND idx = 9741")).toBe(1);
  // a second scrap of the same material does not add a row
  const again = await page.request.post('/v1/support/edudata/9741/scrap', { headers: { Authorization: `Bearer ${login.accessToken}` } });
  expect(await again.json()).toMatchObject({ ok: true, scrapped: true });
  expect(await db.scalar("SELECT COUNT(*) FROM StudyPDS_Scrap WHERE ID = 'xsupport01'")).toBe(1);
  await page.goto('/support/resources?category=scraps');
  await expect.poll(() => rowTitles(page)).toEqual(['[공통역량] [E2E] 업무 보고서 워크북']);
  await checks.checkpoint('resources-scraps');
  await page.goto('/support/resources/9741');
  const unscrap = page.waitForResponse((r) => r.url().endsWith('/v1/support/edudata/9741/scrap') && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: '학습자료 찜 취소하기' }).click();
  expect((await unscrap).status()).toBe(200);
  await expect(page.getByText('학습자료 찜 취소하기가 완료되었습니다.')).toBeVisible();
  expect(await db.scalar("SELECT COUNT(*) FROM StudyPDS_Scrap WHERE ID = 'xsupport01'")).toBe(0);
  await page.goto('/support/resources?category=scraps');
  await expect(page.getByText('찜한 학습자료가 없습니다.')).toBeVisible();
});

test('이용안내, 이벤트 (static, no API), PC 원격지원 link; support tabs', async ({ page, checks }) => {
  await page.goto('/support/guide');
  await expect(page.getByRole('heading', { name: '아카이브 자유학습 이용안내' })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: '고객지원' }).or(page.locator('#main').getByLabel('고객지원', { exact: true })).first();
  for (const t of ['이용안내', '공지사항', '자주 묻는 질문', '1:1 문의', '내 문의', '기업교육상담', '학습자료실', '수강후기', 'PC 원격지원']) await expect(tabs.getByRole('link', { name: t, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '교육유의사항·부정행위방지정책' })).toHaveAttribute('href', '/support/cheating');
  await checks.checkpoint('guide');
  const calls: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/v1/support/events')) calls.push(r.url()); });
  await page.goto('/support/events');
  await expect(page.getByText('진행 중인 이벤트가 없습니다.')).toBeVisible();
  await expect(page.getByRole('link', { name: '토론방·라이브로 이동' })).toHaveAttribute('href', '/live');
  expect(calls).toEqual([]);
  await checks.checkpoint('events');
  await page.goto('/support/remote');
  await expect(page.locator('#main').getByRole('link', { name: '원격지원 바로가기 (새 창)' })).toHaveAttribute('href', 'http://www.ezh.kr/hrdeedu/'); // remote.html:104
  await checks.checkpoint('remote');
});
