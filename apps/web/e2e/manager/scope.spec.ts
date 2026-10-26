/**
 * 기업 교육담당자 (e2emgr01: company A own + B via MemberCompany; C's MemberCompany row is Del='Y') — docs/learner-parity/manager.md
 * §2.1–2.4, §2.10. Dashboard counts, 수강생 관리 list/detail scoped to A+B: every C-company and base learner is invisible in lists,
 * details and API answers, also when their ids are typed directly. Figures come from the stored rows (floored).
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { COMPANY } from '../support/accounts';
import { authed } from '../myroom/helpers';
import type { Page } from '@playwright/test';

test.use({ area: 'manager', contextOptions: { reducedMotion: 'reduce' } });

const MGR = 'e2emgr01';
const AB = [COMPANY.A.code, COMPANY.B.code];
/** Learners that must never appear for e2emgr01: company C (incl. the 나의학습실 fixtures) and the base company. */
const FOREIGN = ['e2ecco01', 'e2ecco02', 'xmyroom01', 'xmyroom02', 'test01', 'user01'];
const FOREIGN_SEQS = [9415, 9416, 24401, 24402, 1, 2];
type Db = { query: <T extends object>(s: string, p?: unknown[]) => Promise<T[]>; scalar: <T>(s: string, p?: unknown[]) => Promise<T | null> };

async function abEnrollments(db: Db, year?: number) {
  return db.query<{ Seq: number; ID: string; CompanyCode: string; t: number }>(
    `SELECT s.Seq, s.ID, s.CompanyCode, (SELECT COALESCE(SUM(p.StudyTime), 0) FROM Progress p WHERE p.Study_Seq = s.Seq) t
       FROM Study s JOIN Course c ON c.LectureCode = s.LectureCode AND c.PackageYN = 'Y'
      WHERE s.CompanyCode IN (?, ?) AND s.ServiceType IN ('A','W','Z')
        ${year ? 'AND s.LectureStart <= ? AND s.LectureEnd >= ?' : ''}`, year ? [...AB, `${year}-12-31`, `${year}-01-01`] : AB);
}
const kr = (s: number) => (s > 0 ? `${String(Math.floor(s / 3600)).padStart(2, '0')}시간 ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}분` : '-');

async function chooseCompany(page: Page, label: string) {
  await page.locator('#mgr-company').click();
  await page.getByRole('option', { name: label }).click();
}

test('dashboard: 2 companies, counts from the stored rows, company switch, no C company', async ({ page, checks, db }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, MGR, '/manager');
  await expect(page.getByText('2개 기업 · 전체 합계')).toBeVisible();
  // tab-manager-ai.php population: A/W/Z, StudyEnd N/NULL, learner level
  const learners = await db.query<{ ID: string; p: number; pass: number }>(
    "SELECT ID, MAX(Progress) p, MAX(PassOK = 'Y') pass FROM Study WHERE CompanyCode IN (?, ?) AND ServiceType IN ('A','W','Z') AND IFNULL(StudyEnd, 'N') = 'N' GROUP BY ID", AB);
  const total = learners.length;
  const done = learners.filter((l) => Number(l.pass) === 1).length;
  const avgProgress = Math.round(learners.reduce((a, l) => a + Number(l.p), 0) / total);
  const api = authed(page, accessToken);
  const ov = await (await api.get('/v1/manager/overview')).json();
  expect(ov.stats.totalLearners).toBe(total);
  expect(ov.stats.completedLearners).toBe(done);
  expect(ov.stats.avgCompletionRate).toBe(Math.round((done / total) * 100));
  expect(ov.stats.avgProgressRate).toBe(avgProgress);
  expect(ov.stats.safeLearners + ov.stats.warningLearners + ov.stats.atRiskLearners).toBe(total);
  await expect(page.getByText(`수료 ${done}명 / ${total}명`)).toBeVisible();
  // 관리 기업 table: A (본인 기업) and B only
  const companies = await (await api.get('/v1/manager/companies')).json();
  expect(companies.map((c: { companyCode: string }) => c.companyCode).sort()).toEqual([...AB].sort());
  await expect(page.getByText(COMPANY.C.name)).toHaveCount(0);
  await checks.checkpoint('overview-all');
  // switching to company B narrows every figure to B (e2ebco01 + xmanager01 active)
  await chooseCompany(page, COMPANY.B.name);
  const bLearners = Number(await db.scalar("SELECT COUNT(DISTINCT ID) FROM Study WHERE CompanyCode = ? AND ServiceType IN ('A','W','Z') AND IFNULL(StudyEnd, 'N') = 'N'", [COMPANY.B.code]));
  await expect(page.getByText(new RegExp(`수료 \\d+명 / ${bLearners}명`))).toBeVisible();
  await expect(page.getByText(`${COMPANY.B.code} · 수강생`)).toBeVisible();
  await checks.checkpoint('overview-company-b');
});

