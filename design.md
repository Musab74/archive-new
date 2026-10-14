# AINEX Archive — design system

This document describes the UI system **as implemented** in `apps/web` and `packages/contracts`. Keep it in sync when
tokens, shared components or layout rules change.

## 1. Principles

- **One system, many tenants.** Colour, type, radius and container come from the published `DesignConfig`
  (white-label). Components never hard-code tenant colours; they read CSS custom properties.
- **Restraint over decoration.** One accent per surface, colour carries meaning (category, state), motion confirms an
  action or reveals content once — nothing loops.
- **Variety in composition, not in parts.** Sections differ in layout (editorial split, numbered rows, card grid, dark
  demo, timeline, contained panel) but share the same buttons, tiles, chips and cards.
- **Accessible by default.** WCAG AA text contrast, visible focus, keyboard-complete controls, `prefers-reduced-motion`.

## 2. Token architecture (`apps/web/src/shared/styles/tokens.css`)

| Layer | What | Who writes it |
| --- | --- | --- |
| 1 · Runtime brand tokens | `--c-*`, `--g-*`, `--font-*`, `--fs-base`, `--lh-body`, `--fw-*`, `--r-sm/md/lg`, `--container` | `DesignProvider` / `public/boot.js` from the published `DesignConfig` (`shared/design/tokens.ts`). Static values in `tokens.css` = `DEFAULT_DESIGN`. |
| 2 · Derived tokens | `--c-primary-tint`, `--c-primary-ink`, `--c-accent-ink`, `--c-warm-*`, `--c-ink-hover`, `--c-primary-hover`, `--c-scrim`, `--c-glass`, `--c-hover`, `--c-skeleton` … | `color-mix()` of layer 1 — follow any preset automatically. |
| 3 · System tokens | category palette, type scale, spacing, elevation, motion, z-index | Static, tenant-neutral. |

An administrator changes the theme in **Design Studio → 프리셋 / 토큰 → 게시**. The SPA picks the new config up from
`GET /v1/public/design` on the next load; no rebuild or restart.

### 2.1 Brand tokens — `ainex-blue` preset (current `DEFAULT_DESIGN`)

Brand palette: **#091540** deep navy · **#1b2cc1** royal blue · **#7692ff** cornflower · **#abd2fa** sky.

| DesignConfig key | CSS var | Value | Use |
| --- | --- | --- | --- |
| `ink` / `primaryDeep` | `--c-ink` / `--c-primary-deep` | `#091540` deep navy | headings, dark buttons, announcement bar, dark bands |
| `primary` | `--c-primary` | `#1b2cc1` royal blue | primary buttons, active states, focus ring, links |
| `accent` | `--c-accent` | `#7692ff` cornflower | highlights, underline, gradients, tints — **never under white text** (2.9:1) |
| — | `--c-sky` | `#abd2fa` sky | light fills on dark (always with navy text, 11.2:1) |
| `accentWarm` | `--c-accent-warm` | `#c9472f` coral | 공지 tag only |
| `text` / `muted` | `--c-text` / `--c-muted` | `#2b3553` / `#5d6888` | body / secondary text |
| `line` / `lineSoft` | `--c-line` / `--c-line-2` | `#d9e2f2` / `#e8eef9` | borders / hairlines |
| `surface` | `--c-paper` | `#ffffff` | cards, panels, header |
| `background` | `--c-bg` | `#f7f9fe` | page |
| `surfaceSoft`, `headingBand` | `--c-soft`, `--c-heading-band` | `#eef3fd`, `#e6eefc` | quiet fills, page-heading bands |

Contrast (checked by `validateDesignContrast` and `src/test/presets.test.ts`): text/background 11.5:1, muted/background
5.2:1, white/primary 9.7:1, white/navy 17.6:1, white/coral 4.7:1, navy/cornflower 6.1:1. The preset passes the publish
gate with no warnings. Other presets: `ainex-premium` (previous default), `editorial-warm`, storyboard variants.
Earlier system defaults stay exported verbatim (`LEGACY_DEFAULT_DESIGN_V1`, `LEGACY_EDITORIAL_DEFAULT_DESIGN_V2/V3`,
`LEGACY_PREMIUM_DEFAULT_DESIGN_V4`) so already-published designs keep parsing and the API can recognise untouched defaults.

