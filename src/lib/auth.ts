import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export interface SessionInfo {
  userId: string | null
  accountType: string | null
  isLocalDemo: boolean
}

// Resolves the current session from the JWT via getClaims(), which verifies
// the token locally against the project's public signing keys - no network
// round-trip to the Supabase Auth server (unlike getUser()). Use this for
// layout/page gating; keep getUser() for sensitive mutations.
export async function getSession(): Promise<SessionInfo> {
  const cookieStore = await cookies()
  const isLocalDemo =
    process.env.NODE_ENV === 'development' && cookieStore.get('atlas_demo')?.value === '1'

  if (isLocalDemo) {
    return {
      userId: null,
      accountType: cookieStore.get('atlas_demo_role')?.value ?? 'talent',
      isLocalDemo: true,
    }
  }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  return {
    userId: claims?.sub ?? null,
    accountType:
      (claims?.user_metadata as { account_type?: string } | undefined)?.account_type ?? null,
    isLocalDemo: false,
  }
}
