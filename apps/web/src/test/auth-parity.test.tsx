import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from '../app/router';
import { isPhpEmail, loginIdError, passwordPolicyError, PASSWORD_REPEAT_MESSAGE, PASSWORD_RULE_MESSAGE, hasPasswordSkip, rememberPasswordSkip } from '../shared/auth/accountRules';
import { startSessionPoller } from '../shared/auth/sessionPoller';
import { tokenStore } from '../shared/auth/tokenStore';
import { signupFormError } from '../features/auth/SignupInfoPage';
import { otpError } from '../features/auth/FindPasswordPage';
import { passwordChangeError } from '../features/auth/PasswordChangePage';
import { writeConsent, emptyConsents } from '../features/auth/signupState';
import { marketingCode } from '../shared/api/endpoints/members';
import { fillLegal, PRIVACY_SECTIONS, TERMS_SECTIONS } from '../features/legal/legalText';
import { withSessionFlags } from '../app/providers/SessionProvider';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Handler = (url: string, init: RequestInit) => Response | undefined;
/** fetch stub: the first handler that answers wins; anything else is a 404 (design falls back to DEFAULT_DESIGN, refresh → guest). */
const stubFetch = (...handlers: Handler[]) => {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    for (const h of handlers) { const r = h(url, init); if (r) return r; }
    return json({ error: { code: 'NOT_FOUND', message: 'x' } }, url.includes('/auth/refresh') ? 401 : 404);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
};
const bodyOf = (fn: ReturnType<typeof stubFetch>, part: string) => {
  const call = fn.mock.calls.find(([u]) => String(u).includes(part));
  return call ? JSON.parse(String((call[1] as RequestInit).body)) : undefined;
};
const mount = (path: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(<QueryClientProvider client={qc}><MotionConfig reducedMotion="always"><RouterProvider router={memory} /></MotionConfig></QueryClientProvider>);
  return memory;
};

