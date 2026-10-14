# AINEX Archive — web frontend

React 19 + Vite SPA for the AINEX Archive learning service (https://timeless.uz), plus the shared
`@ainex/contracts` package (zod schemas, design tokens and presets) it is built against.

```
apps/web/             the SPA (learner, 기업 교육담당자, admin Design Studio)
  src/features/       pages by area (home, catalog, content, aizone, my, manager, admin, …)
  src/features/home/editorial/   home hero (discovery panel) + intro, content tabs, journey, CTA sections
  src/shared/ui/      design-system components (Button, AppSelect, SearchField, IconTile, Header, Footer, ContentCard, …)
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
`ainex-premium` preset with the `visual-right` (editorial) hero. Tokens, components, motion and responsive rules are
documented in [`design.md`](design.md).

## CI/CD

`.github/workflows/ci-cd.yml` runs on every push and pull request to `develop`:

1. **ci** — `npm ci`, typecheck, vitest, production build (`VITE_API_BASE=https://api.timeless.uz`), uploads
   `web-dist-<sha>` as an artifact.
2. **publish** (pushes to `develop` only, GitHub environment `production`) — publishes the built site as one commit on
   the orphan branch `deploy/develop` (with a `BUILD_SOURCE` stamp). The web server polls that public branch every
   minute (`ainex-pull-deploy.timer`) and releases new builds locally through `ainex-release-web`: unpack into
   `/var/www/timeless/releases/<ts>-gh`, validate the SPA shell, atomic `current` switch, public check with rollback,
   keep the last 5. The job then waits until https://timeless.uz/BUILD_SOURCE reports the new commit.

No inbound connection to the server and no secrets are needed (the repository is public and only fetched).
The API is deployed separately from the platform monorepo.

Pipeline verified end to end on 2026-10-13.
