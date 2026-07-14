import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Local-stack connection details. Read from `supabase status -o env` names
// with SUPABASE_TEST_* overrides taking precedence.
export const API_URL =
  process.env.SUPABASE_TEST_URL ?? process.env.API_URL ?? 'http://127.0.0.1:55321'
export const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.ANON_KEY ?? ''
export const SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? ''

// Hard safety rail: integration tests create and delete users and rows.
// They must never point at a hosted project.
const LOCAL_HOSTS = ['127.0.0.1', 'localhost']
export const isLocalStack = LOCAL_HOSTS.some(host => API_URL.includes(host))
export const hasCredentials = ANON_KEY.length > 0 && SERVICE_ROLE_KEY.length > 0

export async function isStackRunning(): Promise<boolean> {
  if (!isLocalStack || !hasCredentials) return false
  try {
    const response = await fetch(`${API_URL}/auth/v1/health`, {
      headers: { apikey: ANON_KEY },
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

export function adminClient(): SupabaseClient {
  return createClient(API_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface TestUser {
  id: string
  email: string
  client: SupabaseClient
}

const PASSWORD = 'integration-test-password-1'

export async function createTestUser(
  admin: SupabaseClient,
  accountType: 'hirer' | 'talent',
  label: string,
): Promise<TestUser> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@atlas-integration.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { account_type: accountType, full_name: `Test ${label}` },
  })
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`)

  const client = createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError) throw new Error(`signIn(${label}) failed: ${signInError.message}`)

  return { id: data.user.id, email, client }
}

export async function deleteTestUsers(admin: SupabaseClient, users: TestUser[]) {
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.id).catch(() => undefined)
  }
}