describe('account rules (include/function.js)', () => {
  it('password rule matches CheckPassword() vectors (same set as the API spec)', () => {
    const cases: [string, 'OK' | 'RULE' | 'REPEAT'][] = [['abcd1234', 'RULE'], ['abcd123!', 'OK'], ['abcdefghij', 'REPEAT'], ['a1b2c3d4e5', 'OK'], ['654321ab!x', 'REPEAT'], ['abcd&123', 'RULE'], ['aab12!cc', 'OK'], ['1111111111', 'REPEAT']];
    for (const [pw, want] of cases) {
      const m = passwordPolicyError(pw);
      expect([pw, m === null ? 'OK' : m === PASSWORD_REPEAT_MESSAGE ? 'REPEAT' : m === PASSWORD_RULE_MESSAGE ? 'RULE' : m]).toEqual([pw, want]);
    }
  });
  it('id and e-mail rules', () => {
    expect(loginIdError('abc')).toBe('아이디는 6자이상 20자 이내로 입력하세요.');
    expect(loginIdError('abc_123')).toBe('아이디는 영문/숫자만 입력 가능합니다.');
    expect(loginIdError('abc123')).toBeNull();
    expect(isPhpEmail('a.b@c.co.kr')).toBe(true);
    expect(isPhpEmail('a+b@c.com')).toBe(false);
  });
  it('signup / password-change / OTP form checks run in the PHP order', () => {
    const base = { name: '홍길동', mobile: '010-1234-5678', id: 'hong01', password: 'Passw0rd!x', confirm: 'Passw0rd!x', email: 'a@b.com', recomId: '' };
    expect(signupFormError({ ...base, name: '' }, true, false)).toEqual(['name', '이름을 입력하세요.']);
    expect(signupFormError({ ...base, mobile: '010-12-ab' }, true, false)).toEqual(['mobile', '휴대전화번호는 숫자만 입력하세요.']);
    expect(signupFormError(base, false, false)).toEqual(['id', '아이디 중복 검색을 하세요.']);
    expect(signupFormError({ ...base, confirm: 'x' }, true, false)).toEqual(['confirm', '비밀번호와 비밀번호 확인이 일치하지 않습니다.']);
    expect(signupFormError({ ...base, recomId: 'rec01' }, true, false)).toEqual(['recomId', '추천인 ID 확인을 하세요.']);
    expect(signupFormError(base, true, false)).toBeNull();
    expect(otpError('')).toBe('인증번호를 입력하세요.');
    expect(otpError('12345')).toBe('인증번호는 6자리입니다.');
    expect(otpError('12a456')).toBe('인증번호는 숫자만 입력하세요.');
    expect(passwordChangeError({ current: '1111', pw: 'abcd1234', pw2: 'abcd1234' })).toBe(PASSWORD_RULE_MESSAGE);
    expect(passwordChangeError({ current: '1111', pw: 'Newpass1!x', pw2: 'Newpass1!x' })).toBe('');
    expect(marketingCode(true, true)).toBe('Y');
    expect(marketingCode(false, true)).toBe('S');
  });
  it('「나중에 변경하기」 is remembered per id for 90 days', () => {
    localStorage.clear();
    expect(hasPasswordSkip('u1')).toBe(false);
    rememberPasswordSkip('u1');
    expect(hasPasswordSkip('u1')).toBe(true);
    expect(hasPasswordSkip('u2')).toBe(false);
  });
  it('legal text is the PHP document with the SiteInfomation placeholders filled', () => {
    expect(TERMS_SECTIONS.map((s) => s.title)).toEqual(['제 1 장 총칙', '제 2 장 회원의 권리와 의무', '제 3 장 교육원의 역할', '제 4 장 서비스 관리', '부칙']);
    expect(PRIVACY_SECTIONS.some((s) => s.title.includes('개인정보 제3자 제공 동의'))).toBe(true);
    expect(fillLegal('{{siteName}} / {{privacyManager}}', { siteName: 'HRDe아카이브', privacyManager: '홍길동' })).toBe('HRDe아카이브 / 홍길동');
  });
});

describe('session poller (login_status.php every 60 s)', () => {
  beforeEach(() => { tokenStore.set('expired-access'); });
  afterEach(() => { vi.unstubAllGlobals(); tokenStore.clear(); });
  it('renews the 15-minute access token on 401 instead of signing the learner out', async () => {
    const fn = stubFetch(
      (u, init) => (u.includes('/auth/session') && (init.headers as Record<string, string>).Authorization === 'Bearer expired-access' ? json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401) : undefined),
      (u) => (u.includes('/auth/refresh') ? json({ accessToken: 'fresh', expiresIn: 900, user: { id: 'u1' }, next: 'home' }) : undefined),
      (u) => (u.includes('/auth/session') ? json({ status: 'Y' }) : undefined),
    );
    const seen: string[] = [];
    const p = startSessionPoller((s) => seen.push(s), 60_000);
    await p.tick();
    p.stop();
    expect(seen).toEqual(['Y']);
    expect(tokenStore.get()).toBe('fresh');
    expect(fn.mock.calls.filter(([u]) => String(u).includes('/auth/session'))).toHaveLength(2);
  });
  it('reports N when the refresh says another session took over, O otherwise', async () => {
    stubFetch((u) => (u.includes('/auth/session') ? json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401) : undefined), (u) => (u.includes('/auth/refresh') ? json({ error: { code: 'OTHER_SESSION', message: 'x' } }, 401) : undefined));
    const seen: string[] = [];
    let p = startSessionPoller((s) => seen.push(s), 60_000);
    await p.tick(); p.stop();
    vi.unstubAllGlobals();
    tokenStore.set('expired-access');
    stubFetch((u) => (u.includes('/auth/session') ? json({ error: { code: 'SESSION_EXPIRED', message: 'x' } }, 401) : undefined));
    p = startSessionPoller((s) => seen.push(s), 60_000);
    await p.tick(); p.stop();
    expect(seen).toEqual(['N', 'O']);
  });
});

