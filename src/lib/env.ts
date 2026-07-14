// Central typed environment validation. The server refuses to start when a
// required production setting is absent, and fails with the variable NAME -
// never its value. See .env.example for the full documented list.

export const REQUIRED_SERVER_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
] as const

export type RequiredServerEnv = (typeof REQUIRED_SERVER_ENV)[number]

// Names that must NEVER be prefixed NEXT_PUBLIC_ or appear in client bundles.
export const SERVER_ONLY_ENV = ['SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'] as const

export function missingServerEnv(env: Record<string, string | undefined> = process.env): string[] {
  return REQUIRED_SERVER_ENV.filter(name => {
    const value = env[name]
    return typeof value !== 'string' || value.trim().length === 0
  })
}

// Throws at server startup (see src/instrumentation.ts) with every missing
// variable named, so a misconfigured deployment fails clearly and immediately
// instead of erroring on the first request that needs the setting.
export function assertServerEnv(env: Record<string, string | undefined> = process.env): void {
  const missing = missingServerEnv(env)
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ` +
        `${missing.join(', ')}. Copy .env.example and fill in real values.`,
    )
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL!
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be an http(s) URL')
  }
}