**Going live:** the learner site shows the design *published* in Design Studio. Apply **AINEX Blue** in
Design Studio → 프리셋 and publish to switch the public site (no rebuild).

### 2.2 System tokens

- **Category palette** (`--cat-*`): `blue` (= primary) · `teal #0f8f83` · `violet #7148d4` · `indigo #4f56d6` ·
  `cyan #0e8fb0` · `coral #d9533b` · `amber #b26a00` · `emerald #0a8a5f` · `navy` (= ink). Each glyph keeps ≥ 3:1 against
  its own 11 % tint. Rating star: `--c-star`, `--c-star-fill`.
- **Type scale**: `--fs-display` clamp(42–68px) · `--fs-h1` clamp(30–44) · `--fs-h2` clamp(26–38) · `--fs-h3` ·
  `--fs-lead` clamp(16–18) · `--fs-sm 14` · `--fs-xs 13` · `--fs-2xs 12`; `--lh-tight 1.14`, `--lh-snug 1.32`,
  `--ls-tight -.04em`, `--ls-label .12em` (uppercase labels only).
- **Spacing**: 4 px grid `--sp-1 … --sp-24`; `--section-y` clamp(64–112px) vertical rhythm; `--section-x` 40/32/20/16 px
  gutter; `--header-h` 72 (60 on phones); `--announce-h` 36.
- **Elevation**: `--shadow-xs`, `--shadow-card`, `--shadow-hover`, `--shadow-pop`, `--shadow-panel`; focus `--ring`.
- **Radius**: `--r-sm 8` (controls, buttons) · `--r-md 12` (cards, tiles) · `--r-lg 20` (panels) · `--r-pill`.

## 3. Typography

Pretendard (self-hosted, `public/fonts`) with Noto Sans KR / Malgun Gothic fallbacks. `word-break: keep-all` keeps Korean
words intact; headings use `text-wrap: balance`, paragraphs `pretty`. Weights: headings 700 (display 800), labels 600,
body 400 — avoid bolding running text. Uppercase + letter-spacing is reserved for small English labels (`.eyebrow`).

## 4. Icons

- One family: **Lucide** behind `shared/ui/Icon.tsx` (`<Icon name="…" />`). Components use semantic names only
  (`search`, `briefcase`, `target`, `users`, `sparkles`, `broadcast`, `route`, `monitor`, `bolt`, `shorts`, `sort`,
  `sliders`, …), 1.75 px stroke, `currentColor`. `play` renders filled.
- **`IconTile`** (`shared/ui/IconTile.tsx`): tinted container (`tone`, `size sm|md|lg`, `solid`). Decorative — always
  next to a visible label.

| Area | Icon | Tone |
| --- | --- | --- |
| ARCHIVE | `library` | navy |
| 공통역량 | `briefcase` | blue |
| 직무역량 | `target` | teal |
| 리더십역량 | `users` | violet |
| AI ZONE | `sparkles` | indigo |
| LIVE CLASS / 라이브 | `broadcast` | coral |
| 진단·로드맵 | `route` | amber |
| 고객지원 | `headset` | amber |
| 이러닝 / 마이크로러닝 / 숏폼 | `monitor` / `bolt` / `shorts` | blue / teal / coral |

## 5. Components (`apps/web/src/shared/ui`)

