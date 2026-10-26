/**
 * 교육결과보고서 for the manager (education_results_report.php + include/manager_report_lib.php, manager.md §2.8): own company only
 * (hrde_report_authorize — MemberCompany companies are refused), aggregated on request (digest; a change before 반출 is detected),
 * HTML/CSV export (no script, BOM, formula guard), and the 1,000-learner cap (409, no partial totals).
 */
import fs from 'node:fs';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { COMPANY } from '../support/accounts';
import { authed } from '../myroom/helpers';

test.use({ area: 'manager', contextOptions: { reducedMotion: 'reduce' } });

const MGR = 'e2emgr01';
type Db = { one: <T extends object>(s: string, p?: unknown[]) => Promise<T | null>; exec: (s: string, p?: unknown[]) => Promise<number>; scalar: <T>(s: string, p?: unknown[]) => Promise<T | null> };
const term = async (db: Db, idx: number) => (await db.one<{ s: string; e: string }>("SELECT DATE_FORMAT(LectureStart, '%Y-%m-%d') s, DATE_FORMAT(LectureEnd, '%Y-%m-%d') e FROM LectureTerme WHERE idx = ?", [idx]))!;
const reportUrl = (code: string, t: { s: string; e: string }) => `/manager/reports/education-results?companyCode=${code}&lectureCode=ARC2026&lectureStart=${t.s}&lectureEnd=${t.e}`;

