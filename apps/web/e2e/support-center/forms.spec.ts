/**
 * Public forms — docs/learner-parity/support.md §2:
 * 기업교육상담 (archive/main/inquiry_pop.php + inquiry_ok.php → POST /v1/support/inquiries → Inquiry) as a non-member: PHP required
 * fields, 보안코드, honeypot, 3 per 10 minutes per IP, the 10-minute duplicate guard (same company + phone), SEND_NOT_CONFIGURED notice;
 * 부정행위 제보 (archive/etc/cheating_report.html → cheating_ok.php → Cheating) + 교육유의사항 / 부정행위방지정책 tabs.
 */
import { test, expect, hidePopups } from '../support/test';
import { CaptchaTracker, solveCaptcha } from './helpers';

test.use({ area: 'support' });

test.beforeEach(async ({ page }) => { await hidePopups(page); });

test('기업교육상담: PHP required fields and formats are checked before sending', async ({ page, checks }) => {
  const sent: string[] = [];
  page.on('request', (r) => { if (r.url().endsWith('/v1/support/inquiries')) sent.push(r.method()); });
  await page.goto('/support/inquiry/new');
  await expect(page.getByRole('heading', { name: /교육 목적과 운영조건을/ })).toBeVisible();
  await expect(page.getByText('개인정보 수집 및 이용에 대한 안내')).toBeVisible();
  await page.getByRole('button', { name: '상담 신청' }).click();
  for (const m of ['회사명을 입력하세요.', '이름을 입력하세요.', '연락처를 입력하세요.', '이메일을 입력하세요.', '예상인원을 입력하세요.', '문의내용을 입력하세요.', '보안코드를 입력하세요.', '동의여부를 체크해주세요.']) {
    await expect(page.getByText(m).first()).toBeVisible();
  }
  await page.getByLabel('연락처').fill('010-12a4');
  await page.getByLabel('이메일').fill('hr@e2e.example'); // PHP regex: 2–4 letter TLD only (function.js:772-782)
  await page.getByLabel('교육 예정 인원').fill('삼십');
  await page.getByRole('button', { name: '상담 신청' }).click();
  await expect(page.getByText('연락처는 숫자만 입력하세요.').first()).toBeVisible();
  await expect(page.getByText('올바른 이메일 주소가 아닙니다.').first()).toBeVisible(); // function.js:772-782 regex
  await expect(page.getByText('예상인원은 숫자만 입력하세요.').first()).toBeVisible();
  await checks.checkpoint('inquiry-errors');
  expect(sent).toEqual([]);
});

test('기업교육상담 as a non-member: saved to Inquiry (AES phone/e-mail), SEND_NOT_CONFIGURED notice, duplicate guard, rate limit, honeypot', async ({ page, db, checks }) => {
  const company = `E2E 상담기업 ${Date.now()}`;
  const captcha = new CaptchaTracker(page);
  await page.goto('/support/inquiry/new');
  await expect.poll(() => captcha.count).toBe(1);
  await page.getByLabel('기업·기관명').fill(company);
  await page.getByLabel('담당자명').fill('최상담');
  await page.getByLabel('연락처').fill('01055554444');
  await page.getByLabel('이메일').fill('hr@e2e.co.kr');
  await page.getByLabel('교육 예정 인원').fill('30');
  await page.getByRole('combobox', { name: '희망 운영유형' }).click();
  await page.getByRole('option', { name: '환급형', exact: true }).click();
  await page.getByLabel('교육 대상').fill('신입사원');
  await page.getByLabel('교육 목적·상담 내용').fill('신입 온보딩에 아카이브를 쓰고 싶습니다.');
  await page.getByLabel('위 개인정보 수집 및 이용에 동의합니다.').check();
  await page.locator('#inq-captcha').fill(captcha.code());
  const res = page.waitForResponse((r) => r.url().endsWith('/v1/support/inquiries') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '상담 신청' }).click();
  const body = await (await res).json();
  expect(body).toMatchObject({ ok: true, notified: false, notifyCode: 'SEND_NOT_CONFIGURED' });
  await expect(page.getByText('상담 신청이 접수되었습니다.')).toBeVisible();
  await expect(page.getByText('담당자 자동 알림은 아직 연결되지 않아, 접수 내용은 담당자가 상담 관리 화면에서 확인합니다.')).toBeVisible();
  await checks.checkpoint('inquiry-done');
  const row = await db.one<Record<string, unknown>>(`SELECT ServiceType, CompanyName, Name, ${db.aesDec('Phone')} AS phone, ${db.aesDec('Email')} AS email, Personnel, Contents, AgreeYN, Del, Status FROM Inquiry WHERE idx = ?`, [body.idx]);
  expect(row).toMatchObject({ ServiceType: '1', CompanyName: company, Name: '최상담', phone: '010-5555-4444', email: 'hr@e2e.co.kr', Personnel: '30', AgreeYN: 'Y', Del: 'N', Status: 'A' });
  expect(String(row!.Contents)).toContain('신입 온보딩에 아카이브를 쓰고 싶습니다.');
  expect(String(row!.Contents)).toMatch(/희망 운영유형.*환급형/);
  expect(String(row!.Contents)).toMatch(/교육 대상.*신입사원/);
  // same company + phone within 10 minutes → refused as a double submit (request 2 of this IP)
  const form = { companyName: company, name: '최상담', phone: '010-5555-4444', email: 'hr@e2e.co.kr', personnel: '30', contents: '다시', agree: true };
  const tok = async () => (await (await page.request.get('/v1/support/captcha?purpose=inquiry')).json()).token as string;
  let t = await tok();
  let r = await page.request.post('/v1/support/inquiries', { data: { ...form, captchaToken: t, captchaCode: solveCaptcha(t) } });
  expect(r.status()).toBe(409);
  expect(JSON.stringify(await r.json())).toContain('같은 연락처로 방금 접수된 상담이 있습니다.');
  // honeypot filled → refused (request 3)
  t = await tok();
  r = await page.request.post('/v1/support/inquiries', { data: { ...form, phone: '010-5555-4445', website: 'http://spam.example', captchaToken: t, captchaCode: solveCaptcha(t) } });
  expect(r.status()).toBe(400);
  expect(Number(await db.scalar('SELECT COUNT(*) FROM Inquiry WHERE CompanyName = ?', [company]))).toBe(1);
  // the 4th request of this IP inside 10 minutes is throttled (3 / 10 min)
  t = await tok();
  r = await page.request.post('/v1/support/inquiries', { data: { ...form, phone: '010-5555-4446', captchaToken: t, captchaCode: solveCaptcha(t) } });
  expect(r.status()).toBe(429);
  expect(Number(await db.scalar('SELECT COUNT(*) FROM Inquiry WHERE CompanyName = ?', [company]))).toBe(1);
});

