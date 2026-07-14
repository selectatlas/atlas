import { defineConfig } from 'vitest/config'
import path from 'path'

// Integration tests run against a real local Supabase stack:
//   supabase start
//   npm run test:integration
// Environment is read from `supabase status -o env` values; the suite refuses
// to run against anything that is not a local stack.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Suites share database state; run them serially.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
