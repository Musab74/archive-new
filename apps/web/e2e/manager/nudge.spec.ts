/**
 * 확인·독려 (AR-21, manager.md §3 / §4.5): only current-period 학습 안내 대상 of the manager's companies are listed; the row checkbox
 * stays ticked (row click and checkbox must not cancel each other); the server re-checks every target on send and answers
 * SEND_NOT_CONFIGURED without writing any send/log row (no SMS / 알림톡 / mail provider).
 */
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { COMPANY } from '../support/accounts';
import { authed } from '../myroom/helpers';
import type { Page } from '@playwright/test';

test.use({ area: 'manager', contextOptions: { reducedMotion: 'reduce' } });

const MGR = 'e2emgr01';
// every send/log table of the local schema (KakaoBulkSendLog is not in old-schema.md's local copy)
const LOG_TABLES = ['SendMessage', 'SmsSendLog', 'SmsRes', 'EmailSendLog', 'EmailSendLogForEduManager', 'InformationProtectionLog'];
type Db = { scalar: <T>(s: string, p?: unknown[]) => Promise<T | null> };
async function logCounts(db: Db) {
  const out: Record<string, number> = {};
  for (const t of LOG_TABLES) out[t] = Number(await db.scalar(`SELECT COUNT(*) FROM ${t}`));
  return out;
}
const rowOf = (page: Page, id: string) => page.locator('main table tbody tr').filter({ has: page.getByText(id, { exact: true }) });

test('targets: current-period, not passed, under 15h (A) / no record (W) — own companies only', async ({ page, checks, db }) => {
  await hidePopups(page);
  await openAs(page, MGR, '/manager/nudge');
  const want = await db.query<{ ID: string }>(
    `SELECT s.ID FROM Study s WHERE s.CompanyCode IN (?, ?) AND IFNULL(s.StudyEnd, 'N') = 'N' AND s.PassOK <> 'Y' AND s.LectureStart <= CURDATE() AND s.LectureEnd >= CURDATE()
       AND s.ServiceType IN ('A','W','Z')
       AND ((s.ServiceType = 'A' AND (SELECT COALESCE(SUM(StudyTime), 0) FROM Progress p WHERE p.Study_Seq = s.Seq) < 54000)
         OR (s.ServiceType <> 'A' AND (SELECT COALESCE(SUM(StudyTime), 0) FROM Progress p WHERE p.Study_Seq = s.Seq) = 0))`, [COMPANY.A.code, COMPANY.B.code]);
  const rows = page.locator('main table tbody tr');
  await expect(rows).toHaveCount(want.length);
  for (const r of want) await expect(rowOf(page, r.ID)).toHaveCount(1);
  for (const id of ['e2elearn15', 'e2epass02', 'e2eexp01', 'e2esoon01', 'e2ewfree01', 'e2ecco01', 'xmyroom01']) await expect(rowOf(page, id)).toHaveCount(0);
  await expect(rowOf(page, 'e2elearn01')).toContainText('인정시간 미달');
  await expect(rowOf(page, 'e2enocert01')).toContainText('미학습');
  await checks.checkpoint('nudge');
});

