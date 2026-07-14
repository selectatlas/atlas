import { assertServerEnv } from '@/lib/env'

// Runs once when the server boots (next start / next dev), not during build.
// A deployment missing a required variable fails here, by name, before it
// serves a single request.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    assertServerEnv()
  }
}
