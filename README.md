# AINEX Archive — web frontend

React 19 + Vite SPA for the AINEX Archive learning service (https://timeless.uz), plus the shared
`@ainex/contracts` package (zod schemas, design tokens and presets) it is built against.

```
apps/web/             the SPA (learner, 기업 교육담당자, admin Design Studio)
  src/features/       pages by area (home, catalog, content, aizone, my, manager, admin, …)
  src/features/home/editorial/   the 2026-10 home hero (orbit ring, card deck, stats) and old-site sections
  src/shared/ui/      design-system components (Button, Pill, Header, Footer, ContentCard, …)
  src/shared/design/  DesignConfig → CSS custom properties (tokens) applied on :root
  src/shared/styles/  tokens.css, typography, layout, utilities
packages/contracts/   API response schemas, DesignConfig schema, theme presets, home section keys
```

## Run

```bash
npm ci
npm run dev              # builds contracts, then Vite dev server on http://localhost:5173
                         # /v1 is proxied to an API on http://127.0.0.1:3100 (see apps/web/vite.config.ts)
npm run test             # vitest (jsdom)
npm run build            # production bundle in apps/web/dist (VITE_API_BASE from apps/web/.env.production)
```

The backend (NestJS API) is not part of this repository; the SPA talks to it under `/v1`.
Design: colours, fonts and layout come from the published DesignConfig (`GET /v1/public/design`);
`DEFAULT_DESIGN` in `packages/contracts` is the fallback and the current default is the
`editorial-warm` preset with the `visual-right` (orbit) hero.

Styling conventions (`apps/web/src/shared/styles`):

- `tokens.css` holds the same values as `DEFAULT_DESIGN` plus *derived* tokens (`--c-accent-tint`, `--c-warm-ink`,
  `--c-scrim`, ink-tinted shadows, …) mixed from the runtime tokens. Use those instead of hard-coded hex tints so
  every preset published from the Design Studio stays coherent.
- Coloured page bands are full-bleed: add the global `band` class (or use `<Section>`, which already does) and give
  the element vertical padding only. Header, page content and footer share one gutter (`--section-x`), so their
  left edges line up.
