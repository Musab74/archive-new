/**
 * 러비 (Ruby Q&A) and 코비 (Kobe coach) — docs/learner-parity/catalog.md §9, §10. No external AI call: the local stack has no
 * OPENAI_API_KEY, so answers come from the fixed rules / stored answers / the fallback texts.
 *
 * Two modes, picked from GET /v1/chatbot/config:
 *   default stack (RUBY_/KOBE_ROLLOUT_ENABLED=false, production values) → the "rollout off" tests run;
 *   `E2E_API_RUBY_ROLLOUT_ENABLED=true E2E_API_KOBE_ROLLOUT_ENABLED=true node e2e/stack.mjs restart-api --skip-build`
 *   → the "rollout on" tests run (then restart without the flags).
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';

test.use({ area: 'catalog' });

async function rollout(request: APIRequestContext): Promise<{ ruby: boolean; kobe: boolean }> {
  return (await request.get('/v1/chatbot/config')).json();
}
const rubyToggle = (page: Page) => page.getByRole('button', { name: '챗봇 러비 열기' });
const kobeToggle = (page: Page) => page.getByRole('button', { name: '코비 열기' });
const rubyPanel = (page: Page) => page.getByRole('region', { name: 'Chat Bot 러비' });
const kobePanel = (page: Page) => page.getByRole('region', { name: 'AI 학습코치 코비' });

async function askRuby(page: Page, text: string): Promise<void> {
  const reply = page.waitForResponse((r) => /\/v1\/chatbot\/ruby\/(reply|tickets)$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  await rubyPanel(page).getByPlaceholder('질문을 입력해 주세요').fill(text);
  await rubyPanel(page).getByRole('button', { name: '전송' }).click();
  expect((await reply).status()).toBe(200);
}

test.describe('rollout off (production default)', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip((await rollout(request)).ruby, 'stack runs with RUBY_ROLLOUT_ENABLED=true');
    await hidePopups(page);
  });

  test('러비 and 코비 are hidden for guests and learners', async ({ page, checks }) => {
    await page.goto('/');
    await expect(page.getByText('지금 만나는 콘텐츠')).toBeVisible();
    await expect(rubyToggle(page)).toHaveCount(0);
    await expect(kobeToggle(page)).toHaveCount(0);
    await openAs(page, 'xcatalog01', '/home');
    await expect(page.getByRole('heading', { level: 1, name: /카탈일님/ })).toBeVisible();
    await page.waitForTimeout(3000); // 코비 would ask its first trigger after 2.5 s
    await expect(rubyToggle(page)).toHaveCount(0);
    await expect(kobeToggle(page)).toHaveCount(0);
    await checks.checkpoint('chatbots-off');
  });

  test('?ruby=1 QA override shows 러비 in this browser only (include/ruby_rollout.php)', async ({ page }) => {
    await page.goto('/?ruby=1');
    await expect(rubyToggle(page)).toBeVisible();
    await expect(kobeToggle(page)).toHaveCount(0);
    await page.goto('/catalog'); // remembered in the hrde_ruby_rollout cookie
    await expect(rubyToggle(page)).toBeVisible();
    await page.goto('/?ruby=0');
    await expect(rubyToggle(page)).toHaveCount(0);
  });
});

test.describe('rollout on (E2E_API_RUBY_/KOBE_ROLLOUT_ENABLED=true)', () => {
  test.beforeEach(async ({ page, request }) => {
    const r = await rollout(request);
    test.skip(!r.ruby || !r.kobe, 'start the API with E2E_API_RUBY_ROLLOUT_ENABLED=true E2E_API_KOBE_ROLLOUT_ENABLED=true');
    await hidePopups(page);
  });

  test('guest: 러비 asks for login, 코비 shows the guest invitation', async ({ page, db, checks }) => {
    const logs = Number(await db.scalar('SELECT COUNT(*) FROM RubyConversationLog'));
    const trigger = page.waitForResponse((r) => r.url().includes('/v1/chatbot/kobe/trigger'), { timeout: 15_000 }); // first call 2.5 s after load
    await page.goto('/');
    await rubyToggle(page).click();
    await expect(rubyPanel(page)).toContainText('안녕하세요. HRDe 학습도우미 챗봇 러비입니다.');
    await askRuby(page, '수료 기준이 뭐예요?');
    await expect(rubyPanel(page)).toContainText('로그인이 필요한 서비스입니다. 로그인 후 이용해 주세요.');
    await expect(rubyPanel(page).getByRole('link', { name: '로그인하기' })).toHaveAttribute('href', /\/auth\/login\?next=/);
    expect(Number(await db.scalar('SELECT COUNT(*) FROM RubyConversationLog'))).toBe(logs); // guests are not logged (reply.php:236-245)
    await checks.checkpoint('ruby-guest');
    await page.mouse.click(5, 5); // a click outside closes the panel
    await expect(rubyPanel(page)).toHaveCount(0);
    const body = await (await trigger).json();
    await kobeToggle(page).click();
    expect(body).toMatchObject({ ok: true, role: 'guest', module_id: 1, chart_data: null, recommended_courses: [] });
    await expect(kobePanel(page)).toContainText(body.message.split('\n')[0]);
  });

  test('learner: fixed answer + RubyConversationLog row, fallback answer without a model, ticket → RubySupportTicket', async ({ page, db, checks }) => {
    await db.exec("DELETE FROM RubyConversationLog WHERE user_id = 'xcatalog01'");
    await db.exec("DELETE FROM RubySupportTicket WHERE user_id = 'xcatalog01'");
    await openAs(page, 'xcatalog01', '/home');
    await rubyToggle(page).click();
    await askRuby(page, '수료 기준이 뭐예요?');
    await expect(rubyPanel(page).getByRole('log')).toContainText('수료 기준은 과정마다 상이합니다.'); // _lib.php fixed answer
    await expect.poll(() => db.scalar<number>("SELECT COUNT(*) FROM RubyConversationLog WHERE user_id = 'xcatalog01'")).toBe(1);
    const first = await db.one<{ user_message: string; is_logged_in: number; intent_category: string; model_used: string }>("SELECT user_message, is_logged_in, intent_category, model_used FROM RubyConversationLog WHERE user_id = 'xcatalog01'");
    expect(first).toMatchObject({ user_message: '수료 기준이 뭐예요?', is_logged_in: 1 });
    expect(first!.model_used).not.toMatch(/gpt|openai/i);
    // a question no rule / stored answer covers: the fallback text (no OPENAI_API_KEY on this stack)
    await askRuby(page, '화성 이주 비자 발급 절차를 알려주세요');
    await expect(rubyPanel(page).getByRole('log')).toContainText(/질문 의도를 정확히 파악하지 못했습니다|답변을 준비하지 못했습니다|답변을 생성할 수 없습니다/);
    await expect.poll(() => db.scalar<number>("SELECT COUNT(*) FROM RubyConversationLog WHERE user_id = 'xcatalog01'")).toBe(2);
    const fb = await db.one<{ fallback_reason: string; model_used: string }>("SELECT fallback_reason, model_used FROM RubyConversationLog WHERE user_id = 'xcatalog01' ORDER BY idx DESC LIMIT 1");
    expect(fb!.model_used).not.toMatch(/gpt|openai/i);
    // ticket: ask for a person → contact prompt → name + phone → RubySupportTicket (status new)
    await askRuby(page, '담당자에게 연락처 남기고 접수할게요');
    await expect(rubyPanel(page).getByRole('log')).toContainText('성함과 연락처를 함께 입력해 주세요');
    await askRuby(page, '홍길동 / 010-1234-5678');
    await expect(rubyPanel(page).getByRole('log')).toContainText('접수가 완료되었습니다.');
    const ticket = await db.one<{ contact_name: string; contact_phone: string; status: string; user_name: string }>("SELECT contact_name, contact_phone, status, user_name FROM RubySupportTicket WHERE user_id = 'xcatalog01'");
    expect(ticket).toEqual({ contact_name: '홍길동', contact_phone: '010-1234-5678', status: 'new', user_name: '카탈일' });
    await checks.checkpoint('ruby-learner');
    expect(checks.external.filter((u) => /openai|anthropic|googleapis/.test(u))).toEqual([]);
  });

  test('learner: 코비 coaching message for the page + KobeTriggerLog row', async ({ page, db, checks }) => {
    await db.exec("DELETE FROM KobeTriggerLog WHERE user_id = 'xcatalog01'");
    const trigger = page.waitForResponse((r) => r.url().includes('/v1/chatbot/kobe/trigger'), { timeout: 15_000 });
    await openAs(page, 'xcatalog01', '/home');
    const body = await (await trigger).json(); // first call 2.5 s after load (kobe-widget.js)
    expect(body).toMatchObject({ ok: true, role: 'learner', chart_data: null, recommended_courses: [] });
    await kobeToggle(page).click();
    await expect(kobePanel(page)).toContainText(body.message.split('\n')[0]);
    if (body.cta) await expect(kobePanel(page).getByRole('link', { name: body.cta.label })).toHaveAttribute('href', body.cta.url);
    await expect.poll(() => db.scalar<number>("SELECT COUNT(*) FROM KobeTriggerLog WHERE user_id = 'xcatalog01'")).toBeGreaterThanOrEqual(1);
    const row = await db.one<{ module_id: number; user_role: string; page: string }>("SELECT module_id, user_role, page FROM KobeTriggerLog WHERE user_id = 'xcatalog01' ORDER BY id DESC LIMIT 1");
    expect(row).toMatchObject({ module_id: body.module_id, user_role: 'learner' });
    await checks.checkpoint('kobe-learner');
    // the hint opens 러비
    await kobePanel(page).getByRole('button', { name: '우측 하단 러비' }).click();
    await expect(rubyPanel(page)).toBeVisible();
  });
});
