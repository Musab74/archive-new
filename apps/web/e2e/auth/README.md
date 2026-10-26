# e2e — 회원/인증 (auth)

Reference: `docs/learner-parity/auth.md` (API tree) and the PHP pages it cites. Specs: `login`, `session`, `signup`, `find`,
`password-profile`, `chrome` (header/footer by role, Live Class SSO, home popup). Helpers: `authHelpers.ts`.

Extra rows: `../fixtures/auth.sql` — company `2208820001` E2E 인증상사 (idx 20000, managed by nobody, no enrollments) and the
`xauth*` learners (idx 20001–20010, password 1111 unless noted), plus the `find_id` / `pw_reset_otp` SendMessage templates.

| ID | use |
|---|---|
| `xauthq01` | password ``Ab'cd"ef\gh--ij1!`` (stored as SHA-256 of the Replace_Check_XSS2 form) |
| `xauthq02` | password `Hex-type-2026!` ("type" and "--" dropped by Replace_Check_XSS2) |
| `xauthpw01` | PassChange=N (임시 비밀번호), 나중에 변경하기 |
| `xauthpw03` | normal password change from 회원정보 (EditDate) |
| `xauthprof01` | 회원정보 e-mail edit, 수신 동의 switches |
| `xauthsess01` | single session / token renewal |
| `xauthout01` | login rows, logout |
| `xauthlimit01` | 10-per-minute login limit |
| `xauthfind01` | 아이디·비밀번호 찾기, mobile 010-7790-2001 |

Every spec resets what it changes (Pwd, PassChange, Mandatory, LoginIng, …), so the folder re-runs on a used DB. Signup and the
인증번호 send-limit test use a fresh `X-Forwarded-For` per test (the API keeps those limits per IP for 10 / 15 minutes). Full
signups leave `xauthj*` members behind (deleted after a day by the spec itself).

Two checks need a non-production API setting and are skipped otherwise:

```bash
E2E_API_FEATURE_SIGNUP_WITHOUT_IDENTITY=true node e2e/stack.mjs restart-api --skip-build   # full join_ok.php signup
nice -n 10 npm run test:e2e -- auth/signup.spec.ts
E2E_API_ACCESS_TOKEN_TTL_SEC=20 node e2e/stack.mjs restart-api --skip-build                # real 15-minute token expiry
nice -n 10 npm run test:e2e -- auth/session.spec.ts -g "real expiry"
node e2e/stack.mjs restart-api --skip-build                                                # back to the production values
```

Blocked here (asserted as the documented fallback): NICE 본인인증 (signup → IDENTITY_REQUIRED + link to the existing join page) and
SMS (아이디/비밀번호 찾기 → SmsSendLog row + SEND_NOT_CONFIGURED; no 인증번호 is issued, so the 5-minute expiry and the 5-wrong-tries
lock are covered by the OtpState unit tests only).
