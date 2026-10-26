/**
 * 사후역량진단 (archive/post/post_test01-03.html + archive_ability_b_input.php): the page gates (사전 of the same Seq, 15 h of study —
 * e2elearn01 at 14 h 59 m refused, e2elearn15 at exactly 15 h allowed — admin POST grant without 15 h), the three pages and what each save
 * writes, the 사후 score (per question TEXT the MAX, category = round(avg, 1), total = mean of non-zero categories), Member.AbilityAfterYN
 * once, PassOK refresh, grant consumption on the last page, and the retro 사후 of a closed 비환급 enrollment.
 */
import type { Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { choose } from './kit';
import { openAs, loginViaUi } from '../support/login';
import { db } from '../support/db';
import { ACCOUNTS } from '../support/accounts';

test.use({ area: 'assessment' });

const auth = async (page: Page, token: string, path: string) => {
  const res = await page.request.get(`/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status(), body: await res.json() };
};
/** PHP round($v, 1) for the values in this spec (no .x5 ties occur). */
const round1 = (v: number) => Math.round(v * 10) / 10;
/** hrde_post_assessment_mypage_totalscore2 by hand: per text MAX(aValue/5*100), category = round(avg,1), total = round(mean of non-zero,1). */
function phpPostTotal(groups: { common: Record<string, number[]>; leader: Record<string, number[]>; job: Record<string, number[]> }) {
  const cat = (g: Record<string, number[]>) => { const v = Object.values(g).map((xs) => Math.max(...xs.map((x) => (x / 5) * 100))); return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
  const c = cat(groups.common), l = cat(groups.leader), j = cat(groups.job);
  const nz = [c, j, l].filter((x) => x > 0);
  return { common: c, leader: l, job: j, total: nz.length ? round1(nz.reduce((a, b) => a + b, 0) / nz.length) : 0 };
}

const star = (page: Page, text: string, n: number) => page.getByRole('radio', { name: `${text} · ${n}점` });

test('사후 page gates: 14 h 59 m refused with the PHP study-time text, exactly 15 h allowed, 사전 first, grant opens without 15 h', async ({ page, checks, db: d }) => {
  await d.exec("DELETE ar FROM ArchiveAbilityResult2 ar INNER JOIN ArchiveQuestion q ON q.idx = ar.question_idx WHERE ar.ID = 'e2elearn15' AND q.aType = 'A'");
  // e2elearn01: 53,940 s → post_test01.html:53-60 message with "현재 학습 시간: 14시간 59분"
  checks.allow(/\/v1\/assessment\/post\/form/, 403);
  await hidePopups(page);
  const l1 = await openAs(page, 'e2elearn01', '/assessment/post');
  const gate = page.locator('[data-state="NO_ACCESS"]');
  await expect(gate).toContainText('사후역량진단은 학습 시간이 15시간 이상일 때 진행할 수 있습니다.');
  await expect(gate).toContainText('현재 학습 시간: 14시간 59분');
  await checks.checkpoint('post-gate-1459');
  const api1 = await auth(page, l1.accessToken, '/assessment/post/form');
  expect(api1).toMatchObject({ status: 403, body: { error: { code: 'FORBIDDEN', details: { reason: 'STUDY_TIME', totalSeconds: 53_940, requiredSeconds: 54_000 } } } });
  // the hub: no 사후 button, the 15-hour note instead
  await page.goto('/my/assessment');
  await expect(page.getByText('누적 학습 15시간 달성 후', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '사후역량진단 시작하기' })).toHaveCount(0);
  await page.context().clearCookies();

  // e2elearn15: exactly 54,000 s → open (>= 15 h), the hub shows the 수료 안내 banner and the 사후 CTA
  await openAs(page, 'e2elearn15', '/my/assessment');
  await expect(page.getByText('누적 학습 15시간을 달성하셨습니다. 사후역량진단을 완료하시면 수료 처리됩니다.')).toBeVisible();
  await checks.checkpoint('post-hub-15h');
  await page.getByRole('link', { name: '사후역량진단 시작하기' }).first().click();
  await expect(page).toHaveURL(/\/assessment\/post$/);
  await expect(page.getByRole('button', { name: '사후역량진단 시작하기' })).toBeVisible();
  await checks.checkpoint('post-intro-15h');
  await page.context().clearCookies();

  // e2epre01: 사전 of the same Seq first (post_test01.html:40-50)
  await openAs(page, 'e2epre01', '/assessment/post');
  await expect(page.locator('[data-state="NO_ACCESS"]')).toContainText('현재 수강 차수의 사전역량진단을 먼저 완료해주세요.');
  await page.context().clearCookies();
});

test('admin POST grant (e2egrant01, 10 h): login lands on the 역량진단 tab, the granted form opens, the last page consumes the grant; PassOK stays N', async ({ page, checks, db: d }) => {
  const me = ACCOUNTS.e2egrant01;
  await d.exec("DELETE ar FROM ArchiveAbilityResult2 ar INNER JOIN ArchiveQuestion q ON q.idx = ar.question_idx WHERE ar.ID = ? AND q.aType = 'A'", [me.id]);
  await d.exec("UPDATE AssessmentAccessGrant SET Status = 'ACTIVE', ConsumedAt = NULL, ExpiresAt = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE LearnerID = ? AND AssessmentType = 'POST'", [me.id]);
  await d.exec("UPDATE Member SET AbilityAfterYN = 'N', AbilityAfterDate = NULL WHERE ID = ?", [me.id]);
  await d.exec("UPDATE Study SET PassOK = 'N' WHERE Seq = ?", [me.studySeq]);
  await hidePopups(page);
  await loginViaUi(page, me.id); // next = assessment-grant → /my/assessment (login_ok.php:66-76)
  await expect(page.getByText('이 수강 차수의 사후역량진단이 열렸습니다.', { exact: false })).toBeVisible();
  await checks.checkpoint('grant-hub');
  await page.goto(`/assessment/post?studySeq=${me.studySeq}&grant=1`);
  await expect(page.getByText('관리자 개방').first()).toBeVisible();
  await page.getByRole('button', { name: '사후역량진단 시작하기' }).click();
  for (const [t, n] of [['의사소통', 4], ['자기계발', 4], ['리더십1', 4]] as const) await choose(star(page, t, n).first());
  await choose(star(page, '의사소통', 4).nth(1)); // question 23001 (same text)
  const save1 = page.waitForResponse((r) => r.url().endsWith('/v1/assessment/post/answers'));
  await page.getByRole('button', { name: '다음', exact: true }).click();
  expect((await save1).request().postDataJSON()).toMatchObject({ step: 'common', final: false, grant: true, studySeq: me.studySeq });
  expect(await d.scalar("SELECT Status FROM AssessmentAccessGrant WHERE LearnerID = ? AND AssessmentType = 'POST'", [me.id])).toBe('ACTIVE'); // only grantFinal=1 consumes
  await choose(star(page, '직무1', 3));
  await page.getByRole('button', { name: '다음', exact: true }).click();
  for (const t of ['콘텐츠 만족도', '업무 도움', '추천 의향']) await choose(star(page, t, 5));
  const saveLast = page.waitForResponse((r) => r.url().endsWith('/v1/assessment/post/answers'));
  await page.getByRole('button', { name: '완료', exact: true }).click();
  expect((await saveLast).request().postDataJSON()).toMatchObject({ step: 'satisfaction', final: true, grant: true });
  await expect(page.getByText('선택한 수강 차수의 사후역량진단이 완료되었습니다.')).toBeVisible();
  await checks.checkpoint('grant-done');
  expect(await d.one('SELECT Status, ConsumedAt IS NOT NULL AS consumed FROM AssessmentAccessGrant WHERE LearnerID = ? AND AssessmentType = ?', [me.id, 'POST'])).toEqual({ Status: 'CONSUMED', consumed: 1 });
  // 사후 submitted but 36,000 s < 54,000 → PassOK N (dual gate); AbilityAfterYN is set (submitted, not retro)
  expect(await d.one('SELECT PassOK, Progress FROM Study WHERE Seq = ?', [me.studySeq])).toEqual({ PassOK: 'N', Progress: 66 });
  expect(await d.scalar('SELECT AbilityAfterYN FROM Member WHERE ID = ?', [me.id])).toBe('Y');
});

const X2 = { id: 'xassess02', seq: 23102 };

test('사후 submit (xassess02, 15 h): per-text MAX score, AbilityAfterYN once, PassOK refresh → Y, result page numbers vs the PHP formula', async ({ page, checks, db: d }) => {
  await d.exec("DELETE ar FROM ArchiveAbilityResult2 ar INNER JOIN ArchiveQuestion q ON q.idx = ar.question_idx WHERE ar.ID = ? AND q.aType = 'A'", [X2.id]);
  await d.exec("UPDATE Member SET AbilityAfterYN = 'N', AbilityAfterDate = NULL WHERE ID = ?", [X2.id]);
  await d.exec("UPDATE Study SET PassOK = 'N', Progress = 100 WHERE Seq = ?", [X2.seq]);
  await hidePopups(page);
  const login = await openAs(page, X2.id, '/assessment/post');
  await page.getByRole('button', { name: '사후역량진단 시작하기' }).click();
  await expect(page.getByRole('heading', { name: '01 · 공통역량 / 리더십역량' })).toBeVisible();
  await expect(page.getByText('6. 리더십1')).toBeVisible(); // post_test01.html:181 — 리더십 numbered aOrder + 5
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled(); // validateSurvey: every question first
  await choose(star(page, '의사소통', 2).first()); // q11 = 2 → 40
  await choose(star(page, '자기계발', 4)); // q12 = 4 → 80
  await choose(star(page, '의사소통', 5).nth(1)); // q23001 (same text) = 5 → 100
  await choose(star(page, '리더십1', 3)); // q13 = 3 → 60
  await checks.checkpoint('post-page1');
  const s1 = page.waitForResponse((r) => r.url().endsWith('/v1/assessment/post/answers'));
  await page.getByRole('button', { name: '다음', exact: true }).click();
  expect((await s1).status()).toBe(200);
  const answers = () => d.query<{ question_idx: number; aValue: string }>("SELECT ar.question_idx, ar.aValue FROM ArchiveAbilityResult2 ar INNER JOIN ArchiveQuestion q ON q.idx = ar.question_idx WHERE ar.ID = ? AND ar.Study_Seq = ? AND q.aType = 'A' ORDER BY ar.question_idx", [X2.id, X2.seq]);
  expect(await answers()).toEqual([{ question_idx: 11, aValue: '2' }, { question_idx: 12, aValue: '4' }, { question_idx: 13, aValue: '3' }, { question_idx: 23001, aValue: '5' }]);
  // archive_ability_b_input.php:91-104 — after a step02/03 save: PassOK refresh, then AbilityAfterYN once 총합 사후 ≥ 1
  const firstDate = await d.scalar<string>('SELECT AbilityAfterDate FROM Member WHERE ID = ? AND AbilityAfterYN = ?', [X2.id, 'Y']);
  expect(firstDate).toBeTruthy();
  expect(await d.one('SELECT PassOK, Progress FROM Study WHERE Seq = ?', [X2.seq])).toEqual({ PassOK: 'Y', Progress: 100 }); // 54,000 s AND 사후 ≥ 1

  // ---- page 2: [실무자 직무역량] (A·step03·W)
  await expect(page.getByText('[실무자 직무역량]').first()).toBeVisible();
  await choose(star(page, '직무1', 4)); // q14 = 4 → 80
  await page.getByRole('button', { name: '다음', exact: true }).click();
  // ---- page 3: HRDe아카이브 향상도 (A·step01·A), final → done
  await expect(page.getByText('HRDe아카이브에 대한 향상도를 평가해 주세요.').first()).toBeVisible();
  for (const [t, n] of [['콘텐츠 만족도', 5], ['업무 도움', 4], ['추천 의향', 5]] as const) await choose(star(page, t, n));
  await checks.checkpoint('post-page3');
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(page.getByText('사후역량진단이 제출되었습니다.')).toBeVisible();
  await expect(page.getByText('수료 요건(사후역량진단 + 15시간)을 충족했습니다.')).toBeVisible();
  await checks.checkpoint('post-done');
  expect(await d.scalar('SELECT AbilityAfterDate FROM Member WHERE ID = ?', [X2.id])).toBe(firstDate); // set once (IFNULL(AbilityAfterYN,'') != 'Y')

  // ---- the score the PassOK gate reads, by hand (per TEXT the MAX: 의사소통 = max(40, 100))
  const php = phpPostTotal({ common: { 의사소통: [2, 5], 자기계발: [4] }, leader: { 리더십1: [3] }, job: { 직무1: [4] } });
  expect(php).toEqual({ common: 90, leader: 60, job: 80, total: 76.7 });
  const phpPre = phpPostTotal({ common: { 의사소통: [4], 자기계발: [3] }, leader: { 리더십1: [4] }, job: { 직무1: [3] } });
  expect(phpPre.total).toBe(70);
  const res = await auth(page, login.accessToken, `/assessment/result?studySeq=${X2.seq}`);
  expect(res.body.scores).toEqual({ common: { pre: 70, post: php.common }, leader: { pre: 80, post: php.leader }, job: { pre: 60, post: php.job }, total: { pre: phpPre.total, post: php.total } });
  expect(res.body.post).toMatchObject({ submitted: true, total: 76.7 });
  expect(res.body.improvement).toBe(6.7);
  expect(res.body.recommendations).toEqual(['LEADER_DOWN', 'KEEP_GROWING']); // assessment_report.html:255-276 order

  // ---- result page
  await page.getByRole('link', { name: '결과 보기' }).click();
  await expect(page).toHaveURL(/\/assessment\/result/);
  await expect(page.getByText('역량 향상도: 6.7점 상승')).toBeVisible();
  await expect(page.getByText('리더십 역량 개발을 위한 전문 프로그램을 고려하세요.')).toBeVisible();
  await expect(page.getByText('우수한 성장세를 유지하기 위해 지속적인 학습을 권장합니다.')).toBeVisible();
  const common = page.getByRole('region', { name: '공통 역량 진단 상세 보기' });
  const row = common.getByRole('row').filter({ hasText: '의사소통' });
  await expect(row).toContainText('80점');
  await expect(row).toContainText('100점');
  await expect(row).toContainText('+20');
  await checks.checkpoint('result');

  // ---- saving page 1 again (응답 수정) keeps AbilityAfterDate (once) and PassOK Y
  const again = await page.request.post('/v1/assessment/post/answers', { data: { studySeq: X2.seq, step: 'common', answers: [{ questionIdx: 11, value: 3 }], final: false }, headers: { Authorization: `Bearer ${login.accessToken}` } });
  expect(again.status()).toBe(200);
  expect(await d.scalar('SELECT AbilityAfterDate FROM Member WHERE ID = ?', [X2.id])).toBe(firstDate);
  expect(await d.scalar('SELECT PassOK FROM Study WHERE Seq = ?', [X2.seq])).toBe('Y');
});

test('retro 사후 of a closed 비환급 enrollment (xassess03, admin grant): 1차 panel, closed-W PassOK refresh, no AbilityAfterYN, grant consumed', async ({ page, checks, db: d }) => {
  const id = 'xassess03';
  await d.exec("DELETE ar FROM ArchiveAbilityResult2 ar INNER JOIN ArchiveQuestion q ON q.idx = ar.question_idx WHERE ar.ID = ? AND q.aType = 'A'", [id]);
  await d.exec("UPDATE AssessmentAccessGrant SET Status = 'ACTIVE', ConsumedAt = NULL, ExpiresAt = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE LearnerID = ?", [id]);
  await d.exec("UPDATE Member SET AbilityAfterYN = 'N', AbilityAfterDate = NULL WHERE ID = ?", [id]);
  await d.exec("UPDATE Study SET PassOK = 'N', Progress = 100 WHERE Seq = 23103");
  await d.exec("UPDATE Study SET PassOK = 'N', Progress = 0 WHERE Seq = 23104");
  await hidePopups(page);
  await openAs(page, id, '/my/assessment');
  await expect(page.getByText('이전 학습 기간의 수료 처리를 위해 1차 사후역량진단이 필요합니다.')).toBeVisible();
  await checks.checkpoint('retro-hub');
  await page.getByRole('link', { name: '1차 사후역량진단 시작하기 (관리자 승인)' }).click();
  await expect(page).toHaveURL(/\/assessment\/post\?studySeq=23103&grant=1$/);
  await expect(page.getByText('1차 수강 사후진단').first()).toBeVisible();
  await page.getByRole('button', { name: '사후역량진단 시작하기' }).click();
  for (const [t, n] of [['자기계발', 4], ['리더십1', 4]] as const) await choose(star(page, t, n));
  await choose(star(page, '의사소통', 4).first());
  await choose(star(page, '의사소통', 4).nth(1));
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await choose(star(page, '직무1', 4));
  await page.getByRole('button', { name: '다음', exact: true }).click();
  for (const t of ['콘텐츠 만족도', '업무 도움', '추천 의향']) await choose(star(page, t, 4));
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(page.getByText('선택한 수강 차수의 사후역량진단이 완료되었습니다.')).toBeVisible();
  // hrde_refresh_closed_w_passok_after_retro_post: W, 54,000 s, 사후 ≥ 1 → PassOK Y, Progress floor(max(54,000, open clock)/54,000×100) = 100
  expect(await d.one('SELECT PassOK, Progress FROM Study WHERE Seq = 23103')).toEqual({ PassOK: 'Y', Progress: 100 });
  expect(await d.one('SELECT PassOK, Progress FROM Study WHERE Seq = 23104')).toEqual({ PassOK: 'N', Progress: 0 }); // the open row is not refreshed
  expect(await d.scalar('SELECT AbilityAfterYN FROM Member WHERE ID = ?', [id])).toBe('N'); // retro writes no AbilityAfterYN (archive_ability_b_input.php:101)
  expect(await d.scalar("SELECT Status FROM AssessmentAccessGrant WHERE LearnerID = ? AND Study_Seq = 23103", [id])).toBe('CONSUMED');
  await checks.checkpoint('retro-done');
});
