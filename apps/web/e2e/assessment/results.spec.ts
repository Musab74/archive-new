/**
 * 역량진단 결과 (assessment_report.html / tab-assessment.php), 추천 학습로드맵 (roadmap-recommend.php fallback — no OpenAI key locally),
 * 만족도조사 (사후 3단계 · ArchiveQuestion A/step01/A; does not touch the score or PassOK) and 나의 수강후기 (survey.html / survey_view.html /
 * survey_modify.html / survey_script.php — owner only).
 */
import { test, expect, hidePopups } from '../support/test';
import { choose } from './kit';
import { openAs } from '../support/login';
import { ACCOUNTS } from '../support/accounts';

test.use({ area: 'assessment' });

test('result page of a finished enrollment (e2epass01): totals, comparison, recommendations, detail rows; another learner\'s Seq is refused', async ({ page, checks }) => {
  const me = ACCOUNTS.e2epass01;
  await hidePopups(page);
  const login = await openAs(page, me.id, '/my/assessment');
  // no active enrollment and no grant → tab-assessment.php:85-88
  await expect(page.getByText('진행 중인 수강이 없거나 역량진단 대상 차수를 찾을 수 없습니다.')).toBeVisible();
  await page.goto(`/assessment/result?studySeq=${me.studySeq}`);
  // PHP by hand: pre 공통 (80+60)/2 = 70, 리더십 80, 직무 60 → 70.0; post 공통 (100+80)/2 = 90, 리더십 100, 직무 80 → 90.0
  const res = await (await page.request.get(`/v1/assessment/result?studySeq=${me.studySeq}`, { headers: { Authorization: `Bearer ${login.accessToken}` } })).json();
  expect(res.scores).toEqual({ common: { pre: 70, post: 90 }, leader: { pre: 80, post: 100 }, job: { pre: 60, post: 80 }, total: { pre: 70, post: 90 } });
  expect(res).toMatchObject({ improvement: 20, recommendations: ['KEEP_GROWING'], comparable: true, satisfaction: { submitted: true } });
  const totals = page.getByRole('region', { name: '사전진단 점수' });
  await expect(totals).toContainText('70');
  await expect(totals).toContainText('90');
  await expect(page.getByText('역량 향상도: 20점 상승')).toBeVisible();
  await expect(page.getByText('우수한 성장세를 유지하기 위해 지속적인 학습을 권장합니다.')).toBeVisible();
  await expect(page.getByRole('region', { name: '리더십 역량 진단 상세 보기' }).getByRole('row').filter({ hasText: '리더십1' })).toContainText('+20');
  await expect(page.getByRole('link', { name: '만족도조사 하러가기' })).toHaveCount(0); // 3단계 answered (post_test_result.html:399-403)
  await checks.checkpoint('result-pass01');
  await page.context().clearCookies();

  // another learner's enrollment → NOT_FOUND (assessment_report.html?loginId= IDOR is not ported)
  checks.allow(/\/v1\/assessment\/result\?studySeq=9403$/, 404);
  await openAs(page, 'e2elearn01', `/assessment/result?studySeq=${me.studySeq}`);
  await expect(page.locator('[data-state="NO_ACCESS"]')).toBeVisible();
});