test('수강생 관리: every A+B enrollment, none of C / base, PHP sections and stored times', async ({ page, checks, db }) => {
  await hidePopups(page);
  await openAs(page, MGR, '/manager/trainees');
  const rows = await abEnrollments(db);
  await expect(page.getByText(`전체 ${rows.length}건 수강`)).toBeVisible();
  const table = page.locator('main table tbody tr');
  await expect(table).toHaveCount(rows.length);
  for (const id of FOREIGN) await expect(page.getByText(id, { exact: true })).toHaveCount(0);
  await expect(page.getByText('E2E 타사상사')).toHaveCount(0);
  // sections in the PHP order: 환급 과정 then 비환급 과정
  await expect(page.getByRole('region', { name: '환급 과정', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '비환급 과정' })).toContainText('e2ewfree01');
  // 총 학습시간 = Σ stored seconds of the enrollment, "%02d시간 %02d분" floored, "-" for 0
  for (const r of rows) {
    const tr = table.filter({ has: page.getByText(r.ID, { exact: true }) });
    await expect(tr.filter({ hasText: kr(Number(r.t)) }).first()).toBeVisible();
  }
  const x = table.filter({ has: page.getByText('xmanager01', { exact: true }) });
  await expect(x).toContainText('03시간 03분'); // 11,037 s
  await expect(x).toContainText('20%');
  await expect(x).toContainText('E2E 이투이테크'); // 사업장 column (2 companies, 전체)
  await checks.checkpoint('trainees');
  // search by a C learner's id → nothing
  await page.locator('#tr-q').fill('e2ecco01');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.getByText('수강생이 없습니다.')).toBeVisible();
  await checks.checkpoint('trainees-search-foreign');
});