| Component | Variants / notes |
| --- | --- |
| `Button` | `primary` (blue) · `secondary` (white, hairline) · `pill-dark` (navy) · `white` / `ghost` (on dark) · `accent` (coral) · `text`; sizes `xs sm md lg`; `iconRight` nudges 3 px on hover; external links get an ↗ icon + "(새 창)". |
| `IconButton` | 42 px circle, `plain` for header utilities; always `label`. |
| **`AppSelect`** | The only select. Radix Select (combobox + listbox): typeahead, arrows/Home/End, Escape, focus return, collision-aware popper. Props mirror a controlled select: `value`, `onValueChange`, `options`, `placeholder`, `size sm|md`, `tone default|dark|quiet`, `icon`, `prefix`, `loading`, `emptyText`, `invalid`, `disabled`, `portal` (set `false` inside fullscreen elements). `""` works as a real option value. |
| `Form.Select` / admin `ASelect` | Thin wrappers over `AppSelect`; `placeholder` becomes a selectable `""` first option (old native behaviour). `ASelect` keeps the `onChange(e)` shape for admin forms. |
| `SearchField` | Search form: icon, input, clear button (once text exists), spinner (`loading`), submit (text or icon). |
| `Pill` | Toggle (`aria-pressed`); selected = tinted primary + check that slides in; `soft` = navy fill. |
| `Chip` | Removable selected-filter chip. |
| `TypeLabel`, `Tag` | Pill-shaped badges (`navy mint warm ink gray coral coral-soft`). |
| `Tabs` | Underline tabs, indicator glides between tabs (framer `layoutId`). |
| `PillTabs` | Segmented control (`role=group`, `aria-pressed`) with a sliding thumb. |
| `ContentCard` | 16:9 media (real thumbnail or a type-tinted tile), type + duration badges, category line, 2-line title, ★ rating · views; hover lifts 3 px, scales the image 4.5 %, reveals play + arrow. Skeleton shimmer. |
| `FilterSidebar` / `FilterSheet` | Card with 필터 head + 초기화; competency rows (radio-like, `IconTile`), field list (checkbox-like, counts), type pills. ≤ 900 px: trigger button + bottom sheet with 초기화/적용. |
| `Section`, `Breadcrumb`, `Pagination`, `Modal`/`Sheet`, `StateBlock` | Token-only refresh (radius, focus, tints). |

**Native selects:** none remain in the SPA. Converted sites — catalog sort, `Form.Select` (assessment profile, AI ZONE
generator, roadmap, 1:1 counsel, 찜/기업교육 filters), manager company picker, admin `ASelect` (19 uses), player speed
(`portal={false}`, `tone="dark"`).

## 6. Navbar

1. **Announcement bar** (navy, 36 px, scrolls away): latest 공지 → `/support/notice/:id`, 공지사항 전체, dismiss (per
   session). Hidden when there is no notice.
2. **Sticky header** (72 px): brand · primary nav (ARCHIVE, 공통/직무/리더십역량, AI ZONE, 라이브, 고객지원) · search ·
   로그인 / member · CTA (수강신청 → `/support/inquiry/new`; signed in: 나의 학습실 → `/my`) · 전체메뉴.
   Frosted glass background; soft shadow once scrolled; transparent over the home hero (`useHeaderOverlay`).
   Hover underline grows from the centre; the active indicator glides between items.
3. **Panels** (desktop): mega menu (nav with icon tiles + 4 link groups + account row) and search (large `SearchField`,
   recent searches, quick links). Both drop 8 px + fade, trap focus, close on Escape/scrim.
4. **Drawer** (≤ 1024 px): slide-in from the right; brand + close, account card, nav as icon rows (staggered entrance),
   menu groups as accordions, sticky CTA footer. Focus trap + body scroll lock.

Breakpoints: ≤ 1240 compact spacing · ≤ 1100 hides member name · ≤ 1024 nav → drawer · ≤ 768 hides 로그인 text link ·
≤ 380 hides the CTA (it stays in the drawer).

## 7. Home page

Order and visibility come from `layout.homeSections` (Design Studio → 레이아웃). Default sequence:

| Key | Composition |
| --- | --- |
| `hero` | Asymmetric: eyebrow, headline (last phrase with a drawn cyan underline), lead, CTAs, live stats strip (`/catalog/stats`). Right: learning-discovery panel — search + area rows + preview pane that follows hover/focus. |
| `intro` | Statement left (sticky), numbered value rows right. |
| `contentTabs` | Segmented 전체/인기/최신/AI 추천 over a 4-col card grid (phones: snap rail). |
| `aiZone` | Navy band: copy + 4 AI directions; a labelled example of the AI 로드맵 생성기. |
| `journey` | Four-step timeline (진단 → 로드맵 → 학습 → 사후진단·보고서), rail draws in once. |
| `ctaBand` | Contained navy panel with 수강신청, phone and link columns. |

