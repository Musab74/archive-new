# AINEX e2e harness (Playwright, local stack only)

End-to-end checks of the learner / manager pages in a real Chromium against a **throwaway local copy**: a fresh MariaDB 10.3
(schema + base seed + the fixtures below), the NestJS API built from a monorepo checkout and this SPA served by `vite preview`.
Nothing here ever talks to production: the launcher's guard refuses live paths and ports, the API env is built from scratch,
and the browser aborts every request that is not `http://127.0.0.1`.

```
apps/web/
  playwright.config.ts        projects desktop (1440×900) + phone (390×844, Android UA, touch); workers 1; outputs → run folder
  e2e/
    stack.mjs                 up | down | status | reseed | restart-api | rebuild-web   (node e2e/stack.mjs help)
    stack.test.mjs            guard unit tests (npm run test:e2e-guard)
    preview.config.mjs        vite preview: /v1 proxy + /contents /upload /media /contents-hls + production security headers
    fixtures/seed.sql         e2e data set (loaded after the API tree's base seed)
    fixtures/<area>.sql       optional per-area additions, loaded after seed.sql in name order
    fixtures/media/           lesson.mp4, packaged HTML lesson, upload files, manifest.json
    support/                  test.ts (the `test` to import), login.ts, db.ts, pageChecks.ts, accounts.ts, stack.ts
    smoke.spec.ts             harness smoke (both viewports)
    <area>/*.spec.ts          area specs (고객지원: support-center/, since support/ is the helpers)
```

## Run it

Prerequisites (once per worktree): `node_modules` copied as in the common brief and `@ainex/contracts` built in both trees.
`stack.mjs up` rebuilds contracts, the API (`nest build` in the API tree) and the SPA (into the run folder) every time unless
`--skip-build` is given.

```bash
cd <web worktree>/apps/web
export AINEX_API_TREE=/root/archive-e2e/<slug>-api/new-codebase   # your API worktree (root or new-codebase/)
export E2E_RUN_DIR=/root/archive-e2e/<slug>-run                    # your run folder
export E2E_DB_PORT=<db> E2E_API_PORT=<api> E2E_WEB_PORT=<web>       # your ports

node e2e/stack.mjs up                                   # ~35 s: fresh DB + seed + media, builds, API, web
nice -n 10 npm run test:e2e                             # every spec, desktop + phone
nice -n 10 npm run test:e2e -- myroom/                  # one folder;  -- --project=phone  one viewport;  -- -g "수료증"  by title
node e2e/stack.mjs reseed                               # ~4 s: schema + fixtures + media again, API restarted (no rebuild)
node e2e/stack.mjs restart-api                          # after an API code change (nest build + restart; --skip-build to only restart)
node e2e/stack.mjs rebuild-web                          # after a web code change
node e2e/stack.mjs status                               # pids, ports, /health/ready, web 200 (exit 3 if anything is down)
node e2e/stack.mjs down                                 # stop mysqld + API + preview of this run folder
```

`npm run test:e2e` only needs `E2E_RUN_DIR` (ports and base URL come from `<run>/stack.json`); the global setup fails fast when
the stack is not up. Before finishing: `node e2e/stack.mjs down` (Playwright closes its own Chromium).

Harness self-checks: `npm run typecheck:e2e` (tsc over e2e/ + playwright.config.ts), `npm run test:e2e-guard` (guard unit
tests, no processes). Vitest only collects `src/**` (vite.config.ts), so specs under `e2e/` never run under `npm test`.

### Parameters

| env / flag | meaning |
|---|---|
| `AINEX_API_TREE` / `--api-tree` | monorepo checkout the API is built and run from (required for up / reseed / restart-api; remembered in stack.json) |
| `E2E_RUN_DIR` / `--run-dir` | run folder (required everywhere) |
| `E2E_DB_PORT`, `E2E_API_PORT`, `E2E_WEB_PORT` / `--db-port`, `--api-port`, `--web-port` | ports (required for up; later commands read stack.json) |
| `--skip-build` | up / restart-api / rebuild-web: reuse the existing API `dist/` and `<run>/web-dist` |
| `E2E_API_<NAME>=value` | extra or overriding API env, e.g. `E2E_API_HLS_PLAYBACK=prefer`, `E2E_API_FEATURE_SIGNUP_WITHOUT_IDENTITY=true`, `E2E_API_RUBY_ROLLOUT_ENABLED=true` (guard-checked; takes effect on up / reseed / restart-api) |
| `E2E_API_LOG_LEVEL` | API log level (default `warn`; log in `<run>/logs/api.log`) |
| `E2E_CSP=off` | preview without the Content-Security-Policy headers (default on, production values) |
| `E2E_WORKERS` | Playwright workers, 1 (default) or 2 — the box is the production web server |