describe('member pages', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('signup terms: the three required items gate the next step with the PHP messages', async () => {
    stubFetch();
    const memory = mount('/auth/signup/terms');
    fireEvent.click(await screen.findByRole('button', { name: '동의하고 다음' }));
    expect(await screen.findByText('이용약관에 동의하여야 회원가입이 가능합니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/이용약관 동의/));
    fireEvent.click(screen.getByLabelText(/개인정보 수집 및 이용 동의/));
    fireEvent.click(screen.getByRole('button', { name: '동의하고 다음' }));
    expect(await screen.findByText('개인정보의 제3자 제공에 동의하여야 회원가입이 가능합니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/개인정보 제3자 제공 동의/));
    fireEvent.click(screen.getByLabelText(/교육 소식\(마케팅\) 수신 동의/));
    expect(screen.getByLabelText('이메일')).toBeChecked();
    expect(screen.getByLabelText('SMS')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 다음' }));
    await waitFor(() => expect(memory.state.location.pathname).toBe('/auth/signup/info'));
    expect(JSON.parse(sessionStorage.getItem('signup.consent.v2')!)).toMatchObject({ terms: true, privacy: true, thirdParty: true, sending: false, marketingEmail: true, marketingSms: true });
  });

  it('signup info: sends the join_ok.php fields and shows the existing-site link on IDENTITY_REQUIRED', async () => {
    writeConsent({ ...emptyConsents(), terms: true, privacy: true, thirdParty: true, sending: true, marketingEmail: true });
    const fn = stubFetch(
      (u) => (u.includes('/members/id-check') ? json({ available: true }) : undefined),
      (u) => (u.includes('/members/signup') ? json({ error: { code: 'IDENTITY_REQUIRED', message: '휴대폰 본인인증은 현재 기존 사이트에서만 진행할 수 있습니다. 기존 사이트에서 회원가입해 주세요.' } }, 503) : undefined),
    );
    mount('/auth/signup/info');
    fireEvent.change(await screen.findByLabelText(/^아이디/), { target: { value: 'hong01' } });
    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));
    expect(await screen.findByText('사용 가능한 아이디입니다.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^비밀번호$|^비밀번호\*/), { target: { value: 'Passw0rd!x' } });
    fireEvent.change(screen.getByLabelText(/^비밀번호 확인/), { target: { value: 'Passw0rd!x' } });
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/^휴대폰/), { target: { value: '01012345678' } });
    fireEvent.change(screen.getByLabelText(/^이메일/), { target: { value: 'hong@hrdeedu.co.kr' } });
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }));
    expect(await screen.findByText(/기존 사이트에서만 진행할 수 있습니다/)).toBeInTheDocument();
    expect(bodyOf(fn, '/members/signup')).toEqual({ id: 'hong01', password: 'Passw0rd!x', name: '홍길동', mobile: '01012345678', email: 'hong@hrdeedu.co.kr', consents: { mandatory: true, sending: true, marketingEmail: true, marketingSms: false } });
    expect(screen.getAllByRole('link', { name: /기존 사이트에서 본인인증 후 가입/ })[0]).toHaveAttribute('href', expect.stringContaining('/public/member/join_terms.html'));
  });

  it('find password: 인증번호 step, then the temporary password by SMS', async () => {
    const fn = stubFetch(
      (u) => (u.includes('/find-password/otp') ? json({ sent: true, message: '등록된 휴대폰번호로 인증번호를 전송하였습니다. 5분 내에 입력해주세요.', challenge: 'c1', expiresIn: 300 }) : undefined),
      (u) => (u.includes('/find-password/verify') ? json({ ok: true, sent: true, message: '등록된 휴대폰번호로 임시비밀번호를 전송하였습니다.' }) : undefined),
    );
    mount('/auth/find-password');
    fireEvent.click(await screen.findByRole('button', { name: '인증번호 발송' }));
    expect(await screen.findByText('아이디를 입력하세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^아이디/), { target: { value: 'hong01' } });
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/^휴대폰 번호/), { target: { value: '010-1234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 발송' }));
    const otp = await screen.findByLabelText(/^인증번호/);
    expect(screen.getByLabelText(/^아이디/)).toBeDisabled();
    fireEvent.change(otp, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 찾기' }));
    expect(await screen.findByText('등록된 휴대폰번호로 임시비밀번호를 전송하였습니다.')).toBeInTheDocument();
    expect(bodyOf(fn, '/find-password/verify')).toEqual({ id: 'hong01', challenge: 'c1', otp: '123456' });
  });

  it('find id: the id is never shown; SEND_NOT_CONFIGURED links to the existing site', async () => {
    stubFetch((u) => (u.includes('/members/find-id') ? json({ sent: false, message: '시스템 오류가 발생했습니다. 관리자에게 문의하세요.', code: 'SEND_NOT_CONFIGURED' }) : undefined));
    mount('/auth/find-id');
    fireEvent.change(await screen.findByLabelText(/^이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/^휴대폰 번호/), { target: { value: '01012345678' } });
    fireEvent.click(screen.getByRole('button', { name: '아이디 전송' }));
    expect(await screen.findByText('시스템 오류가 발생했습니다. 관리자에게 문의하세요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /기존 사이트에서 아이디 찾기/ })).toHaveAttribute('href', expect.stringContaining('/public/member/find_id.html'));
  });

  it('terms page renders the PHP 이용약관 with its chapters', async () => {
    stubFetch();
    mount('/terms');
    expect(await screen.findByRole('heading', { level: 2, name: '제 1 장 총칙' })).toBeInTheDocument();
    expect(screen.getByText(/시행일 2023-07-25/)).toBeInTheDocument();
    expect(screen.getByText(/제 1조 목적/)).toBeInTheDocument();
  });

  it('회원·이용정보: only the e-mail is editable (휴대폰 is 본인인증 정보), the PHP e-mail pattern is enforced', async () => {
    const user = { id: 'hong01', name: '홍길동', memberType: 'A', eduManager: false, testId: false, companyCode: null };
    const fn = stubFetch(
      (u) => (u.includes('/auth/refresh') ? json({ accessToken: 'a1', expiresIn: 900, user: { ...user, flags: { termsPending: false, mustChangePassword: false } }, next: 'home' }) : undefined),
      (u) => (u.endsWith('/auth/me') ? json(user) : undefined),
      (u, init) => (u.endsWith('/members/me') && init.method === 'PATCH' ? json({ id: 'hong01', name: '홍길동', email: 'new@hrdeedu.co.kr', mobile: '010-1234-5678', consents: { mandatory: true, sending: true, marketing: 'N' } }) : undefined),
      (u) => (u.endsWith('/members/me') ? json({ id: 'hong01', name: '홍길동', email: 'old@hrdeedu.co.kr', mobile: '010-1234-5678', consents: { mandatory: true, sending: true, marketing: 'E' } }) : undefined),
      (u) => (u.includes('/members/me/company') ? json(null) : undefined),
      (u) => (u.includes('/enrollments/me') ? json({ items: [] }) : undefined),
    );
    mount('/my/profile');
    expect(await screen.findByText('010-1234-5678')).toBeInTheDocument();
    expect(screen.getByText('휴대폰 번호는 본인인증 정보입니다. 정정이 필요하면 고객지원에 문의해 주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '이메일 변경' })[0]!);
    expect(screen.queryByLabelText('휴대폰')).not.toBeInTheDocument();
    const email = screen.getByLabelText('이메일');
    fireEvent.change(email, { target: { value: 'a+b@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    expect(await screen.findByText('이메일을 정확하게 입력하세요.')).toBeInTheDocument();
    fireEvent.change(email, { target: { value: 'new@hrdeedu.co.kr' } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(fn.mock.calls.some(([u, i]) => String(u).endsWith('/members/me') && (i as RequestInit).method === 'PATCH')).toBe(true));
    const patch = fn.mock.calls.find(([u, i]) => String(u).endsWith('/members/me') && (i as RequestInit).method === 'PATCH')!;
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toEqual({ email: 'new@hrdeedu.co.kr' });
    expect(screen.getByText('이메일')).toBeInTheDocument();
  });

  it('signup info: a successful join_ok.php answer lands on 가입 완료 (not back on the terms step)', async () => {
    writeConsent({ ...emptyConsents(), terms: true, privacy: true, thirdParty: true });
    stubFetch(
      (u) => (u.includes('/members/id-check') ? json({ available: true }) : undefined),
      (u) => (u.includes('/members/signup') ? json({ ok: true, id: 'hong01', idx: 1 }) : undefined),
    );
    const memory = mount('/auth/signup/info');
    fireEvent.change(await screen.findByLabelText(/^아이디/), { target: { value: 'hong01' } });
    fireEvent.click(screen.getByRole('button', { name: '중복 확인' }));
    expect(await screen.findByText('사용 가능한 아이디입니다.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^비밀번호$|^비밀번호\*/), { target: { value: 'Passw0rd!x' } });
    fireEvent.change(screen.getByLabelText(/^비밀번호 확인/), { target: { value: 'Passw0rd!x' } });
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText(/^휴대폰/), { target: { value: '01012345678' } });
    fireEvent.change(screen.getByLabelText(/^이메일/), { target: { value: 'hong@hrdeedu.co.kr' } });
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }));
    expect(await screen.findByText('회원가입이 완료되었습니다.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(memory.state.location.pathname).toBe('/auth/signup/complete');
    expect(sessionStorage.getItem('signup.consent.v2')).toBeNull();
  });

  it('signup info: 추천인 ID 확인 shows the answer even after the empty-field message', async () => {
    writeConsent({ ...emptyConsents(), terms: true, privacy: true, thirdParty: true });
    stubFetch((u) => (u.includes('/members/recom-id-check') ? json({ exists: false, message: '입력하신 추천인 ID가 없습니다.' }) : undefined));
    mount('/auth/signup/info');
    fireEvent.click(await screen.findByRole('button', { name: '추천인 ID 확인' }));
    expect(await screen.findByText('추천인 ID를 입력하세요.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^추천인 ID/), { target: { value: 'nobody99' } });
    fireEvent.click(screen.getByRole('button', { name: '추천인 ID 확인' }));
    expect(await screen.findByText('입력하신 추천인 ID가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText('추천인 ID를 입력하세요.')).not.toBeInTheDocument();
  });
});

describe('login / session (login_ok.php, logout.php)', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); tokenStore.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); tokenStore.clear(); });
  const user = { id: 'pw01', name: '변경일', memberType: 'A', eduManager: false, testId: false, companyCode: null };

  it('refused logins show the login_ok.php alert the API answers', async () => {
    const answers = [
      { code: 'DORMANT', status: 403, message: '현재 휴면계정 상태입니다. [휴면계정 복구] 메뉴를 통해 계정을 복구하세요.' },
      { code: 'WITHDRAWN', status: 403, message: '탈퇴한 회원입니다.' },
      { code: 'INVALID_CREDENTIALS', status: 401, message: '아이디 또는 비밀번호를 잘못 입력했습니다.' },
    ];
    let n = 0;
    stubFetch((u) => (u.endsWith('/auth/login') ? json({ error: { code: answers[n]!.code, message: answers[n]!.message } }, answers[n++]!.status) : undefined));
    mount('/auth/login');
    fireEvent.change(await screen.findByLabelText('아이디'), { target: { value: 'someone01' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: '1111' } });
    for (const a of answers) {
      fireEvent.click(screen.getByRole('button', { name: '로그인' }));
      expect(await screen.findByText(a.message)).toBeInTheDocument();
    }
  });

  it('logout from a protected page goes to the main page, not to the login form', async () => {
    stubFetch(
      (u) => (u.includes('/auth/refresh') ? json({ accessToken: 'a1', expiresIn: 900, user: { ...user, flags: { termsPending: false, mustChangePassword: false } }, next: 'home' }) : undefined),
      (u) => (u.endsWith('/auth/me') ? json(user) : undefined),
      (u) => (u.endsWith('/auth/logout') ? json({ ok: true }) : undefined),
    );
    const memory = mount('/my/profile');
    const out = await screen.findAllByRole('button', { name: '로그아웃' });
    fireEvent.click(out[0]!);
    expect(await screen.findByText('로그아웃되었습니다. 서버에 저장된 학습기록은 유지됩니다.')).toBeInTheDocument();
    await waitFor(() => expect(memory.state.location.pathname).toBe('/'));
    expect(memory.state.location.search).toBe('');
  });

  it('logout with an expired access token renews it and repeats the logout (the refresh cookie gets cleared)', async () => {
    let refreshes = 0;
    const fn = stubFetch(
      (u) => (u.includes('/auth/refresh') ? json({ accessToken: `a${++refreshes}`, expiresIn: 900, user: { ...user, flags: { termsPending: false, mustChangePassword: false } }, next: 'home' }) : undefined),
      (u) => (u.endsWith('/auth/me') ? json(user) : undefined),
      (u, init) => (u.endsWith('/auth/logout') ? ((init.headers as Record<string, string>).Authorization === 'Bearer a1' ? json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401) : json({ ok: true })) : undefined),
    );
    const memory = mount('/my/profile');
    fireEvent.click((await screen.findAllByRole('button', { name: '로그아웃' }))[0]!);
    await waitFor(() => expect(memory.state.location.pathname).toBe('/'));
    const logouts = fn.mock.calls.filter(([u]) => String(u).endsWith('/auth/logout')).map(([, i]) => ((i as RequestInit).headers as Record<string, string>).Authorization);
    expect(logouts).toEqual(['Bearer a1', 'Bearer a2']);
  });

  it('a restored session keeps the 임시 비밀번호 flag (GET /auth/me has no flags): the password page offers 나중에 변경하기', async () => {
    stubFetch(
      (u) => (u.includes('/auth/refresh') ? json({ accessToken: 'a1', expiresIn: 900, user: { ...user, flags: { termsPending: false, mustChangePassword: true } }, next: 'password' }) : undefined),
      (u) => (u.endsWith('/auth/me') ? json(user) : undefined),
    );
    mount('/auth/password-change');
    expect(await screen.findByRole('button', { name: '나중에 변경하기' })).toBeInTheDocument();
    expect(screen.getByText('처음 안내받은 비밀번호 또는 문자로 받은 임시 비밀번호를 입력해 주세요.')).toBeInTheDocument();
  });

  it('withSessionFlags: keeps the refresh flags for the same learner, defaults otherwise', () => {
    const flags = { termsPending: true, mustChangePassword: true };
    expect(withSessionFlags(user, { ...user, flags }).flags).toEqual(flags);
    expect(withSessionFlags(user, { ...user, id: 'other', flags }).flags).toEqual({ termsPending: false, mustChangePassword: false });
    expect(withSessionFlags({ ...user, flags: { termsPending: false, mustChangePassword: false } }, { ...user, flags }).flags).toEqual({ termsPending: false, mustChangePassword: false });
    expect(withSessionFlags(user, null).flags).toEqual({ termsPending: false, mustChangePassword: false });
  });
});