Storyboard sections (`operatingTypes`, `featured`, `competencyBrowse`, `axis`, `consulting`, `faq`) remain available.
Only real platform data and features are shown — no invented statistics, testimonials or customers.

## 8. Catalog

Heading band (breadcrumb, title, lead, large `SearchField` with clear + loading) → sidebar filters + results. Results
header: label + count (`aria-live`), mobile filter trigger, sort `AppSelect` (정렬 | 운영 편성순 / 인기순 / 평점순 / 제목순,
+ 관련도순 while searching). Applied filters as chips with 초기화. Grid 3 → 2 (≤ 1150) → 2 (≤ 768) → 1 (≤ 560).

## 9. Animation standards

| Interaction | Duration | Easing |
| --- | --- | --- |
| Buttons, links, hovers | 160 ms (`--dur-fast`) | `--ease-out` |
| Dropdowns / selects | 220 ms open (`--dur-base`) | `--ease-emph` |
| Cards, tiles | 220–320 ms (`--dur-slow`) | `--ease-emph` |
| Panels, drawer | 220–300 ms | `[0.16, 1, 0.3, 1]` |
| Section reveals | 350–600 ms, 60 ms stagger, once | `useReveal` |
| Nav / tab indicators | spring (stiffness ≈ 500) | framer `layoutId` |

Animate `transform` and `opacity` only. No continuous loops (the demo caret blinks 4× then stops). With
`prefers-reduced-motion`, entrances become fades, indicators jump, hovers do not move, count-ups show final values.
Never animate assessment, player or other task-critical flows.

## 10. Layout and responsive rules

- Container `--container` (1200) with `--section-x` gutters; full-bleed bands use `.band` / `.bleed` + `.bleed-inner`.
- Required checks: 360 · 390 · 768 · 1024 · 1440 · 1920 px, no horizontal overflow.
- Touch targets ≥ 40 px (44 px in the drawer and sheet). Inputs are 16 px on phones (no iOS zoom).
- Sections alternate surface (`--c-paper` / `--c-bg` / navy) instead of repeating one layout.

## 11. Admin console (`/admin`)

- **Console theme** (`shared/styles/console.css`): while any `/admin` route is mounted, `AdminRoot` sets
  `data-console="admin"` on `<html>` and the console always uses the AINEX Blue palette, whatever the learner site has
  published (operators get one consistent tool; tenant branding stays on learner pages and in Design Studio previews,
  which set their own inline variables). Leaving `/admin` removes the attribute.
- **Type and sizing:** 15 px base, page title 26 px, card title 16.5 px, table 14.5 px (headers 13 px), labels 13–14 px,
  controls 40 px (sm 34, xs 30), nav rows 44 px, table rows ≈ 48 px.
- **Shell:** navy gradient sidebar (`--console-side*`) with an icon per group and item (icons live in
  `shared/auth/adminMenu.ts`), royal-blue active pill, collapsible to a 76 px icon rail (tooltips via `title`), ≤ 900 px
  slide-in with scrim. Top bar: breadcrumb with home icon, 사이트 보기, session timer chip with 연장, staff avatar, logout.
- **Kit** (`shared/ui/admin`): `AdminPage` shows the page's menu icon automatically (or `icon`), `Card icon`,
  `Kpi icon/iconTone` (tinted `IconTile`, warn tiles get a red edge), `AButton icon`, `Callout` icons, filter bar
  검색/초기화 icons, `DataTable` sort/pager icons and empty/error state icons, token-only badges and tabs.
- **Login:** navy → royal-blue gradient with a faint grid, white card, shield mark.

## 12. Rules

- Use tokens; never hard-code tenant colours. Dark-surface overlays may use `rgba(255,255,255,…)`.
- Never put white text on the cornflower accent; light brand tones carry navy text.
- Use `AppSelect` (or `Form.Select` / `ASelect`) — never a native `<select>`.
- Use `Icon` / `IconTile` — no emoji or mixed icon sets.
- Keep separation: layout (CSS modules) · tokens (`tokens.css`, `DesignConfig`) · branding assets (Design Studio
  media) · content (`shared/strings/ko.ts`) · business logic (features + API).
