/**
 * Packaged (Type A) lesson E2EH01 in the 학습창: auto Start on frame load, LastStudy = the current section page (player2.php:3427-3471,
 * normalizeArchiveLastStudy), reopening on that page (player2.php:446-447), the auto-next helper (player2.php:1187-1247), the
 * ArchivePlayerSeek message → 'Seek' save with TriggerYN N (player2.php:3695-3757, lecture_progress.php:320-339), and the parent
 * bridges PlayStudyInfo (study_info.php) / PlayStudyCounsel (study_counsel.php + study_counsel_ok.php → Counsel).
 */
import type { Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { db } from '../support/db';
import { COURSES } from '../support/accounts';
import { XP, resetLearner, nextTick, lastLog, progressOf, phpCredit, phpStudyTime, leavePlayer } from './kit';

test.use({ area: 'player' });

const H = COURSES.E2EH01.chapters[0];
const LEN = COURSES.E2EH01.minutesPerChapter * 60; // 1,200 s content length (position / StudyTime cap)
const frameOf = (page: Page) => page.frameLocator('iframe');
const framePath = (page: Page) => page.evaluate(() => { try { return (document.querySelector('iframe') as HTMLIFrameElement).contentWindow!.location.pathname; } catch { return ''; } });

test('packaged lesson: auto Start, auto-next to section 02, LastStudy = section page, reopen on it, ArchivePlayerSeek → Seek save', async ({ page, checks }) => {
  const me = XP.pkg;
  await resetLearner(me.id, me.seq);
  await page.clock.install();
  await hidePopups(page);
  // ---- the frame's load starts the lesson by itself (Start, mode S, the chapter page as LastStudy)
  const start = await nextTick(page, 'Start', () => openAs(page, me.id, `/learn/${me.seq}/${H.chapterSeq}?lectureCode=E2EH01`));
  expect(start.body).toMatchObject({ chapterNumber: '1', contentsIdx: H.contentsIdx, contentsDetailSeq: H.detailSeq, lastStudy: '/contents/E2E/H01/001/01/index.html', completeTime: LEN });
  expect(await progressOf(me.id, me.seq, H.chapterSeq)).toMatchObject({ StudyTime: 0, Progress: 0, TriggerYN: 'Y', LastStudy: '/contents/E2E/H01/001/01/index.html' });
  await expect(frameOf(page).locator('h1')).toContainText('1. 들어가며');
  await checks.checkpoint('package-01', { settle: false });

  // ---- auto-next: the package's completeStudy() (end of the section video) moves to the next page after 500 ms
  await frameOf(page).locator('body').evaluate(() => (window as unknown as { completeStudy: () => boolean }).completeStudy());
  await page.clock.runFor(1_000);
  await expect(frameOf(page).locator('h1')).toContainText('2. 핵심 정리');
  expect(await framePath(page)).toBe('/contents/E2E/H01/001/02/index.html');

  // ---- Middle after an hour of wall time: LastStudy = the section page without /contents (normalizeArchiveLastStudy); credit from the
  //      synthetic position (no readable playhead yet → ProgressTime = resume base + elapsed seconds, lecture_progress.php:58-65)
  await db.exec('UPDATE ProgressLog SET RegDate = DATE_SUB(RegDate, INTERVAL 3600 SECOND) WHERE ID = ? ORDER BY idx DESC LIMIT 1', [me.id]);
  const prev = await lastLog(me.id);
  const mid = await nextTick(page, 'Middle', () => page.clock.runFor(60_000));
  const sentPos = mid.body.positionSec || mid.body.progressTime;
  expect(mid.body.lastStudy).toBe('/E2E/H01/001/02/index.html');
  const now = await lastLog(me.id);
  const credit = phpCredit(prev.PositionSec, prev.reg_ts, now.reg_ts, Math.min(sentPos, LEN));
  expect(credit).toBeGreaterThan(0);
  expect(mid.ack).toMatchObject({ ChkError: 'N', StudyTime: phpStudyTime(0, credit, LEN), PositionSec: Math.min(sentPos, LEN) });
  expect(await progressOf(me.id, me.seq, H.chapterSeq)).toMatchObject({ LastStudy: '/E2E/H01/001/02/index.html', StudyTime: credit, TriggerYN: 'N' });

  // ---- leave and reopen: the frame opens on the saved section page (Progress.LastStudy), the Start posts it as LastStudy
  await leavePlayer(page, me.id);
  const beforeRestart = await lastLog(me.id); // the End beacon of the left window
  const restart = await nextTick(page, 'Start', () => page.goto(`/learn/${me.seq}/${H.chapterSeq}?lectureCode=E2EH01`));
  const restartLog = await lastLog(me.id);
  // the reopened window continues the synthetic position from the stored one (resume base + elapsed), so the Start measures ≈ 0
  const restartPos = Math.min(restart.body.positionSec || restart.body.progressTime, LEN);
  expect(restartLog.StudyTime).toBe(phpStudyTime(beforeRestart.StudyTime, phpCredit(beforeRestart.PositionSec, beforeRestart.reg_ts, restartLog.reg_ts, restartPos), LEN));
  await expect(frameOf(page).locator('h1')).toContainText('2. 핵심 정리');
  expect(await framePath(page)).toBe('/contents/E2E/H01/001/02/index.html');
  expect(restart.body.lastStudy).toBe('/E2E/H01/001/02/index.html');
  await checks.checkpoint('package-02-reopened', { settle: false });

  // ---- ArchivePlayerSeek {from, to} from the package → one 'Seek' save at `to` after the 250 ms debounce; TriggerYN N
  await db.exec('UPDATE ProgressLog SET RegDate = DATE_SUB(RegDate, INTERVAL 3600 SECOND) WHERE ID = ? ORDER BY idx DESC LIMIT 1', [me.id]);
  const beforeSeek = await lastLog(me.id);
  const to = beforeSeek.PositionSec + 40;
  const seek = await nextTick(page, 'Seek', async () => {
    await frameOf(page).locator('body').evaluate((_b, t) => { parent.postMessage({ type: 'ArchivePlayerSeek', from: 1, to: t - 20 }, '*'); parent.postMessage({ type: 'ArchivePlayerSeek', from: 1, to: t }, '*'); }, to);
    await page.clock.runFor(300);
  });
  expect(seek.body.positionSec).toBe(to); // debounced: only the last message is saved
  const afterSeek = await lastLog(me.id);
  const seekCredit = phpCredit(beforeSeek.PositionSec, beforeSeek.reg_ts, afterSeek.reg_ts, to);
  expect(seekCredit).toBe(40);
  expect(afterSeek).toMatchObject({ PositionSec: to, TriggerYN: 'N', StudyTime: phpStudyTime(beforeSeek.StudyTime, seekCredit, LEN) });
  expect(await progressOf(me.id, me.seq, H.chapterSeq)).toMatchObject({ TriggerYN: 'N', StudyTime: beforeSeek.StudyTime + 40 });
  await leavePlayer(page, me.id);
});

test('packaged lesson bridges: 학습요점 layer and 학습내용 질문하기 → Counsel row (LectureCode + Contents_idx, A–E), validation, rate limit', async ({ page, checks, db: d }) => {
  const me = XP.pkg;
  await resetLearner(me.id, me.seq);
  // the counsel limit (10 calls / 10 min per client IP) outlives a run: a fresh forwarded address per run keeps the spec re-runnable
  await page.context().setExtraHTTPHeaders({ 'X-Forwarded-For': `10.78.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await hidePopups(page);
  const login = await openAs(page, me.id, `/learn/${me.seq}/${H.chapterSeq}?lectureCode=E2EH01`);
  await expect(frameOf(page).locator('h1')).toContainText('1. 들어가며');

  // ---- parent.PlayStudyInfo('E2EH01', 9131) → study_info.php: 내용전문가 = Course.Professor, 차시 목표/훈련 내용/학습 활동 = Expl01-03
  await frameOf(page).getByRole('button', { name: '학습요점' }).click();
  const info = page.getByRole('dialog', { name: /학습요점/ });
  await expect(info).toBeVisible();
  const c = await d.one<{ ContentsTitle: string; Expl01: string; Expl02: string; Expl03: string }>('SELECT ContentsTitle, Expl01, Expl02, Expl03 FROM Contents WHERE idx = ?', [H.contentsIdx]);
  await expect(info).toContainText(`학습요점 · ${c!.ContentsTitle}`);
  await expect(info).toContainText('내용전문가');
  await expect(info).toContainText('최패키지');
  for (const v of [c!.Expl01, c!.Expl02, c!.Expl03]) await expect(info).toContainText(v);
  await checks.checkpoint('package-study-info', { settle: false });
  await info.getByRole('button', { name: '닫기' }).last().click();

  // ---- parent.PlayStudyCounsel('E2EH01', 9131) → study_counsel.php form; function.js:1933-1957 checks in this order
  await frameOf(page).getByRole('button', { name: '질문하기' }).click();
  const form = page.getByRole('dialog', { name: '학습내용 질문하기' });
  await expect(form).toContainText('질문내용은 강사님 확인 후 학습지원센터 > 1:1 문의에서 확인하실 수 있습니다.');
  const submit = form.getByRole('button', { name: '질문하기' });
  await submit.click();
  await expect(form).toContainText('문의종류를 선택하세요.');
  await form.getByRole('combobox', { name: '문의종류' }).click();
  for (const label of ['학습 내용 문의', '시스템 문의', '이의 제기', '수강 관련 문의', '결제 관련 문의']) await expect(page.getByRole('option', { name: label })).toBeVisible();
  await page.getByRole('option', { name: '이의 제기' }).click();
  await submit.click();
  await expect(form).toContainText('제목을 입력하세요.');
  await form.getByLabel('제목').fill('[E2E] 2차시 요약 질문');
  await submit.click();
  await expect(form).toContainText('내용을 입력하세요.');
  await form.getByLabel('내용').fill('핵심 정리 부분을 다시 설명해 주세요.');
  await checks.checkpoint('package-counsel-form', { settle: false });
  page.once('dialog', (dlg) => { expect(dlg.message()).toBe('등록하시겠습니까?'); void dlg.accept(); });
  const posted = page.waitForResponse((r) => r.url().endsWith('/v1/player/counsel'));
  await submit.click();
  expect((await posted).status()).toBe(200);
  await expect(form).toContainText('등록되었습니다.');
  const row = await d.one<Record<string, unknown>>(`SELECT ID, Name, Mobile = (SELECT Mobile FROM Member WHERE ID = ?) AS sameMobile, Email = (SELECT Email FROM Member WHERE ID = ?) AS sameEmail,
      LectureCode, Contents_idx, Category, Title, Contents, Status, Del, ViewCount, Study_Seq FROM Counsel WHERE ID = ? ORDER BY idx DESC LIMIT 1`, [me.id, me.id, me.id]);
  expect(row).toEqual({ ID: me.id, Name: '정패키지', sameMobile: 1, sameEmail: 1, LectureCode: 'E2EH01', Contents_idx: H.contentsIdx, Category: 'C', Title: '[E2E] 2차시 요약 질문', Contents: '핵심 정리 부분을 다시 설명해 주세요.', Status: 'A', Del: 'N', ViewCount: 0, Study_Seq: null });
  // the learner finds it in 1:1 문의 decrypted like any Counsel row
  expect(await d.scalar(`SELECT ${d.aesDec('Mobile')} FROM Counsel WHERE ID = ? ORDER BY idx DESC LIMIT 1`, [me.id])).toBe('010-7722-2002');

  // ---- API: study_counsel_ok.php:26-37 `!$Category or !$Title` → 입력하지 않은 정보가 존재합니다.; then the 10 / 10 min limit per client
  const post = (body: Record<string, unknown>) => page.request.post('/v1/player/counsel', { data: { lectureCode: 'E2EH01', contentsIdx: H.contentsIdx, contents: '본문', ...body }, headers: { Authorization: `Bearer ${login.accessToken}` } });
  const noCat = await post({ category: '', title: '제목' });
  expect(noCat.status()).toBe(400);
  expect((await noCat.json()).error.message).toBe('입력하지 않은 정보가 존재합니다.');
  // the form post + the refused one already used 2 of the 10 calls per 10 minutes (per client IP; every call counts)
  const statuses: number[] = [];
  for (let i = 0; i < 9; i++) statuses.push((await post({ category: 'A', title: `[E2E] 반복 ${i}` })).status());
  expect(statuses).toEqual([200, 200, 200, 200, 200, 200, 200, 200, 429]);
  checks.allow(/\/v1\/player\/counsel$/, 429);
  expect(Number(await d.scalar('SELECT COUNT(*) FROM Counsel WHERE ID = ?', [me.id]))).toBe(9);
  await leavePlayer(page, me.id);
});
