# Atlas — Project Instructions

Atlas is an AI-native talent discovery platform for the creative industry (dancers, actors, content creators). This build is an **investor demo**: it must run live on a real URL and never fail the rehearsed walkthrough. Optimise for a convincing demo, not scale. Full spec: `atlas-prd.md`.

## Stack

- **Next.js 16 (App Router)** + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui (`base-nova` style)
- **Supabase**: Postgres + auth + storage + **pgvector** (embeddings live next to profile data)
- **OpenAI**: `text-embedding-3-small` for embeddings, GPT-4o-mini-class model for query parsing and outreach generation
- **Vercel** hosting, PostHog analytics (optional), Playwright + Vitest + pgTAP for tests

## Commands

- Dev server: `npm run dev` (demo login button auto-enabled in dev)
- **Validate a change:** `npm run lint && npm run typecheck && npm test`
- Unit tests (mocked, fast): `npm test` — colocated `*.test.ts` files in `src/lib/`
- Integration (real local Supabase, Docker): `supabase start`, then `set -a; eval "$(supabase status -o env)"; set +a`, then `npm run test:integration`
- E2E: `npm run test:e2e` (Playwright, needs a production build against the local stack — see README)
- DB policy tests: `supabase test db` (pgTAP, `supabase/tests/`)
- Seed data: `npm run seed` · Embeddings: `npm run embed`

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build, `npm audit` (high severity blocks), pgTAP, RLS integration tests, client-bundle secret check, and Playwright.

## Architecture

### Entry points
- `src/app/layout.tsx` — root layout; route groups: `(auth)` login/signup, `(app)` authenticated app with `(hirer)` and `(talent)` role subgroups, `(admin)` platform admin, `(legal)`
- `src/proxy.ts` — Next.js 16 proxy (replaces middleware); Supabase session refresh + route protection
- `src/instrumentation.ts` — validates required env vars at startup, fails by name
- `src/app/api/*` — route handlers (search, jobs, outreach, messages, admin, uploads, …); server actions in `src/app/actions`

### Key modules
- `src/lib/` — domain logic, one file per concern with a colocated `.test.ts` (e.g. `matching.ts`, `agent-search.ts`, `access.ts`/`access-core.ts`, `platform-admin.ts`, `inbox.ts`, `user-deletion.ts`)
- `src/lib/supabase/client.ts` (browser) and `server.ts` (server) — always use these, never instantiate clients ad hoc
- `src/lib/seed/` — demo world generation; seed data is engineered so rehearsed demo queries return strong matches
- `supabase/migrations/` — **canonical schema**. Never edit an existing migration; append a new numbered one (`014_...`). RLS policies live here and are tested by pgTAP + integration tests
- `src/components/` — feature folders (`talent/`, `search/`, `admin/`, …) over shadcn primitives in `src/components/ui/`

### Data flow (AI search — the headline feature)
Query → LLM parses to structured intent (category, skills, location, availability) → query embedded → pgvector cosine similarity against `profile_embeddings` → structured filters narrow/boost → ranked results with **real** match scores (never hardcoded). Must return in under two seconds.

## Security invariants

- `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are **server-only**. Never prefix with `NEXT_PUBLIC_`, never import into client components. CI greps built client bundles for their values (`scripts/check-client-bundles.mjs`) and fails if found.
- All OpenAI calls run in route handlers or server actions — no AI keys reach the browser.
- RLS on all user data. Mocked unit tests are NOT evidence auth/tenant isolation works; only integration + pgTAP tests are.
- **Every migration that creates a table must declare its grants explicitly** (see `030_baseline_table_grants.sql`). Local stacks have no default privileges, so a table without explicit grants works on hosted but fails pgTAP/CI with "permission denied". RLS bounds rows; grants bound verbs.
- New env vars: document in `.env.example` and register in the startup validation (`src/instrumentation.ts` / `src/lib/env.ts`).

## Never edit

- `.next/`, `node_modules/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `test-results/`
- `package-lock.json` by hand (only via npm)
- Existing files in `supabase/migrations/` (append new migrations instead)
- `src/components/ui/*` are shadcn-generated; prefer regenerating/adding via CLI over heavy hand edits

## Guidelines

- Server Components by default; `'use client'` only for interactivity, pushed to the leaves. Mutations via server actions.
- Follow the one-module-one-test pattern in `src/lib/`: new domain logic gets a colocated `*.test.ts`.
- Lint runs with `--max-warnings 0` — warnings fail CI.
- Mobile-first: iOS Safari is the priority browser (investors demo on phones).
- Keep changes focused and atomic; update this file when conventions change.
- Deliberately accepted dependency advisories go in `docs/security-advisories.md`; CI fails on undocumented high-severity production advisories.

## UI components (shadcn/ui)

Before building any UI primitive from scratch, check whether [shadcn/ui](https://ui.shadcn.com/docs/components) already provides it.

- **Default:** use existing components under `src/components/ui/` or add them with `npx shadcn@latest add <component>`.
- **Tables:** use the shadcn [Data Table](https://ui.shadcn.com/docs/components/base/data-table) pattern — `Table` + TanStack Table via `@/components/ui/data-table`, with column defs, row selection, sorting, pagination, column visibility (`data-table-view-options`, `data-table-column-header`, `data-table-pagination`). Do not use raw `<table>` markup.
- **Do not** hand-roll buttons, inputs, dialogs, badges, cards, or other controls when a shadcn equivalent exists in the project or registry.
- Match the project's `components.json` style (`base-nova`) and existing component patterns when adding new shadcn components.