test('C / base learners typed directly: detail page and every API answer refuse (404 / 403), never a figure', async ({ page, checks }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, MGR, '/manager');
  const api = authed(page, accessToken);
  for (const [id, seq] of [['e2ecco01', 9415], ['e2ecco02', 9416], ['xmyroom01', 24402], ['test01', 1]] as const) {
    for (const p of [`/v1/manager/trainees/${id}/progress?studySeq=${seq}`, `/v1/manager/trainees/${id}/progress`, `/v1/manager/trainees/${id}/assessment?studySeq=${seq}`]) {
      const res = await api.get(p);
      expect(res.status(), p).toBe(404);
      expect((await res.json()).error.message).toBe('관리 범위 내 수강 정보를 찾을 수 없습니다.');
    }
  }
  // a foreign Seq under an own learner's id is refused too
  expect((await api.get('/v1/manager/trainees/e2elearn01/progress?studySeq=9415')).status()).toBe(404);
  const C = COMPANY.C.code;
  for (const p of [`/v1/manager/overview?companyCode=${C}`, `/v1/manager/trainees?companyCode=${C}`, `/v1/manager/completion?companyCode=${C}`, `/v1/manager/payments?companyCode=${C}`,
    `/v1/manager/trainees/export.xlsx?companyCode=${C}`, `/v1/manager/certificates?companyCode=${C}&lectureCode=ARC2026`, `/v1/manager/certificates/pdf?companyCode=${C}&lectureCode=ARC2026&serviceType=A`,
    `/v1/manager/reports/assessment?companyCode=${C}&lectureCode=ARC2026`, `/v1/manager/roster?companyCode=${C}&lectureCode=ARC2026&lectureStart=2026-01-01&lectureEnd=2026-12-31`]) {
    const res = await api.get(p);
    expect(res.status(), p).toBe(403);
    expect((await res.json()).error.message, p).toBe('해당 기업에 대한 권한이 없습니다.');
  }
  // lists without a company never carry a C learner
  for (const p of ['/v1/manager/trainees?size=100', '/v1/manager/trainees?status=guide&size=100', '/v1/manager/completion', '/v1/manager/payments?size=100', '/v1/manager/reports/assessment?lectureCode=ARC2026']) {
    const body = JSON.stringify(await (await api.get(p)).json());
    for (const id of FOREIGN) expect(body, `${p} lists ${id}`).not.toContain(`"${id}"`);
    for (const seq of FOREIGN_SEQS) expect(body, `${p} lists Seq ${seq}`).not.toMatch(new RegExp(`"studySeq":${seq}[,}]`));
  }
  checks.allow(/\/v1\/manager\/trainees\/e2ecco01\/progress/, 404);
  await page.goto('/manager/trainees/e2ecco01?studySeq=9415');
  await expect(page.getByText('관리 범위 내 수강 정보를 찾을 수 없습니다.')).toBeVisible();
  await expect(page.getByText('차타사')).toHaveCount(0);
  await checks.checkpoint('detail-foreign');
});