### Port and path rules (enforced by the guard)

- Only your own three ports. Refused: 3100 (live API), 3306, 33306, 3199, 4173; ports must be distinct.
- The run folder and every API state dir must resolve (symlinks followed) outside `/var/lib/ainex`, `/vod`, `/web`, `/opt`,
  `/etc`, `/var/www`; the seven state dirs must be inside the run folder. `DB_HOST` must be `127.0.0.1`, `TRAFFIC_MONITOR=false`.
- The API tree and the web tree may not be `/root/archive-new`, `/root/archive-new-ghweb`, the deploy checkouts or
  `/root/archive-parity/*` (the launcher builds into them).
- `down`/`stop` only signal processes whose environment carries `E2E_STACK_RUN_DIR=<run dir>`, so stacks of different run
  folders run side by side. Two stacks may share a web tree (each builds into its own run folder); two stacks sharing one API
  tree share its `dist/` (builds are serialised by a lock, but a rebuild changes the code under the other stack too).

### Run folder

```
<run>/stack.json            ports, base URL, DB credentials/socket, tree paths + HEADs, seededAt
<run>/db/                   datadir, my.cnf, mysqld.sock, mysqld.err
<run>/logs/                 mysqld.log, api.log, web.log
<run>/state/                API state dirs: traffic, media (MEDIA_DIR, /media), design (DESIGN_STORE_DIR), hls-state, contents-hls
                            (HLS_ROOT, /contents-hls), contents (HLS_CONTENTS_ROOT, /contents), upload (HRDE_UPLOAD_DIR, /upload)
<run>/web-dist/             SPA build (VITE_API_BASE='' → same-origin /v1)
<run>/playwright/           test-results (traces, failure screenshots), report/ (HTML), results.json
<run>/screenshots/<project>/<area>/<page>.png   one per page per viewport (checks.checkpoint)
<run>/api-rollout.env       copy of the rollout flags (SIGHUP reload reads it, never /etc/ainex)
```

The local API runs with `NODE_ENV=development`, `API_WRITE_MODE=full`, `DB_READ_ONLY=false`, all `FEATURE_*` gates on
(player writes, manager, admin, design studio, HLS queue), `COOKIE_SECURE=false` (http), dummy secrets (`DB_ENC_KEY=test-enc-key`,
JWT secrets, `JWT_SECRET_KEY`), no OpenAI/SMS/NICE keys. Behaviour switches keep their production values:
`FEATURE_SIGNUP_WITHOUT_IDENTITY=false`, `RUBY_/KOBE_ROLLOUT_ENABLED=false`, `HLS_PLAYBACK=off`, `CDN_MODE=off`,
`PLAYER_DAILY_CAP_ENFORCE=false`. DB user `ainex` / `ainex-test`, database `hrdeArchive`, utf8, KST.

## Fixture accounts

Every learner password is **`1111`** (Member.Pwd = SHA-256 hex). Staff (StaffInfo, MySQL `PASSWORD()`): **`admin01` / `admin1234`**
(Dept A, every grant, 2FA exempt via `ADMIN_2FA_EXEMPT_IDS`) and `sales01` / `admin1234` (Dept B; 2FA = `0000`, last 4 digits of
01088880000). Typed copies of everything below: `support/accounts.ts` (`ACCOUNTS`, `COURSES`, `COMPANY`, `PACKAGE`).

Companies: base `1234567890` 테스트기업 · **A** `2208800001` E2E 이투이물산 · **B** `2208800002` E2E 이투이테크 · **C** `2208800003`
E2E 타사상사. `e2emgr01` (company A) has MemberCompany rows A (Del N), B (Del N) and C (**Del Y** — must not count).