test('추천 학습로드맵: HRDe 추천 defaults (no candidate, as PHP), AI 맞춤 rule-based stages without OpenAI, operator path of the package', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, 'e2elearn01', '/roadmap');
  // no inputs → defaults (경영/관리 · 리더십 · "5시간 이상" = ContentsTime 120–360, roadmap-recommend.php:304-354, 505-533): the fixture
  // courses are 3–60 or 960 minutes, so PHP finds no candidate either → the empty state
  await expect(page.getByText('조건에 맞는 추천을 찾지 못했습니다. 희망 강의시간이나 목표를 바꿔 보세요.')).toBeVisible();
  await checks.checkpoint('roadmap-recommended');
  // AI 맞춤 tab: "30분 이내" (0–30 min) → candidates; no OpenAI key → the rule-based staged fallback (기본 편성)
  await page.getByRole('tab', { name: 'AI 맞춤 로드맵' }).click();
  await page.getByRole('button', { name: '로드맵 만들기' }).click();
  await expect(page.getByText('모든 항목을 선택해주세요.')).toBeVisible();
  for (const [field, value] of [['직무 분야', '데이터 분석'], ['학습 목표', 'AI'], ['희망 강의시간', '30분 이내']] as const) {
    await page.getByRole('combobox', { name: field }).click();
    await page.getByRole('option', { name: value }).click();
  }
  const gen = page.waitForResponse((r) => r.url().endsWith('/v1/ai/roadmap'));
  await page.getByRole('button', { name: '로드맵 만들기' }).click();
  const body = await (await gen).json();
  expect(body.source).toBe('fallback');
  expect(body.steps.every((s: { minutes: number }) => s.minutes <= 30)).toBe(true);
  await expect(page.getByText('기본 편성').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'STEP 1 · 입문/기초' })).toBeVisible();
  await checks.checkpoint('roadmap-ai');
  await page.getByRole('tab', { name: '운영자 추천' }).click();
  await expect(page.getByRole('heading', { name: '운영자가 편성한 콘텐츠 묶음' })).toBeVisible();
  await expect(page.getByText('[E2E] 데이터 리터러시 실무').first()).toBeVisible();
  await checks.checkpoint('roadmap-operator');
});

