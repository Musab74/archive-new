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

## CI/CD

`.github/workflows/ci-cd.yml` runs on every push and pull request to `develop`:

1. **ci** — `npm ci`, typecheck, vitest, production build (`VITE_API_BASE=https://api.timeless.uz`), uploads
   `web-dist-<sha>` as an artifact.
2. **deploy** (pushes to `develop` only, GitHub environment `production`) — streams the built `dist` over SSH to the
   server's `ghdeploy` user, whose key is locked to one forced command (`ainex-release-web`). That command unpacks
   into `/var/www/timeless/releases/<ts>-gh`, validates the SPA shell, switches the `current` symlink atomically,
   checks https://timeless.uz/ and rolls back if the check fails, then keeps the last 5 releases.

Repository secret: `AINEX_ARCHIVE` (the ghdeploy private key). The server host key, host, port and user are public and
live in the workflow itself. The API is deployed separately from the
platform monorepo.