test('교육유의사항 and 부정행위방지정책 tabs (etc/guide.html, etc/cheating_guide.html)', async ({ page, checks }) => {
  await page.goto('/support/cheating');
  await expect(page.getByRole('heading', { name: '본인인증 안내' })).toBeVisible();
  await expect(page.getByText('최소 훈련시간인 15시간 충족 시 자동 수료됩니다.')).toBeVisible();
  await expect(page.getByText(/하루 최대 8시간까지만 수강이 가능합니다/)).toBeVisible();
  await checks.checkpoint('cheating-guide');
  const tabs = page.getByRole('group', { name: '교육유의사항·부정행위 제보' });
  await tabs.getByRole('button', { name: '부정행위방지정책' }).click();
  await expect(page).toHaveURL(/tab=policy/);
  await expect(page.getByRole('heading', { name: '부정훈련 적발 기준' })).toBeVisible();
  await expect(page.getByText('연속된 시간에 동일 IP, 동일 PC정보에서 평가 제출 시')).toBeVisible();
  await expect(page.getByRole('link', { name: '부정훈련 예방 안내 영상 보기' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=21HimbwWGYY');
  await checks.checkpoint('cheating-policy');
});

test('부정행위 제보 (non-member): every field required like cheating_ok.php, saved to Cheating without a member id', async ({ page, db, checks }) => {
  const title = `[E2E] 대리수강 의심 ${Date.now()}`;
  const captcha = new CaptchaTracker(page);
  await page.goto('/support/cheating?tab=report');
  await expect.poll(() => captcha.count).toBe(1);
  await page.getByRole('button', { name: '제보하기' }).click();
  await expect(page.getByText('제목을 입력해주세요.').first()).toBeVisible();
  await expect(page.getByText('제보회신 방법을 선택해주세요.').first()).toBeVisible();
  await expect(page.getByText('필수 입력 항목이 누락되었습니다.').first()).toBeVisible();
  await expect(page.getByText('개인정보 수집 및 이용 동의는 필수입니다.').first()).toBeVisible();
  await page.locator('#ch-title').fill(title);
  await page.locator('#ch-contents').fill('같은 PC에서 여러 계정이 학습합니다.');
  await page.locator('#ch-name').fill('익명제보');
  await page.locator('#ch-email').fill('whistle@e2e.co.kr');
  await page.locator('#ch-phone').fill('010-3333-2222');
  await page.getByRole('combobox', { name: '제보회신' }).click();
  await page.getByRole('option', { name: '이메일', exact: true }).click();
  await page.getByLabel('개인정보 수집 및 이용에 동의합니다.(필수)').check();
  await page.locator('#ch-captcha').fill(captcha.code());
  const res = page.waitForResponse((r) => r.url().endsWith('/v1/support/cheating-reports'));
  await page.getByRole('button', { name: '제보하기' }).click();
  const body = await (await res).json();
  expect(body).toMatchObject({ ok: true });
  await expect(page.getByText('제출되었습니다.')).toBeVisible();
  await checks.checkpoint('cheating-report-done');
  const row = await db.one<Record<string, unknown>>(`SELECT Name, Category, ${db.aesDec('Mobile')} AS mobile, ${db.aesDec('Email')} AS email, Title, Contents, Status, Del FROM Cheating WHERE idx = ?`, [body.idx]);
  expect(row).toEqual({ Name: '익명제보', Category: 'B', mobile: '010-3333-2222', email: 'whistle@e2e.co.kr', Title: title, Contents: '같은 PC에서 여러 계정이 학습합니다.', Status: 'A', Del: 'N' });
});