test('만족도조사: blocked before 15 h, answered once per enrollment (접수시각), no effect on the 사후 score or PassOK', async ({ page, checks, db }) => {
  const me = ACCOUNTS.e2elearn15;
  await db.exec('DELETE FROM ArchiveAbilityResult2 WHERE ID = ? AND question_idx IN (9031, 9032, 9033)', [me.id]);
  await db.exec("UPDATE Study SET PassOK = 'N' WHERE Seq = ?", [me.studySeq]);
  await hidePopups(page);
  // 14 h 59 m: listed, not open
  await openAs(page, 'e2elearn01', '/my/surveys');
  const row1 = page.getByRole('row').filter({ hasText: 'HRDe아카이브 향상도 · 만족도 조사' });
  await expect(row1).toContainText('미참여');
  await expect(row1).toContainText('누적 학습 15시간 달성 후 참여할 수 있습니다.');
  await expect(row1.getByRole('link', { name: '참여하기' })).toHaveCount(0);
  await expect(page.getByText('과정별 만족도조사는 준비 중입니다')).toBeVisible(); // PollBank / SurveyAnswer are not in hrdeArchive
  await checks.checkpoint('surveys-blocked');
  await page.context().clearCookies();

  // 15 h: open → answer → 접수
  await openAs(page, me.id, '/my/surveys');
  const row = page.getByRole('row').filter({ hasText: 'HRDe아카이브 향상도 · 만족도 조사' });
  await row.getByRole('link', { name: '참여하기' }).click();
  await expect(page).toHaveURL(new RegExp(`/satisfaction/${me.studySeq}$`));
  for (const [t, n] of [['콘텐츠 만족도', 5], ['업무 도움', 3], ['추천 의향', 4]] as const) await choose(page.getByRole('radio', { name: `${t} · ${n}점` }));
  await checks.checkpoint('survey-form');
  const saved = page.waitForResponse((r) => r.url().endsWith('/v1/assessment/post/answers'));
  await page.getByRole('button', { name: '제출하기' }).click();
  expect((await saved).request().postDataJSON()).toMatchObject({ studySeq: me.studySeq, step: 'satisfaction', final: true });
  await expect(page.getByRole('status').filter({ hasText: '접수' }).first()).toBeVisible();
  expect(await db.query('SELECT question_idx, aValue FROM ArchiveAbilityResult2 WHERE ID = ? AND Study_Seq = ? AND question_idx IN (9031, 9032, 9033) ORDER BY question_idx', [me.id, me.studySeq]))
    .toEqual([{ question_idx: 9031, aValue: '5' }, { question_idx: 9032, aValue: '3' }, { question_idx: 9033, aValue: '4' }]);
  // the 사후 score reads step02/step03 only: still 0 → PassOK stays N although 54,000 s
  expect(await db.scalar('SELECT PassOK FROM Study WHERE Seq = ?', [me.studySeq])).toBe('N');
  await page.goto('/my/surveys');
  await expect(page.getByRole('row').filter({ hasText: 'HRDe아카이브 향상도 · 만족도 조사' })).toContainText('제출 완료');
  await expect(page.getByRole('row').filter({ hasText: 'HRDe아카이브 향상도 · 만족도 조사' })).toContainText(/접수 \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  await checks.checkpoint('surveys-submitted');
});

test('나의 수강후기: list, detail, edit with the PHP confirm text, delete = Del Y; owner only', async ({ page, checks, db }) => {
  const id = 'xassess02';
  await db.exec("UPDATE Review SET Title = '[E2E] 수정 전 후기', Contents = '수정 전 본문입니다.', StarPoint = 3, Del = 'N', UseYN = 'Y' WHERE idx = 23601");
  await hidePopups(page);
  await openAs(page, id, '/my/reviews');
  const row = page.getByRole('row').filter({ hasText: '[E2E] 수정 전 후기' });
  await expect(row).toContainText('[E2E] 데이터 리터러시 실무');
  await expect(row.getByRole('img', { name: '평점 3' })).toBeVisible();
  await checks.checkpoint('my-reviews');
  await row.getByRole('link', { name: '[E2E] 수정 전 후기' }).click();
  await expect(page).toHaveURL(/\/my\/reviews\/23601$/);
  await expect(page.getByText('수정 전 본문입니다.')).toBeVisible();
  await checks.checkpoint('my-review-detail');

  // modify (survey_modify.html → survey_script.php type=modify)
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('제목').fill('[E2E] 수정한 후기');
  await page.getByLabel('내용').fill('수정한 본문입니다.');
  await page.getByRole('combobox', { name: '평점' }).click();
  await page.getByRole('option', { name: '5점' }).click();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({ hasText: '현재 수강후기를 수정하시겠습니까?' });
  await expect(confirm).toBeVisible();
  await checks.checkpoint('my-review-confirm', { settle: false });
  const patched = page.waitForResponse((r) => r.url().endsWith('/v1/my/reviews/23601') && r.request().method() === 'PATCH');
  await confirm.getByRole('button', { name: '확인' }).click();
  expect((await patched).status()).toBe(200);
  await expect(page.getByText('처리되었습니다.')).toBeVisible();
  expect(await db.one('SELECT Title, Contents, StarPoint, UseYN, Del FROM Review WHERE idx = 23601')).toEqual({ Title: '[E2E] 수정한 후기', Contents: '수정한 본문입니다.', StarPoint: 5, UseYN: 'Y', Del: 'N' });

  // delete = Del 'Y' (survey_script.php type=del), back to the list
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const del = page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({ hasText: '현재 수강후기를 삭제하시겠습니까?' });
  await del.getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/my\/reviews$/);
  await expect(page.getByText('작성하신 수강후기가 없습니다.')).toBeVisible();
  expect(await db.scalar('SELECT Del FROM Review WHERE idx = 23601')).toBe('Y');

  // someone else's review (9603 of e2elearn01) is not this learner's (survey_view.html had no owner check)
  checks.allow(/\/v1\/my\/reviews\/9603$/, 404);
  await page.goto('/my/reviews/9603');
  await expect(page.getByText('해당 수강후기 내용이 없습니다.')).toBeVisible();
});