Login `next` → SPA path: terms → `/auth/first-terms`, password → `/auth/password-change`, assessment-grant → `/my/assessment`,
pre-assessment → `/assessment/pre`, classroom → `/my`, home → `/home` (verified against the API for every account below).

| ID | 이름 | 회사 | Study.Seq | login | state |
|---|---|---|---|---|---|
| `test01` | 테스트원 | base | 1 | classroom | base seed: TestID=Y, 사전 done for Study 1 (ARC2026) |
| `user01` | 학습자일 | base | 2 | pre-assessment | base seed: active Study 2, 사전 not done |
| `mgr01` | 담당자 | base | — | home | base seed: EduManager=Y for 1234567890 |
| `sleep01` | 휴면 | base | — | DORMANT 403 | base seed: Sleep=Y |
| `e2emgr01` | 강담당 | A | — | home | EduManager=Y; manages A + B (selector shows 2 companies); 수강생 관리 (2026) lists 14 enrollments (12 A + 2 B) from seed.sql — 15 with fixtures/manager.sql (+ `xmanager01`, B) — never C or base |
| `e2eterms01` | 문약관 | A | — | terms | Mandatory=N (PassChange Y) |
| `e2epw01` | 장비번 | A | — | password | PassChange=N |
| `e2eout01` | 서탈퇴 | A | — | WITHDRAWN 403 | MemberOut=Y → "탈퇴한 회원입니다." |
| `e2enouse01` | 노사용 | A | — | INVALID_CREDENTIALS 401 | UseYN=N → "아이디 또는 비밀번호를 잘못 입력했습니다." |
| `e2esleep01` | 휴면이 | A | — | DORMANT 403 | Sleep=Y → "현재 휴면계정 상태입니다. [휴면계정 복구] 메뉴를 통해 계정을 복구하세요." |
| `e2elearn01` | 김학습 | A | 9401 | home | 환급(A) active; **14h 59m = 53,940 s**; Study.Progress 99; 사전 done, 사후 not done; PassOK N; 1:1 문의 9901 (answered) + 9902 (waiting); 아카이빙 9951; 찜 E2EX01, E2EH01; review 9603 |
| `e2elearn15` | 오십오 | A | 9402 | home | 환급 active; **exactly 15h = 54,000 s**; Study.Progress 100; 사전 done, **사후 pending** (open, not answered); PassOK N |
| `e2epass01` | 이수료 | A | 9403 | home | term 9302 ended 30 days ago; StudyEnd Y; PassOK Y; 54,000 s; 사전 + 사후 + 만족도 done → 수료증 printable (LectureEnd+7 passed); review 9601; 아카이빙 9952 (answered) |
| `e2epass02` | 이대기 | A | 9404 | home | term 9306 ends in 3 days; PassOK Y; 54,000 s; 사후 done → 수료증 대기 until LectureEnd+7 |
| `e2eexp01` | 박만료 | A | 9405 | home | term 9303 ended 20 days ago, StudyEnd N; 18,000 s (5h); player → PERIOD_EXPIRED "수강기간이 종료되었습니다.\n문의 1811-9530" |
| `e2esoon01` | 최예정 | A | 9406 | home | term 9304 starts in 5 days; no progress, no 사전 (player currently answers PERIOD_EXPIRED as well — see notes) |
| `e2ewfree01` | 정비환급 | A | 9407 | home | **비환급 (Study.ServiceType W)** active, term 9305; 11,400 s (E2EX01 ch1 10,800 + E2EZ01 ch1 600); Study.Progress 21 |
| `e2epre01` | 한사전 | A | 9408 | pre-assessment | 환급 active, **사전 not done** → player PRE_ASSESSMENT_REQUIRED "현재 수강 차수의 사전역량진단을 먼저 완료해주세요." |
| `e2etest02` | 테스트이 | A | 9409 | classroom | **TestID=Y**, active, 사전 done, no progress, no certs (exempt from 본인인증 and the 8 h gate) |
| `e2egrant01` | 권진단 | A | 9410 | assessment-grant | active; 36,000 s (10h); AssessmentAccessGrant POST (ACTIVE, expires +7 d) |
| `e2enocert01` | 신입과 | A | 9411 | home | active, 사전 done, **no UserCertOTP** → player identity "과정입과 시 본인인증이 필요합니다.", no token, no media |
| `e2eauth01` | 윤인증 | A | 9412 | home | active, 1,800 s; only the 입과 cert (EvalCD 00) → "학습 진행 시 본인인증이 필요합니다." |
| `e2ebco01` | 배학습 | B | 9413 | home | company B, active, 7,200 s |
| `e2ebco02` | 배수료 | B | 9414 | home | company B, finished (term 9302), PassOK Y, 54,000 s; hidden review 9602 |
| `e2ecco01` | 차타사 | C | 9415 | home | company C (not visible to e2emgr01), active, 3,600 s; 1:1 문의 9903 (not visible to others) |
| `e2ecco02` | 차만료 | C | 9416 | home | company C, expired (term 9303), 5,400 s |

