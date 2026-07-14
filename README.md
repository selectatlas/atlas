# atlas

Atlas profile search for discovering and connecting with creative talent.

## Getting Started

Install dependencies, configure the environment, and start the development server:

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

Every required variable is documented in `.env.example`. The server validates
them at startup (`src/instrumentation.ts`) and fails by NAME when one is
missing. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only:
never prefix them with `NEXT_PUBLIC_` - CI verifies their values are absent
from client bundles (`scripts/check-client-bundles.mjs`).

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Commands

```bash
npm run lint
npm test          # unit tests (mocked, fast)
npm run build
```

## Integration and end-to-end tests

These run against a real local Supabase stack (Docker required) and are what
CI uses to prove RLS and the two-role journeys - the mocked unit tests are not
evidence that authentication or tenant isolation works.

```bash
supabase start                      # local stack on the 553xx ports
supabase test db                    # pgTAP policy tests
set -a; eval "$(supabase status -o env)"; set +a
npm run test:integration            # real-database RLS tests (vitest)

# End-to-end (production build against the local stack; NEXT_PUBLIC_* values
# are inlined at build time so the build must use the stack URL):
NEXT_PUBLIC_SUPABASE_URL=$API_URL \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY \
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
OPENAI_API_KEY=sk-local-placeholder npm run build
npm run test:e2e                    # Playwright journeys
```

Dependency advisories that are deliberately accepted are recorded in
[docs/security-advisories.md](docs/security-advisories.md); CI fails on any
undocumented high-severity production advisory.

## Database

Supabase migrations are the canonical schema. See [docs/supabase-deployment.md](docs/supabase-deployment.md) for clean-database verification, deployment, and recovery steps. Hosted Supabase setup is intentionally performed separately from local development.