test('row checkbox stays ticked; row click toggles; select all; preview renders the tokens', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, MGR, '/manager/nudge');
  const r1 = rowOf(page, 'e2elearn01');
  const cb1 = r1.getByRole('checkbox');
  await cb1.click();
  await expect(cb1).toBeChecked();
  await page.waitForTimeout(300); // nothing may untick it afterwards (row handler / re-render)
  await expect(cb1).toBeChecked();
  await expect(page.getByText('1명 선택')).toBeVisible();
  // clicking the label text of the checkbox (the visible box) behaves the same
  const r2 = rowOf(page, 'xmanager01');
  await r2.locator('label').click();
  await expect(r2.getByRole('checkbox')).toBeChecked();
  await expect(page.getByText('2명 선택')).toBeVisible();
  // a click elsewhere on the row toggles too
  await r2.locator('b', { hasText: '구분초' }).click();
  await expect(r2.getByRole('checkbox')).not.toBeChecked();
  await expect(cb1).toBeChecked();
  // keyboard: space on the checkbox toggles exactly once
  await r2.getByRole('checkbox').focus();
  await page.keyboard.press('Space');
  await expect(r2.getByRole('checkbox')).toBeChecked();
  await expect(page.getByText('2명 선택')).toBeVisible();
  const preview = page.locator('div[aria-live="polite"]:not([role])');
  await expect(preview).toContainText('[AINEX 아카이브] 김학습님, 현재 학습시간은 14시간 59분입니다.');
  await expect(preview).toContainText('구분초님, 현재 학습시간은 03시간 03분입니다.');
  await checks.checkpoint('nudge-selected');
  // select all / none
  const all = page.getByRole('checkbox', { name: '전체 선택' });
  await all.click();
  const n = await page.locator('main table tbody tr').count();
  await expect(page.getByText(`${n}명 선택`)).toBeVisible();
  await all.click();
  await expect(page.getByText('0명 선택')).toBeVisible();
  // the selection is cleared when the company changes
  await cb1.click();
  await expect(page.getByText('1명 선택')).toBeVisible();
  await page.locator('#mgr-company').click();
  await page.getByRole('option', { name: COMPANY.A.name }).click();
  await expect(page.getByText('0명 선택')).toBeVisible();
});

test('send: server re-check, SEND_NOT_CONFIGURED, nothing written to any send/log table', async ({ page, checks, db }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, MGR, '/manager/nudge');
  const before = await logCounts(db);
  await rowOf(page, 'e2elearn01').getByRole('checkbox').click();
  await rowOf(page, 'e2ebco01').getByRole('checkbox').click();
  const req = page.waitForRequest((r) => r.url().endsWith('/v1/manager/nudge/send'));
  const res = page.waitForResponse((r) => r.url().endsWith('/v1/manager/nudge/send'));
  await page.getByRole('button', { name: '발송 요청' }).click();
  const body = (await req).postDataJSON();
  expect([...body.studySeqs].sort()).toEqual([9401, 9413]);
  const out = await (await res).json();
  expect(out).toMatchObject({ ok: false, code: 'SEND_NOT_CONFIGURED', requested: 2, eligible: 2, sent: 0 });
  await expect(page.getByText('요청 2명 · 대상 확인 2명 · 발송 0명', { exact: false })).toBeVisible();
  await expect(page.getByText('미발송(발송 설정 없음)').first()).toBeVisible();
  await expect(page.getByText('문자·알림톡 발송 설정이 없어 발송하지 않았습니다. 대상과 문구를 확인한 뒤 기존 LMS에서 발송해 주세요.')).toBeVisible();
  await checks.checkpoint('nudge-sent');
  // the server re-checks: a foreign (C) enrollment, a passed one and a 15h one are refused per row
  const direct = await (await authed(page, accessToken).post('/v1/manager/nudge/send', { studySeqs: [9401, 9415, 9404, 9402, 24402], message: '{이름}님 {학습시간}' })).json();
  const by = new Map(direct.items.map((i: { studySeq: number }) => [i.studySeq, i]));
  expect(by.get(9401)).toMatchObject({ status: 'NOT_SENT', message: '김학습님 14시간 59분' });
  expect(by.get(9415)).toMatchObject({ status: 'INELIGIBLE', reason: '관리 범위 밖이거나 존재하지 않는 수강입니다.', id: null, name: null });
  expect(by.get(24402)).toMatchObject({ status: 'INELIGIBLE', id: null });
  expect(by.get(9404)).toMatchObject({ status: 'INELIGIBLE', reason: '이미 수료했습니다.' });
  expect(by.get(9402)).toMatchObject({ status: 'INELIGIBLE', reason: '15시간을 달성했습니다.' });
  expect(direct).toMatchObject({ requested: 5, eligible: 1, sent: 0 });
  expect(await logCounts(db)).toEqual(before);
});