test('company A report: own learners only, author = manager, CSV + HTML downloads, change before 반출 is detected', async ({ page, checks, db }) => {
  const t = await term(db, 9301);
  await hidePopups(page);
  await openAs(page, MGR, '/manager/reports');
  // the cohort list links to the report of the own company; B (MemberCompany) is listed but its report is refused
  const own = page.getByRole('row').filter({ hasText: `${COMPANY.A.name}의` }).filter({ hasText: `${t.s} ~ ${t.e}` });
  await expect(own.getByRole('link', { name: '교육결과보고서' })).toBeVisible();
  const other = page.getByRole('row').filter({ hasText: `${COMPANY.B.name}의` }).filter({ hasText: `${t.s} ~ ${t.e}` });
  await expect(other.getByRole('button', { name: '교육결과보고서' })).toBeDisabled();
  await expect(other.getByRole('button', { name: '교육결과보고서' })).toHaveAttribute('title', '교육결과보고서는 본인 기업(회원 정보의 소속 기업)만 열 수 있습니다.');
  await checks.checkpoint('reports');
  await own.getByRole('link', { name: '교육결과보고서' }).click();
  await expect(page).toHaveURL(new RegExp(`companyCode=${COMPANY.A.code}`));
  const learners = Number(await db.scalar("SELECT COUNT(DISTINCT ID) FROM Study WHERE CompanyCode = ? AND LectureCode = 'ARC2026' AND LectureStart = ? AND LectureEnd = ?", [COMPANY.A.code, t.s, t.e]));
  await expect(page.locator('main').getByText('강담당').first()).toBeVisible(); // 작성자 = the manager (manager_report_lib.php:519-521)
  await expect(page.getByText('김학습').first()).toBeVisible();
  for (const name of ['배학습', '구분초', '차타사', '나보정']) await expect(page.getByText(name)).toHaveCount(0);
  await expect(page.getByText('집계 확정 전 — 훈련 종료·수강마감 후 수치가 바뀔 수 있습니다.')).toBeVisible();
  await expect(page).toHaveTitle(`${COMPANY.A.name}_교육결과보고서`);
  await checks.checkpoint('education-report');

  // CSV: UTF-8 BOM, one row per learner, stored seconds and the floored "%02d시간 %02d분"
  let dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV 내려받기' }).click();
  let file = await dl;
  expect(file.suggestedFilename()).toBe(`${COMPANY.A.name}_교육결과보고서_${t.s}_${t.e}.csv`);
  const csv = fs.readFileSync((await file.path())!);
  expect([...csv.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = csv.toString('utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  expect(lines[0]).toBe('번호,성명,아이디,총 학습시간(초),총 학습시간,진도율(%),공통점수,직무점수,리더십점수,만족도,수료여부,집계 확정,집계 기준시각');
  expect(lines).toHaveLength(learners + 1);
  expect(lines.find((l) => l.includes(',e2elearn01,'))).toContain(',53940,14시간 59분,99,');
  expect(csv.toString('utf8')).not.toMatch(/e2ebco|xmanager|e2ecco|xmyroom/);
  // HTML: standalone file without scripts, CSP meta
  dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'HTML 내려받기' }).click();
  file = await dl;
  expect(file.suggestedFilename()).toBe(`${COMPANY.A.name}_교육결과보고서_${t.s}_${t.e}.html`);
  const html = fs.readFileSync((await file.path())!, 'utf8');
  expect(html).not.toMatch(/<script/i);
  expect(html).toContain("default-src 'none'");
  expect(html).toContain('김학습');
  expect(html).not.toMatch(/배학습|구분초|차타사/);

  // on-request aggregation: a stored change between viewing and 반출 is detected, nothing is downloaded
  await db.exec("UPDATE Progress SET StudyTime = StudyTime + 60 WHERE ID = 'e2eauth01' AND Study_Seq = 9412 AND Chapter_Seq = 9201");
  try {
    let downloaded = false;
    page.once('download', () => { downloaded = true; });
    await page.getByRole('button', { name: 'CSV 내려받기' }).click();
    await expect(page.getByText('보고서 집계가 바뀌었습니다. 최신 집계로 다시 표시합니다.')).toBeVisible();
    expect(downloaded).toBe(false);
    await checks.checkpoint('education-report-changed');
  } finally {
    await db.exec("UPDATE Progress SET StudyTime = StudyTime - 60 WHERE ID = 'e2eauth01' AND Study_Seq = 9412 AND Chapter_Seq = 9201");
  }
});

test('company B (MemberCompany) report and exports are refused like PHP (본인 기업만)', async ({ page, checks, db }) => {
  const t = await term(db, 9301);
  await hidePopups(page);
  const { accessToken } = await openAs(page, MGR, '/manager');
  const api = authed(page, accessToken);
  const qs = `companyCode=${COMPANY.B.code}&lectureCode=ARC2026&lectureStart=${t.s}&lectureEnd=${t.e}`;
  for (const p of ['', '/export.csv', '/export.html']) {
    const res = await api.get(`/v1/manager/reports/education-results${p}?${qs}`);
    expect(res.status(), p).toBe(403);
    expect((await res.json()).error).toMatchObject({ message: '로그인이 필요하거나 보고서 접근 권한이 없습니다.', details: { reason: 'REPORT_COMPANY' } });
  }
  checks.allow(/\/v1\/manager\/reports\/education-results\?/, 403);
  await page.goto(reportUrl(COMPANY.B.code, t));
  await expect(page.getByText('로그인이 필요하거나 보고서 접근 권한이 없습니다.')).toBeVisible();
  await expect(page.getByText('배학습')).toHaveCount(0);
  await checks.checkpoint('education-report-denied');
});

test('1,000-learner cap: a larger cohort is refused with the capacity message (no partial totals); exports too', async ({ page, checks, db }) => {
  const t = await term(db, 9301);
  // temporary rows: 999 extra company-A enrollments on the 9301 cohort (Study.Seq 25000–25999 except the fixture's 25401)
  await db.exec('DELETE FROM Study WHERE Seq BETWEEN 25000 AND 25999 AND Seq <> 25401');
  await db.exec(`INSERT INTO Study (Seq, LectureTerme_idx, LectureCode, ServiceType, ID, CompanyCode, LectureStart, LectureEnd, Progress, OpenChapter, PassOK, StudyEnd, StudyKey, PackageRef)
    SELECT 25000 + seq, 9301, 'ARC2026', 'A', CONCAT('xmanagercap', LPAD(seq, 4, '0')), ?, ?, ?, 0, 1, 'N', 'N', CONCAT('9301_xmanagercap', LPAD(seq, 4, '0')), 1
      FROM seq_0_to_999 WHERE seq <> 401`, [COMPANY.A.code, t.s, t.e]);
  try {
    const learners = Number(await db.scalar("SELECT COUNT(DISTINCT ID) FROM Study WHERE CompanyCode = ? AND LectureCode = 'ARC2026' AND LectureStart = ? AND LectureEnd = ?", [COMPANY.A.code, t.s, t.e]));
    expect(learners).toBeGreaterThan(1000);
    const msg = `대규모 보고서(${learners.toLocaleString('ko-KR')}명)는 배치 처리범위를 조정해야 합니다. 일부 인원의 합계만 표시하지 않습니다.`;
    await hidePopups(page);
    const { accessToken } = await openAs(page, MGR, '/manager');
    const api = authed(page, accessToken);
    const qs = `companyCode=${COMPANY.A.code}&lectureCode=ARC2026&lectureStart=${t.s}&lectureEnd=${t.e}`;
    for (const p of ['', '/export.csv', '/export.html']) {
      const res = await api.get(`/v1/manager/reports/education-results${p}?${qs}`);
      expect(res.status(), p).toBe(409);
      expect((await res.json()).error).toMatchObject({ code: 'CONFLICT', message: msg, details: { reason: 'REPORT_CAPACITY', learners, cap: 1000 } });
    }
    checks.allow(/\/v1\/manager\/reports\/education-results\?/, 409);
    await page.goto(reportUrl(COMPANY.A.code, t));
    await expect(page.getByText(msg)).toBeVisible();
    await expect(page.getByText('김학습')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'CSV 내려받기' })).toBeDisabled();
    await checks.checkpoint('education-report-cap');
  } finally {
    await db.exec('DELETE FROM Study WHERE Seq BETWEEN 25000 AND 25999 AND Seq <> 25401');
  }
});
