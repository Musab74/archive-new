/**
 * 사전역량진단 (archive/prev/prev_test01-03.html + archive_ability_input.php): login routing, the three steps with the PHP messages,
 * 임시저장 in the browser (restored after a reload), the ArchiveAbilityResult1/2 rows each step writes, Member.AbilityYN/AbilityDate on
 * completion, and the player opening afterwards (the 사전 gate of player2.php:132-152 passes).
 */
import { test, expect, hidePopups } from '../support/test';
import { choose } from './kit';
import { loginViaUi } from '../support/login';
import { db } from '../support/db';
import { COURSES } from '../support/accounts';

test.use({ area: 'assessment' });

const ME = { id: 'xassess01', seq: 23101 };

async function resetPre(): Promise<void> {
  await db.exec('DELETE FROM ArchiveAbilityResult1 WHERE ID = ?', [ME.id]);
  await db.exec('DELETE FROM ArchiveAbilityResult2 WHERE ID = ?', [ME.id]);
  await db.exec("UPDATE Member SET AbilityYN = 'N', AbilityDate = NULL WHERE ID = ?", [ME.id]);
  await db.exec('DELETE FROM PlayLock WHERE ID = ?', [ME.id]);
  await db.exec('DELETE FROM ProgressLog WHERE ID = ?', [ME.id]);
  await db.exec('DELETE FROM Progress WHERE ID = ?', [ME.id]);
  await db.exec('DELETE FROM TB_SCORE_HIST_V2 WHERE USER_AGENT_PK = ?', [ME.id]);
}
const r2 = () => db.query<{ question_idx: number; aValue: string; Study_Seq: number; col1: string | null }>('SELECT question_idx, aValue, Study_Seq, col1 FROM ArchiveAbilityResult2 WHERE ID = ? ORDER BY question_idx', [ME.id]);
const r1 = () => db.query<{ abilityType: string; abilityDepth: string | null; col1: string; col2: string | null; col3: string | null; col4: string | null; Study_Seq: number; modDate: string | null }>('SELECT abilityType, abilityDepth, col1, col2, col3, col4, Study_Seq, modDate FROM ArchiveAbilityResult1 WHERE ID = ?', [ME.id]);

