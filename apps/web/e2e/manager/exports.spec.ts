/**
 * 교육담당자 downloads — manager.md §2.3 (manager_trainee_excel.php), §2.6 (certificate_pdf02.php), §2.9 (manager_test_result.php):
 * the .xlsx read back with the API's own xlsx reader (PHP column order, headers, widths, header fill, file name, Sheet1), the 수료증
 * PDF per 수료 관리 card (only the card's company, refund cards wait until end + 7), and the 역량진단 보고서 printed to PDF.
 */
import fs from 'node:fs';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';
import { COMPANY } from '../support/accounts';
import { apiXlsxReader, authed, dispositionType, fileNameOf, kstDate, pdfText, popupUrl, unzip } from '../myroom/helpers';

test.use({ area: 'manager', contextOptions: { reducedMotion: 'reduce' } });

const MGR = 'e2emgr01';
const AB = [COMPANY.A.code, COMPANY.B.code];
const FOREIGN = ['e2ecco01', 'e2ecco02', 'xmyroom01', 'test01', 'user01'];
const kr = (s: number) => (s > 0 ? `${String(Math.floor(s / 3600)).padStart(2, '0')}시간 ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}분` : '-');

test('엑셀 내려받기: 수강생리스트_YYYYMMDD.xlsx, PHP columns/widths/header fill, rows = the screen list, no C learner', async ({ page, checks, db }) => {
  await hidePopups(page);
  await openAs(page, MGR, '/manager/trainees');
  await expect(page.getByText(/전체 \d+건 수강/)).toBeVisible();
  await checks.checkpoint('trainees-before-excel');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '엑셀 내려받기' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe(`수강생리스트_${kstDate().replace(/-/g, '')}.xlsx`);
  const buf = fs.readFileSync((await file.path())!);
  expect(buf.readUInt32LE(0)).toBe(0x04034b50); // PK zip
  await expect(page.getByText('엑셀 파일을 내려받았습니다.')).toBeVisible();

  const readXlsx = await apiXlsxReader();
  const sheet = readXlsx(buf);
  expect(sheet.rows.get(1)).toEqual({ A: '번호', B: '이름', C: '아이디', D: '과정명', E: '총학습시간', F: '수료여부' });
  // the same enrollments, in the screen order (유형 → 진행 중 먼저 → 기간 → 과정명 → 이름 → 아이디)
  const screenIds = await page.locator('main table tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim() ?? '')));
  const rows = [...sheet.rows.entries()].filter(([r]) => r > 1).map(([, c]) => c);
  expect(rows).toHaveLength(screenIds.length);
  const stored = new Map((await db.query<{ ID: string; Seq: number; t: number; PassOK: string }>(
    "SELECT s.ID, s.Seq, s.PassOK, (SELECT COALESCE(SUM(p.StudyTime), 0) FROM Progress p WHERE p.Study_Seq = s.Seq) t FROM Study s WHERE s.CompanyCode IN (?, ?)", AB)).map((r) => [r.ID, r]));
  rows.forEach((c, i) => {
    expect(c.A).toBe(String(i + 1));
    expect(screenIds[i].join('|')).toContain(c.C!);
    const s = stored.get(c.C!)!;
    expect(s, c.C).toBeTruthy();
    expect(c.E).toBe(kr(Number(s.t))); // one enrollment per learner in A+B
    expect(c.F).toBe(s.PassOK === 'Y' ? '수료' : '미수료');
    expect(c.D).toBe('HRD 아카이브 2026');
  });
  for (const id of FOREIGN) expect(rows.some((c) => c.C === id)).toBe(false);
  expect(rows.find((c) => c.C === 'xmanager01')?.E).toBe('03시간 03분'); // 11,037 s floored
  // PHPExcel layout: widths 8/20/15/15/50/15, header fill E8E8E8, 번호 numeric, sheet "Sheet1"
  const zip = unzip(buf);
  const xml = zip.get('xl/worksheets/sheet1.xml')!.toString('utf8');
  const widths = [...xml.matchAll(/<col min="(\d+)" max="\d+" width="([\d.]+)"/g)].map((m) => Number(m[2]));
  expect(widths).toEqual([8, 20, 15, 15, 50, 15]);
  expect(xml).toMatch(/<c r="A2" s="\d+"><v>1<\/v><\/c>/);
  const headerStyle = Number(/<c r="A1" s="(\d+)"/.exec(xml)![1]);
  const styles = zip.get('xl/styles.xml')!.toString('utf8');
  const xfs = [...(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)![1]).matchAll(/<xf\b[^>]*>/g)].map((m) => m[0]);
  const fillId = Number(/fillId="(\d+)"/.exec(xfs[headerStyle])![1]);
  const fills = [...(/<fills[^>]*>([\s\S]*?)<\/fills>/.exec(styles)![1]).matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m) => m[1]);
  expect(fills[fillId]).toContain('FFE8E8E8');
  expect(zip.get('xl/workbook.xml')!.toString('utf8')).toContain('<sheet name="Sheet1"');
});