test('학습자 상세 (xmanager01, company B): stored seconds floored, chapter %, daily rows, 역량진단 area scores only, 수강현황 of the same cohort', async ({ page, checks, db }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, MGR, '/manager/trainees/xmanager01?studySeq=25401');
  await expect(page.getByRole('heading', { name: '학습자 상세 · 구분초' })).toBeVisible();
  const main = page.locator('main');
  await expect(main.getByText('03시간 03분')).toBeVisible();
  await expect(main.getByText('(11,037초)')).toBeVisible();
  // chapters: 3,599 s → 59분 (not 1시간), 7,259 s → 2시간 (not 2시간 1분), 179 s → 2분 (not 3분); % floored
  const ch = (title: string) => main.locator('tr').filter({ hasText: title });
  await expect(ch('1. 데이터로 말하는 습관').locator('td').nth(5)).toHaveText('59분');
  await expect(ch('1. 데이터로 말하는 습관').locator('td').nth(4)).toContainText('24%');
  await expect(ch('2. 숫자를 그림으로').locator('td').nth(5)).toHaveText('2시간');
  await expect(ch('엑셀 단축키 TOP 5').locator('td').nth(5)).toHaveText('2분');
  await expect(ch('엑셀 단축키 TOP 5').locator('td').nth(4)).toContainText('99%');
  // daily (ProgressLog MAX−MIN per day): the same floors
  const days = await db.query<{ d: string; s: number }>("SELECT DATE_FORMAT(RegDate, '%Y-%m-%d') d, MAX(StudyTime) s FROM ProgressLog WHERE Study_Seq = 25401 GROUP BY d ORDER BY d");
  for (const d of days) {
    const want = Number(d.s) >= 3600 ? `${Math.floor(Number(d.s) / 3600)}시간${Math.floor((Number(d.s) % 3600) / 60) ? ` ${Math.floor((Number(d.s) % 3600) / 60)}분` : ''}` : `${Math.floor(Number(d.s) / 60)}분`;
    await expect(main.locator('tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^${d.d}$`) }) }).locator('td').nth(1)).toHaveText(want);
  }
  // 역량진단 보기: area scores only — no question text / answers in the screen or the API answer
  await expect(main.getByText('개인 진단의 문항 응답·AI 대화는 제공하지 않습니다.')).toBeVisible();
  await expect(main.getByText('90.0점')).toBeVisible(); // 공통역량 (pre answers of 25401)
  const as = await (await authed(page, accessToken).get('/v1/manager/trainees/xmanager01/assessment?studySeq=25401')).json();
  expect(Object.keys(as).sort()).toEqual(['comparable', 'courseName', 'period', 'post', 'pre', 'studySeq', 'trainee']);
  expect(JSON.stringify(as)).not.toMatch(/aValue|question|answers/i);
  // 수강현황: company B · ARC2026 · the 9301 period → B learners only
  const roster = page.getByRole('heading', { name: '수강현황 (같은 과정·수강기간)' }).locator('xpath=ancestor::*[.//table][1]');
  await expect(roster.getByText('xmanager01')).toBeVisible();
  await expect(roster.getByText('e2ebco01')).toBeVisible();
  await expect(roster.getByText('e2elearn01')).toHaveCount(0);
  // 진도율 = AVG(Progress.Progress) of the enrollment (manager_trainee_list.php:197-201), 수강시간 gmdate H:i:s of the stored seconds
  await expect(roster.getByRole('row', { name: /xmanager01/ })).toContainText('57.7%');
  await expect(roster.getByRole('row', { name: /xmanager01/ })).toContainText('03:03:57');
  await checks.checkpoint('trainee-detail');
  // print-friendly summary (/manager/reports/:id) uses the same floors
  await page.getByRole('link', { name: '보고서 보기' }).click();
  await expect(page).toHaveURL(/\/manager\/reports\/xmanager01\?studySeq=25401$/);
  const rep = page.locator('article');
  await expect(rep).toContainText('03시간 03분 (11,037초)');
  await expect(rep.locator('tr').filter({ hasText: '1. 데이터로 말하는 습관' }).locator('td').nth(5)).toHaveText('59분');
  await expect(rep.locator('tr').filter({ hasText: '2. 숫자를 그림으로' }).locator('td').nth(5)).toHaveText('2시간');
  await checks.checkpoint('trainee-summary');
});

test('who may enter: a learner gets NO_ACCESS (screen) / 403 (API); a guest is sent to login; the base manager sees only his company', async ({ page, checks }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, 'e2elearn01', '/manager');
  await expect(page.getByText('이용권한을 확인해 주세요.')).toBeVisible(); // RequireRole → NO_ACCESS for a learner
  await expect(page.getByRole('heading', { name: '기업 운영현황' })).toHaveCount(0);
  await expect(page.getByText('E2E 이투이테크')).toHaveCount(0);
  const res = await authed(page, accessToken).get('/v1/manager/overview');
  expect(res.status()).toBe(403);
  expect((await res.json()).error.message).toBe('교육담당자만 이용할 수 있습니다.');
  await checks.checkpoint('manager-learner-denied');
  // base-company manager (mgr01): his own company only — none of the e2e companies
  const mgr = await openAs(page, 'mgr01', '/manager/trainees');
  const companies = await (await authed(page, mgr.accessToken).get('/v1/manager/companies')).json();
  expect(companies.map((c: { companyCode: string }) => c.companyCode)).toEqual([COMPANY.base.code]);
  await expect(page.getByRole('heading', { name: '수강생 관리' })).toBeVisible();
  for (const id of ['e2elearn01', 'e2ebco01', 'e2ecco01', 'xmanager01']) await expect(page.getByText(id, { exact: true })).toHaveCount(0);
  // guest
  await page.context().clearCookies();
  await page.goto('/manager/trainees');
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fmanager%2Ftrainees/);
});
