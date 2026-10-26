/**
 * 학습기록·이수내역 (/my/records) and the home 상세보기 tables — tab-history.php + lecture_status_tables.php
 * (docs/learner-parity/myroom.md §2.2). xmyroom01 has 13 (content, Seq) rows: 10 per page, filters, per-type tables; every figure
 * must equal the stored Progress.StudyTime (floored minutes / H:i:s, chapter percent floored — 3,599 s is 59분 and 99 %, never 100).
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { authed, dispositionType, fileNameOf, pdfText } from './helpers';
import type { Page } from '@playwright/test';

test.use({ area: 'myroom' });

const ME = 'xmyroom01';
/** MyRecords "전체 학습시간": floored hours/minutes (hm()). */
const hm = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}시간 ${m}분` : `${m}분`; };
const his = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');

async function quietNotice(db: { exec: (s: string, p?: unknown[]) => Promise<number> }) {
  await db.exec("UPDATE StudyCorrectionNotice SET acknowledged_at = NOW() WHERE ID = 'xmyroom01'"); // the popup is covered in home.spec.ts
}
const rows = (page: Page) => page.locator('main table').first().locator('tbody tr');

test('학습기록: summary, 10-row paging, stored seconds per (content, Seq), floors', async ({ page, checks, db }) => {
  await quietNotice(db);
  await hidePopups(page);
  await openAs(page, ME, '/my/records');
  await expect(page.getByRole('heading', { name: '학습기록·이수내역', level: 1 })).toBeVisible();
  // summary (tab-history.php:162-216): 13 rows, 1 이수완료 (E2EY01 24402, 180/180 s), global 41,396 s → "11시간 29분"
  const summary = page.getByRole('region', { name: '학습 이력 요약' });
  await expect(summary).toContainText('총 수강 과정13개');
  await expect(summary).toContainText('완료1개');
  await expect(summary).toContainText('진행중12개');
  await expect(summary).toContainText('누적 학습시간11시간 29분');
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByText('전체 13개 중 1-10개 표시 (1/2 페이지)')).toBeVisible();
  await checks.checkpoint('records-page1');

  // every row = SUM(StudyTime) of that (LectureCode, Study_Seq), newest MAX(RegDate) first
  const expected = await db.query<{ LectureCode: string; Study_Seq: number; t: number; last: string }>(
    "SELECT LectureCode, Study_Seq, SUM(StudyTime) t, DATE_FORMAT(MAX(RegDate), '%Y-%m-%d') last FROM Progress WHERE ID = ? GROUP BY LectureCode, Study_Seq ORDER BY MAX(RegDate) DESC", [ME]);
  expect(expected).toHaveLength(13);
  for (let i = 0; i < 10; i++) {
    const r = rows(page).nth(i);
    await expect(r.locator('td').nth(0)).toHaveText(expected[i].last);
    await expect(r.locator('td').nth(3)).toHaveText(hm(expected[i].t));
  }
  await page.getByRole('navigation', { name: /페이지/ }).getByRole('button', { name: '2', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByText('전체 13개 중 11-13개 표시 (2/2 페이지)')).toBeVisible();
  for (let i = 0; i < 3; i++) await expect(rows(page).nth(i).locator('td').nth(3)).toHaveText(hm(expected[10 + i].t));
  await checks.checkpoint('records-page2');

  // E2ER01 on the ended Seq: 3,599 s → "59분", chapter 99 % → 진행중 (never rounded up to 1시간 / 100 % / 이수완료)
  await page.goto('/my/records?q=' + encodeURIComponent('라이브 특강'));
  await expect(rows(page)).toHaveCount(1);
  const live = rows(page).first();
  await expect(live.locator('td').nth(3)).toHaveText('59분');
  await expect(live.locator('td').nth(4)).toHaveText('99%');
  await expect(live.locator('td').nth(2)).toHaveText('진행중');
  await expect(live.getByRole('button', { name: '이수증 출력' })).toHaveCount(0);
});

test('학습기록 filters: 이수완료 / 진행중 / 연도 / 검색 / 진도율순, empty filtered state', async ({ page, checks, db }) => {
  await quietNotice(db);
  await hidePopups(page);
  await openAs(page, ME, '/my/records');
  const status = page.getByRole('group', { name: '학습 상태 필터' });
  await status.getByRole('button', { name: '이수완료' }).click();
  await expect(rows(page)).toHaveCount(1);
  const done = rows(page).first();
  await expect(done).toContainText('[E2E] 1분 엑셀 단축키');
  await expect(done.locator('td').nth(2)).toHaveText('이수완료');
  await expect(done).toContainText('완료일: '); // ≥100 → 완료일 + 학습시간 {floor(s/60)}분
  await expect(done).toContainText('학습시간: 3분');
  await expect(done.getByRole('button', { name: '이수증 출력' })).toBeVisible();
  await expect(done.getByRole('link', { name: '복습하기' })).toBeVisible();
  await checks.checkpoint('records-completed');
  await status.getByRole('button', { name: '진행중' }).click();
  await expect(page.getByText(/^학습기록 12건/)).toBeVisible();
  await status.getByRole('button', { name: '전체' }).click();
  await expect(page.getByText(/^학습기록 13건/)).toBeVisible();
  // year of the last study date: all rows are 2026 (dates are relative to today, 2026-10)
  const year = new Date().getFullYear();
  await page.getByLabel('연도').selectOption(String(year - 1));
  await expect(page.getByText('조건에 맞는 학습기록이 없습니다')).toBeVisible();
  await checks.checkpoint('records-empty-filter');
  await page.getByLabel('연도').selectOption(String(year));
  await expect(page.getByText(/^학습기록 13건/)).toBeVisible();
  // name search
  await page.getByLabel('콘텐츠명 검색').fill('엑셀');
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await expect(rows(page)).toHaveCount(2); // E2EY01 on both enrollments
  // 진도율순: highest progress first
  await page.getByRole('button', { name: '초기화' }).click();
  await page.getByLabel('정렬').selectOption('progress');
  await expect(rows(page).first().locator('td').nth(4)).toHaveText('100%');
  await expect(rows(page).nth(1).locator('td').nth(4)).toHaveText('99%');
});

test('이수증 출력 (certificate_pdf01.php): own completed row prints; incomplete and foreign rows are refused', async ({ page, checks, db }) => {
  await quietNotice(db);
  await hidePopups(page);
  const { accessToken } = await openAs(page, ME, '/my/records?status=completed');
  await expect(rows(page)).toHaveCount(1);
  const pdfRes = page.waitForResponse((r) => r.url().includes('/v1/my/certificates/subject/pdf'));
  const popup = page.waitForEvent('popup');
  await rows(page).first().getByRole('button', { name: '이수증 출력' }).click();
  await (await popup).close().catch(() => undefined);
  const res = await pdfRes;
  expect(res.status()).toBe(200);
  expect(res.url()).toMatch(/lectureCode=E2EY01&seq=24402/);
  const api = authed(page, accessToken);
  const pdf = await api.get('/v1/my/certificates/subject/pdf?lectureCode=E2EY01&seq=24402');
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect(dispositionType(pdf)).toBe('inline');
  expect(fileNameOf(pdf)).toMatch(/^이수증_\d{14}\.pdf$/);
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const text = pdfText(bytes);
  expect(text).toContain('나보정');
  expect(text).toContain('[E2E] 1분 엑셀 단축키');
  // 99 % row (3,599 s) is not 이수완료 → refused with the API message; another learner's Seq → not found
  const live = await api.get('/v1/my/certificates/subject/pdf?lectureCode=E2ER01&seq=24401');
  expect(live.status()).toBe(403);
  expect((await live.json()).error.message).toBe('이수 완료(진도율 100% 또는 수료)된 콘텐츠만 이수증을 출력할 수 있습니다.');
  const foreign = await api.get('/v1/my/certificates/subject/pdf?lectureCode=E2EX01&seq=9403');
  expect(foreign.status()).toBe(404);
  expect((await foreign.json()).error.message).toBe('해당 과정의 수강 정보를 찾을 수 없습니다.');
  await checks.checkpoint('records-certificate');
});

test('홈 상세보기: X / 마이크로러닝 / 숏폼 tables with H:i:s from the stored seconds and FLOOR(Σ/54000×100)', async ({ page, checks, db }) => {
  await quietNotice(db);
  await hidePopups(page);
  await openAs(page, ME, '/my');
  await page.getByRole('button', { name: '상세보기', exact: true }).click();
  for (const [type, label] of [['X', '이러닝'], ['Z', '마이크로러닝'], ['Y', '숏폼']] as const) {
    const exp = await db.query<{ LectureCode: string; Study_Seq: number; t: number }>(
      "SELECT a.LectureCode, a.Study_Seq, SUM(a.StudyTime) t FROM Progress a JOIN Course b ON b.LectureCode = a.LectureCode AND b.Del = 'N' WHERE a.ID = ? AND b.ServiceType = ? GROUP BY a.LectureCode, a.Study_Seq ORDER BY MAX(a.RegDate) DESC", [ME, type]);
    const sec = page.getByRole('region', { name: label, exact: true });
    await expect(sec.getByText(`총 ${exp.length}개`)).toBeVisible();
    const tr = sec.locator('tbody tr');
    await expect(tr).toHaveCount(exp.length);
    for (let i = 0; i < exp.length; i++) {
      await expect(tr.nth(i).locator('td').nth(3)).toHaveText(his(exp[i].t));
      const pct = Math.min(100, Math.max(exp[i].t > 0 ? 1 : 0, Math.floor((exp[i].t / 54000) * 100)));
      await expect(tr.nth(i).locator('td').nth(4)).toHaveText(`${pct}%`);
    }
  }
  // E2ER01 (Course.ServiceType R) is in none of the three tables (lecture_status_tables.php filters b.ServiceType)
  await expect(page.getByRole('region', { name: '이러닝', exact: true }).getByText('[E2E] 라이브 특강')).toHaveCount(0);
  await checks.checkpoint('home-tables');
});

test('이수내역: per enrollment from the stored flags — 미수료 for the ended 24401, 학습 중 for 24402', async ({ page, checks, db }) => {
  await quietNotice(db);
  await hidePopups(page);
  await openAs(page, ME, '/my/records?tab=completion');
  await expect(rows(page)).toHaveCount(2);
  const active = rows(page).filter({ hasText: '#24402' });
  await expect(active).toContainText('07시간 06분');
  await expect(active).toContainText('47%');
  await expect(active).toContainText('학습 중 집계');
  const ended = rows(page).filter({ hasText: '#24401' });
  await expect(ended).toContainText('04시간 23분');
  await expect(ended).toContainText('29%');
  await expect(ended).toContainText('미수료');
  await expect(ended).toContainText('훈련 종료 시 환급 인정 수강시간이 15시간 미만입니다.');
  await checks.checkpoint('completion-tab');
  // drill-down of the active enrollment: chapter rows with the stored seconds
  await active.getByRole('link', { name: '시간 상세' }).click();
  await expect(page).toHaveURL(/\/my\/records\/24402$/);
  await expect(page.getByRole('heading', { name: '학습시간 상세' })).toBeVisible();
  const x = page.getByRole('region', { name: '[E2E] 데이터 리터러시 실무' });
  await expect(x.locator('tbody tr').filter({ hasText: '02 ·' }).locator('td').nth(3)).toHaveText('2시간 1분'); // 7,261 s
  await expect(x.locator('tbody tr').filter({ hasText: '02 ·' }).locator('td').nth(2)).toHaveText('50%');
  await checks.checkpoint('record-chapters');
  // another learner's enrollment is not opened
  checks.allow(/\/v1\/my\/records\/9401\/chapters$/, 404);
  await page.goto('/my/records/9401');
  await expect(page.getByText('학습시간 상세 확인 필요')).toBeVisible();
});

test('이수내역: 비환급 기간제 (e2ewfree01, no 15h/수료 classification)', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'e2ewfree01', '/my/records?tab=completion');
  const w = rows(page).first();
  await expect(w).toContainText('비환급');
  await expect(w).toContainText('기간제 학습기록');
  await expect(w).toContainText('—');
  await expect(w.getByText(/^(미수료|수료)$/)).toHaveCount(0); // (the note itself says "환급 수료·미수료로 분류하지 않습니다")
  await checks.checkpoint('completion-w');
});

test('이수내역: e2epass01 수료 row', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'e2epass01', '/my/records?tab=completion');
  const r = rows(page).first();
  await expect(r).toContainText('#9403');
  await expect(r).toContainText('15시간 00분');
  await expect(r).toContainText('수료');
  await expect(r).toContainText('훈련이 종료되고 인정 수강시간이 확정되었습니다.');
  await checks.checkpoint('completion-pass');
});
