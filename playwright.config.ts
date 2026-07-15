import { defineConfig } from '@playwright/test'

// End-to-end tests run against a production build pointed at the local
// Supabase stack. Full flow:
//
//   supabase start
//   set -a; eval "$(supabase status -o env)"; set +a
//   NEXT_PUBLIC_SUPABASE_URL=$API_URL \
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY \
//     npm run build
//   npm run test:e2e
//
// NEXT_PUBLIC_* values are inlined at build time, so the build must use the
// local stack URL - a build made from .env.local will talk to the wrong
// database. AI-dependent flows are not exercised; OPENAI_API_KEY may be unset.

const API_URL = process.env.SUPABASE_TEST_URL ?? process.env.API_URL ?? 'http://127.0.0.1:55321'
const PUBLISHABLE_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ?? process.env.PUBLISHABLE_KEY ?? process.env.ANON_KEY ?? ''
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? ''

const PORT = 3111

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 45_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'sk-e2e-placeholder',
    },
  },
})