test('사전역량진단: login routes to the form, step messages, 임시저장 + restore, R1/R2 rows per step, Member.AbilityYN, then the player opens', async ({ page, checks }) => {
  await resetPre();
  await hidePopups(page);
  await loginViaUi(page, ME.id, { expectPath: /\/assessment\/pre$/ }); // login_ok.php:63-80 → unfinished 사전 → 사전 page
  await expect(page.getByRole('heading', { name: /지금의 역량을 확인하고/ })).toBeVisible();
  await checks.checkpoint('pre-intro');
  await page.getByRole('button', { name: '사전역량진단 시작하기' }).click();

  // ---- 1단계: 직급 first, then the first unanswered question by its PHP label "Q{aOrder}. {aValue}"
  await expect(page.getByRole('heading', { name: '01 · 공통역량 / 리더십역량' })).toBeVisible();
  await expect(page.getByText('직급을 선택한 뒤 모든 문항에 응답해주세요.')).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByText('Q0. 귀하의 현재 직급을 선택해주세요.')).toBeVisible();
  await choose(page.getByRole('radio', { name: '팀원 [실무자]' }));
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByText('Q1. 의사소통 문항을 선택해주세요.')).toBeVisible();
  await choose(page.getByRole('radio', { name: '의사소통 · 그런 편이다' })); // q1 = 4
  await choose(page.getByRole('radio', { name: '자기계발 · 보통이다' })); // q2 = 3
  await expect(page.getByText('응답 진행률: 2/3개 완료')).toBeVisible();
  await page.getByRole('button', { name: '임시저장' }).click();
  await expect(page.getByText('응답을 이 브라우저에 임시저장했습니다.', { exact: false })).toBeVisible();
  expect(await r2()).toEqual([]); // 임시저장 stays in the browser (AR-07); nothing is written yet
  await checks.checkpoint('pre-step01-draft');

  // ---- reload: the draft comes back (role + answers pre-checked)
  await page.reload();
  await page.getByRole('button', { name: '사전역량진단 시작하기' }).click();
  await expect(page.getByText('임시저장한 응답을 불러왔습니다.')).toBeVisible();
  await expect(page.getByRole('radio', { name: '팀원 [실무자]' })).toBeChecked();
  await expect(page.getByRole('radio', { name: '의사소통 · 그런 편이다' })).toBeChecked();
  await choose(page.getByRole('radio', { name: '리더십1 · 그렇다' })); // q3 = 5
  await expect(page.getByText('모든 항목이 선택되었습니다. 다음을 눌러주세요.')).toBeVisible();
  const s1 = page.waitForResponse((r) => r.url().endsWith('/v1/assessment/pre/step01'));
  await page.getByRole('button', { name: '다음', exact: true }).click();
  expect((await s1).status()).toBe(200);
  // archive_ability_input.php:122-157 — R1 (ID, Study_Seq, abilityType B, col1) + one R2 row per answer (no col1)
  expect(await r1()).toEqual([expect.objectContaining({ abilityType: 'B', col1: 'W', Study_Seq: ME.seq, col2: null, col3: null, col4: null })]);
  expect(await r2()).toEqual([
    { question_idx: 1, aValue: '4', Study_Seq: ME.seq, col1: null }, { question_idx: 2, aValue: '3', Study_Seq: ME.seq, col1: null }, { question_idx: 3, aValue: '5', Study_Seq: ME.seq, col1: null },
  ]);
  expect(await db.scalar('SELECT AbilityYN FROM Member WHERE ID = ?', [ME.id])).toBe('N');

  // ---- 2단계: 실무자 직무 questions (B·step03·W)
  await expect(page.getByRole('heading', { name: '02 · 직급별 역량' })).toBeVisible();
  await expect(page.getByText('실무자로써의 역량을 솔직하게 판단해 보세요.')).toBeVisible();
  await choose(page.getByRole('radio', { name: '직무1 · 그렇지 않은 편이다' })); // q4 = 2
  await checks.checkpoint('pre-step02');
  const s2 = page.waitForResponse((r) => r.url().endsWith('/v1/assessment/pre/step02'));
  await page.getByRole('button', { name: '다음', exact: true }).click();
  expect((await s2).status()).toBe(200);
  expect((await r2()).find((r) => r.question_idx === 4)).toMatchObject({ aValue: '2', Study_Seq: ME.seq });
  // 사전 complete (공통·리더십 + 직급 문항) → Member.AbilityYN='Y', AbilityDate=NOW() (archive_ability_input.php:79-85)
  const m = await db.one<{ AbilityYN: string; fresh: number }>('SELECT AbilityYN, AbilityDate >= NOW() - INTERVAL 1 MINUTE AS fresh FROM Member WHERE ID = ?', [ME.id]);
  expect(m).toEqual({ AbilityYN: 'Y', fresh: 1 });

  // ---- 3단계: 직무 (single), 관심분야 / 필요역량 (up to 3, click order)
  await expect(page.getByRole('heading', { name: '03 · 직무 · 관심분야 · 필요역량' })).toBeVisible();
  await expect(page.getByText('아직 선택이 필요합니다: 직무, 관심분야, 필요 역량')).toBeVisible();
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(page.getByText('Q1. 현재 직무를 선택해주세요.')).toBeVisible();
  await choose(page.getByRole('radio', { name: 'IT·개발' }));
  await choose(page.getByRole('checkbox', { name: '커뮤니케이션' }));
  await choose(page.getByRole('checkbox', { name: 'AI·데이터' }));
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await expect(page.getByText('Q3. 필요로 하는 역량개발을 최소 1개 선택해주세요.')).toBeVisible();
  await choose(page.getByRole('checkbox', { name: '협업' }));
  await choose(page.getByRole('checkbox', { name: '문제해결' }));
  await expect(page.getByText('모든 항목이 선택되었습니다. 완료를 눌러주세요.')).toBeVisible();
  await checks.checkpoint('pre-step03');
  const s3 = page.waitForResponse((r) => r.url().endsWith('/v1/assessment/pre/step03'));
  await page.getByRole('button', { name: '완료', exact: true }).click();
  expect((await s3).status()).toBe(200);
  // archive_ability_input.php:47-93 — abilityDepth step03, col2 = 직무 idx, col3/col4 = comma idx lists in click order
  expect(await r1()).toEqual([expect.objectContaining({ abilityType: 'B', abilityDepth: 'step03', col1: 'W', col2: '9001', col3: '9006,9004', col4: '9008,9007' })]);
  expect((await r1())[0].modDate).not.toBeNull();
  await expect(page.getByText('사전역량진단이 완료되었습니다.')).toBeVisible();
  await checks.checkpoint('pre-done');

  // ---- the player's 사전 gate now passes for this enrollment
  const ch = COURSES.E2EY01.chapters[0];
  await page.goto(`/learn/${ME.seq}/${ch.chapterSeq}?lectureCode=E2EY01`);
  await expect(page.getByRole('button', { name: '학습 시작하기' })).toBeVisible();
  await page.goto('/my');
  await expect.poll(() => db.scalar<number>('SELECT COUNT(*) FROM PlayLock WHERE ID = ?', [ME.id])).toBe(0);
});