Every non-TestID learner with "daily" certs has UserCertOTP EvalCD 00 (입과, dated the term start) and EvalCD 01 dated **at seed
time** (today) — so the player opens without the identity gate: e2elearn01, e2elearn15, e2epass02, e2ewfree01, e2epre01,
e2egrant01, e2ebco01, e2ecco01. Only the 00 row: e2epass01, e2eexp01, e2eauth01, e2ebco02, e2ecco02. None: e2esoon01,
e2etest02 (exempt), e2enocert01. **Reseed after midnight** (the 01 rows are "today" only on the seed day).

## Data set (fixtures/seed.sql)

All dates are relative to `CURDATE()` at seed time; ids are 9xxx (base seed uses 1–2xxx).

**Package and contents.** Every e2e enrollment is on the base package **ARC2026** (Course idx 1, ctype A, ServiceType A — the
code the local EMON triggers fire for). Its `PackageLectureCode` is extended to
`D00001|D00002|E2EX01|E2EZ01|E2EY01|E2EH01|E2ER01`.

| LectureCode | idx | ctype | 과정명 | chapters (Chapter.Seq / Contents.idx / ContentsDetail.Seq, LectureTime) | media URL |
|---|---|---|---|---|---|
| E2EX01 | 9001 | X 이러닝 | [E2E] 데이터 리터러시 실무 | 1–4: 9201–9204 / 9101–9104 / 91011–91041, **240 min each** (cap 14,400 s) | `https://www.hrdeedu.co.kr/contents/E2E/X01/0N.mp4` (absolute form) |
| E2EZ01 | 9002 | Z 마이크로러닝 | [E2E] 5분 보고서 작성법 | 1–2: 9211–9212 / 9111–9112 / 91111, 91121, 10 min | `E2E/Z01/0N.mp4` (relative form) |
| E2EY01 | 9003 | Y 숏폼 | [E2E] 1분 엑셀 단축키 | 1: 9221 / 9121 / 91211, 3 min | `/contents/E2E/Y01/01.mp4` |
| E2EH01 | 9004 | X | [E2E] 패키지형 HTML 차시 체험 | 1: 9231 / 9131 / 91311, 20 min, **ContentsType A** | `/contents/E2E/H01/001/01/index.html` |
| E2ER01 | 9005 | R 라이브 | [E2E] 라이브 특강: 생성형 AI 업무 활용 | 1: 9241 / 9141 / 91411, 60 min | `E2E/R01/01.mp4` |
| E2EX02 | 9006 | X | [E2E] AI 프롬프트 기초 (패키지 미포함) | 1: 9251 / 9151 / 91511, 30 min — **not in ARC2026** | `E2E/X02/01.mp4` |
| E2EXDEL | 9007 | X | [E2E] 삭제된 과정 | Del=Y (never listed) | — |
| E2EXOFF | 9008 | X | [E2E] 비노출 과정 | UseYN=N (never listed) | — |
| D00001, D00002 | 2, 3 | X, Y | base seed contents (now playable locally) | base chapters 1001/1002, 2001 | `/contents/D00001/0N.mp4`, `/contents/D00002/01.mp4` |