test('검색항목 엑셀출력 (수강현황): only the cohort of the detail page', async ({ page, checks }) => {
  await hidePopups(page);
  await openAs(page, MGR, '/manager/trainees/xmanager01?studySeq=25401');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '검색항목 엑셀출력' }).click();
  const buf = fs.readFileSync((await (await dl).path())!);
  const sheet = (await apiXlsxReader())(buf);
  const ids = [...sheet.rows.entries()].filter(([r]) => r > 1).map(([, c]) => c.C).sort();
  // manager_trainee_excel.php with LectureCode + 수강기간 of the card, narrowed to the card's company (B): e2ebco01 + xmanager01
  expect(ids).toEqual(['e2ebco01', 'xmanager01']);
  await checks.checkpoint('roster-excel');
});

test('수료 관리 → 수료증 출력: PDF per card (company A only / company B only), refund card waits until end + 7', async ({ page, checks, db }) => {
  await hidePopups(page);
  const { accessToken } = await openAs(page, MGR, '/manager/completion');
  const ended = await db.one<{ s: string; e: string }>("SELECT DATE_FORMAT(LectureStart, '%Y-%m-%d') s, DATE_FORMAT(LectureEnd, '%Y-%m-%d') e FROM LectureTerme WHERE idx = 9302");
  const card = page.locator('article').filter({ hasText: `${COMPANY.A.name}의` }).filter({ hasText: `${ended!.s} ~ ${ended!.e}` });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('1명'); // e2epass01 (전체 = 수료 = 1)
  await expect(card).toContainText('집계 확정');
  await checks.checkpoint('completion');
  const pdfRes = page.waitForResponse((r) => r.url().includes('/v1/manager/certificates/pdf'));
  const url = await popupUrl(page, () => card.getByRole('button', { name: '수료증 출력' }).click());
  expect(url).toMatch(/^blob:/);
  const res = await pdfRes;
  expect(res.status()).toBe(200);
  expect(res.url()).toContain(`companyCode=${COMPANY.A.code}`);
  const api = authed(page, accessToken);
  const q = (code: string) => `/v1/manager/certificates/pdf?companyCode=${code}&lectureCode=ARC2026&lectureStart=${ended!.s}&lectureEnd=${ended!.e}&serviceType=A&serviceTypeYN=A`;
  const a = await api.get(q(COMPANY.A.code));
  expect(a.headers()['content-type']).toBe('application/pdf');
  expect(dispositionType(a)).toBe('inline');
  expect(fileNameOf(a)).toBe('certificate.pdf');
  const aBytes = await a.body();
  expect(aBytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const aText = pdfText(aBytes);
  expect(aText).toContain('이수료');
  expect(aText).toContain('(15H)'); // FLOOR(54,000 / 3600) of the stored seconds
  expect(aText).not.toContain('배수료');
  const bText = pdfText(await (await api.get(q(COMPANY.B.code))).body());
  expect(bText).toContain('배수료');
  expect(bText).not.toContain('이수료');
  // e2epass02's cohort (9306) ends in 3 days → refund certificates wait until end + 7
  const wait = await db.one<{ s: string; e: string; w: string }>("SELECT DATE_FORMAT(LectureStart, '%Y-%m-%d') s, DATE_FORMAT(LectureEnd, '%Y-%m-%d') e, DATE_FORMAT(DATE_ADD(LectureEnd, INTERVAL 7 DAY), '%Y-%m-%d') w FROM LectureTerme WHERE idx = 9306");
  const w = await api.get(`/v1/manager/certificates/pdf?companyCode=${COMPANY.A.code}&lectureCode=ARC2026&lectureStart=${wait!.s}&lectureEnd=${wait!.e}&serviceType=A&serviceTypeYN=A`);
  expect(w.status()).toBe(404);
  expect((await w.json()).error.message).toBe(`환급과정 수료증은 ${wait!.w}부터 출력할 수 있습니다.`);
});

test('역량진단 보고서: own companies only, document title = PDF name, printed to PDF', async ({ page, checks, db, browserName }, testInfo) => {
  await hidePopups(page);
  const cur = await db.one<{ s: string; e: string }>("SELECT DATE_FORMAT(LectureStart, '%Y-%m-%d') s, DATE_FORMAT(LectureEnd, '%Y-%m-%d') e FROM LectureTerme WHERE idx = 9301");
  await openAs(page, MGR, `/manager/reports/assessment-results?companyCode=${COMPANY.A.code}&lectureCode=ARC2026&lectureStart=${cur!.s}&lectureEnd=${cur!.e}`);
  const trainees = Number(await db.scalar("SELECT COUNT(DISTINCT ID) FROM Study WHERE CompanyCode = ? AND LectureCode = 'ARC2026' AND ServiceType = 'A' AND IFNULL(StudyEnd, 'N') = 'N' AND LectureStart = ? AND LectureEnd = ?", [COMPANY.A.code, cur!.s, cur!.e]));
  await expect(page.getByRole('row', { name: `훈련인원 총 ${trainees}명` })).toBeVisible();
  await expect(page.getByText('김학습').first()).toBeVisible();
  for (const name of ['차타사', '차만료', '나보정', '배학습', '구분초', '테스트원']) await expect(page.getByText(name)).toHaveCount(0); // company A only (no B, C, base)
  await expect(page).toHaveTitle(`디지털원격훈련아카이브_${kstDate().replace(/-/g, '')}`);
  await checks.checkpoint('assessment-report');
  if (browserName === 'chromium' && testInfo.project.name === 'desktop') {
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);
    await page.emulateMedia({ media: 'screen' });
  }
});