Course extras: Category1/2 → CourseCategory 9010 공통역량 (9011 커뮤니케이션, 9012 자기계발), 9020 직무역량 (9021 데이터·디지털,
9022 사무자동화), 9030 리더십 (9031 조직관리, 9039 UseYN N); Keyword2 → ContentsKeyword 9051–9053; Keyword3/4 → ArchiveQuestion
9004–9008 labels; PreviewImage `upload/Course/e2e_*.jpg`; Professor, Intro, EduTarget, EduGoal, view counts (E2EY01 300,
E2EX01 120, E2EZ01 80, …). Visible catalog children: 7 (`GET /v1/catalog/stats` → courses 7, categories 5, keywords 3).

**Terms (LectureTerme, all ARC2026):** 9301 active (−20 … +70 d) · 9302 finished (−120 … −30) · 9303 expired (−110 … −20) ·
9304 not started (+5 … +95) · 9305 비환급 W active (−15 … +75) · 9306 ending (−87 … +3).
Study rows: Price/rPrice/rPrice2 = 300,000/270,000/30,000 (환급) or 100,000/0/100,000 (W), SalesID sales01, StudyKey `<term>_<ID>`.

**Study time.** One Progress row per studied chapter (StudyTime ≤ min(LectureTime×60, 14,400), Progress % = floor(StudyTime /
CompleteTime × 100)) and two ProgressLog rows (Start 0 → final), all on **past days** (today's 8-hour count starts at 0).
Completed chapters' newest `PositionSec` is 85, unfinished ones 30 (the MP4 is 90 s long). Study.Progress =
max(1, floor(Σ / 54,000 × 100)). The local EMON trigger wrote the matching TB_SCORE_HIST_V2 rows.

**Assessment.** ArchiveQuestion additions: B·step01·A options (9001–9003 col2 직무, 9004–9006 col3 관심분야, 9007–9008 col4 역량),
관리자(M) step03 (9011–9012 사전, 9021–9022 사후), 아카이브 향상도 A·step01·A (9031–9033). The base B·step02 C/L set (1–3) and
step03 W (4) are unchanged (so test01 stays complete). 사전 done = ArchiveAbilityResult1 (col1 W, col2 9001, col3 9004,9006,
col4 9007) + answers to 1, 2, 3, 4 for that Study_Seq. 사후 done = answers to 11–14 (총합 사후 ≥ 1) + 9031–9033.

**Support / CMS.**
- Reviews: 9601 E2EX01 ★5 e2epass01 (visible) · 9602 E2EX01 ★2 e2ebco02 **UseYN N (hidden)** · 9603 E2EZ01 ★4 e2elearn01 · 9604 E2EY01 ★1 **Del Y**.
- Notice: 9701 pinned "[E2E] 학습 이용 안내" with attachment (`upload/Notice/e2e_notice_guide.pdf`, download name `E2E_학습안내서.pdf`) · 9702 normal · 9703 UseYN N · 9704 Del Y (plus base 1 pinned, 2).
- FAQ: 9721–9724 categories A–D, 9725 UseYN N (plus base 1).
- 학습자료실 (StudyPDS): 9741 A with `e2e_pds_workbook.pdf` → `E2E_보고서_워크북.pdf` · 9742 B with `e2e_pds_checklist.txt` → `E2E_체크리스트.txt` · 9743 pinned C without file · 9744 UseYN N.
- Popups: **9801 active until +30 d** (image `upload/upload_popup/e2e_popup.png`, 392×403 at 200/50, link area → `/catalog`) · 9802 expired yesterday. 9801 opens on every public page except /auth/login — `hidePopups(page)` before navigating, or `dismissPopups(page)`.
- 1:1 문의 (Counsel): 9901 e2elearn01 A 학습 내용 문의, Status B, staff answer by 운영자, attachment `upload/Counsel/e2e_counsel_capture.pdf` → `화면캡처.pdf`, LectureCode E2EX01 / Study 9401 / Contents 9103 · 9902 e2elearn01 B, Status A (waiting) · 9903 e2ecco01 D (another learner's).
- 아카이빙: 9951 e2elearn01 Status A with `upload/Archiving/e2e_archiving_note.pdf` → `적용사례.pdf` · 9952 e2epass01 Status B answered.
- Upload folders created empty: Course, Notice, StudyPDS, Counsel, Archiving, upload_popup, webedit (writable by the API).

## Media (fixtures/media)

- `lesson.mp4` — 90 s, 320×180 H.264 baseline + AAC mono 16 kb/s (ffmpeg `testsrc` with a seconds counter + 440 Hz tone, made
  with `/opt/ainex-tools/ffmpeg/ffmpeg`, faststart). `manifest.json` copies it (reflink) to every lesson path above, incl.
  `contents/E2E/H01/001/0N/video/01.mp4`. The Playwright Chromium (Chrome for Testing 151) plays H.264/AAC.
- Packaged lesson `contents/E2E/H01/001/` laid out like the live packages: section pages `01/index.html`, `02/index.html`
  (`<lesson>/<NN>/index.html` + `main.js` + `video/*.mp4`), shared `common/package.css|js`. The page sets its `<source>` at run
  time, shows the playhead in `.time1 .playerText` (mm:ss), has `._nextBtn` (01 → 02), `completeStudy()` on `ended`,
  `contentsData.menus` + `currentPageNo` + `gotoMenu(n)`, and buttons that call `parent.PlayStudyInfo('E2EH01', 9131)` (학습요점)
  and `parent.PlayStudyCounsel('E2EH01', 9131)` (질문하기).
- `upload/Course/e2e_{x01,z01,y01,h01,r01,x02}.jpg` thumbnails, `upload/upload_popup/e2e_popup.png`, one-page PDFs for Notice /
  StudyPDS / Counsel / Archiving, `upload/StudyPDS/e2e_pds_checklist.txt`.

Served exactly like production's Apache aliases: real files only (missing → 404, never the SPA), single byte ranges (206),
`/upload` + `/media` with `Content-Security-Policy: default-src 'none'; sandbox`, `/contents` with the package CSP, the SPA with
the production CSP (connect-src/form-action `'self'`, no upgrade-insecure-requests). `.php` etc. → 403.

## Writing a spec

```ts
// e2e/support-center/notice.spec.ts  (the same check runs in smoke.spec.ts)
import { test, expect, hidePopups } from '../support/test';
import { openAs } from '../support/login';

test.use({ area: 'support' });                                 // screenshots → <run>/screenshots/<project>/support/

test('공지 첨부: original file name, counted view', async ({ page, checks, db }) => {
  const views = await db.scalar<number>('SELECT ViewCount FROM Notice WHERE idx = 9701');
  await hidePopups(page);                                       // or test the popup itself
  await openAs(page, 'e2elearn01', '/support/notice/9701');     // API login (refresh cookie) + navigation; page.goto() for a guest
  await expect(page.getByText('[E2E] 학습 이용 안내')).toBeVisible();
  await checks.checkpoint('notice-detail');                     // network idle + no horizontal overflow + screenshot
  const dl = page.waitForEvent('download');
  await page.getByRole('link', { name: 'E2E_학습안내서.pdf' }).click();
  expect((await dl).suggestedFilename()).toBe('E2E_학습안내서.pdf');
  expect(await db.scalar<number>('SELECT ViewCount FROM Notice WHERE idx = 9701')).toBeGreaterThan(views!);
});
```

- Import `test`/`expect` from `support/test.ts`, never from `@playwright/test` directly — it adds `checks` (auto: console errors,
  page errors, failed requests and HTTP ≥ 400 on same-origin URLs fail the test at the end; `checks.allow(/url/, status)` for a
  failure the scenario expects), `db`, `clientIp`, the per-test `X-Forwarded-For`, and the external-request block
  (`checks.external` lists what was blocked, e.g. a legacy hrdeedu.co.kr link or the mOTP popup URL).
- `checks.checkpoint(name)` once per page state per viewport. It asserts `scrollWidth ≤ innerWidth` and lists the offending
  elements on failure. `checks.screenshot(name)` takes only the picture; `checks.assertNoHorizontalOverflow()` only the check.
- Login: `loginViaUi(page, id)` when login is under test (asserts the routed path from `ACCOUNTS[id].next`), `openAs(page, id, path)`
  / `loginViaApi(page, id)` otherwise; staff: `loginStaffViaApi(page)`. Both write LoginHistory/LoginIng like the real login.
- DB: `db.query/one/scalar/exec`, `db.aesDec('Mobile')` for AES columns; helpers `clearPlayLock(id)`, `ageLastProgressLog(id, s)`
  (makes the next tick see wallΔ = s, like the API integration tests), `studySeconds(seq)`, `progressRows(...)`,
  `progressLogCount(...)`. Prepare state in the DB, never change schema.
- Files go under `e2e/<area>/*.spec.ts` — the 고객지원 area uses **`e2e/support-center/`** because `e2e/support/` holds the
  helpers. Extra rows go in **`e2e/fixtures/<area>.sql`** (loaded after seed.sql on up / reseed;
  do not edit seed.sql, other agents rely on it). Use ids in your area's block — auth 20000–20999, catalog 21000–21999,
  player 22000–22999, assessment 23000–23999, myroom 24000–24999, manager 25000–25999, support 26000–26999 — and learner IDs
  starting with `x<area>` (e.g. `xplayer01`). Extra media: add files under `fixtures/media/` (+ `manifest.json` copies).
- Specs must be re-runnable on a used DB (both projects run against the same data, desktop first): prepare what you need
  (`clearPlayLock`, delete your own rows), assert relative counts, or `node e2e/stack.mjs reseed` before the run. A test that
  needs a pristine DB says so in its title and the area README.
- Downloads: `page.waitForEvent('download')`, check `suggestedFilename()` and save under `downloadRoot()` (support/stack.ts) if
  you need the bytes. Animations: `test.use({ contextOptions: { reducedMotion: 'reduce' } })` if count-ups make a screenshot ambiguous.

## Known limitations and gotchas

- **Closing a tab drops keepalive requests.** With the browser-wide request blocking on, Playwright loses most `fetch(…, { keepalive: true })` /
  `sendBeacon` calls a closing page sends (2 of 8 PlayLock releases arrived). Navigate the tab away first (same `pagehide` path a real
  close takes), then close it — see `e2e/player/` for the pattern.

- **Single session (LoginIng):** logging in as the same learner elsewhere (another test, a curl) ends the earlier session; the
  next poll/refresh of the old page answers OTHER_SESSION. Run one browser per learner at a time.
- **PlayLock (90 s):** a player window that was not closed via pagehide keeps the lock; call `clearPlayLock(id)` before
  opening the player (or navigate away at the end of the test, which releases it).
- **Throttling:** the API allows 120 requests/min per client IP and 10 logins/min per (IP, id). The `test` fixture gives every
  test its own `X-Forwarded-For`; curl/`page.request` calls outside a test share 127.0.0.1.
- **Blocked providers** (common brief): NICE / mOTP identity (the player shows the legacy popup link, blocked by the harness),
  SMS / 알림톡 / mail (`SEND_NOT_CONFIGURED`), MongoDB HrdeLive, OpenAI (fallback texts). Test the documented fallback.
- **본인인증 01 rows are dated at seed time** — reseed after midnight. The 8-hour gate counts today's ProgressLog only.
- **HLS:** `HLS_PLAYBACK=off`; no encoded renditions are shipped and the encode worker is not started. To test HLS delivery,
  put a published version under `<run>/state/contents-hls` and run with `E2E_API_HLS_PLAYBACK=prefer`.
- **No PHP site:** legacy links (hrdeedu.co.kr, mOTP popup, 법정교육) are never loaded — assert the URL, not the page.
- **Resolver observations (not asserted by the harness):** opening E2EX02 (not in ARC2026) with `studySeq` answers
  PERIOD_EXPIRED (the enrollment's StudyLectureCode historical match), without `studySeq` NO_ACCESS; the not-yet-started
  e2esoon01 also answers PERIOD_EXPIRED "수강기간이 종료되었습니다." — the player area decides whether that matches PHP.
- Same-origin API: production serves the API from api.timeless.uz; here `/v1` is proxied by the preview, so CORS and the
  cross-site cookie (`SameSite=None; Secure`) are not exercised (COOKIE_SECURE=false, SameSite=Lax).
- Base seed accounts (`test01`, `user01`, …) are shared with the API integration tests' data model; their enrollments see the
  extended ARC2026 package here.
