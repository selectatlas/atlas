import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getPlatformAdminRole } from '@/lib/platform-admin'

export interface SessionInfo {
  userId: string | null
  accountType: string | null
  isLocalDemo: boolean
  isPlatformAdmin: boolean
  adminRole: 'owner' | 'moderator' | 'support' | null
}

// Resolves the current session from the JWT via getClaims(), which verifies
// the token locally against the project's public signing keys - no network
// round-trip to the Supabase Auth server (unlike getUser()). Use this for
// layout/page gating; keep getUser() for sensitive mutations.
function hasDemoCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    cookieStore.get('atlas_demo')?.value === '1'
  )
}

// Demo mode only applies when the atlas_demo cookie is set and there is no real
// Supabase session. A leftover demo cookie must never mask a signed-in user.
export async function isServerDemoOnly(): Promise<boolean> {
  const cookieStore = await cookies()
  if (!hasDemoCookie(cookieStore)) return false

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return !data?.claims?.sub
}

export async function getSession(): Promise<SessionInfo> {
  const cookieStore = await cookies()
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (claims?.sub) {
    const adminRole = await getPlatformAdminRole(claims.sub)
    return {
      userId: claims.sub,
      accountType:
        (claims.user_metadata as { account_type?: string } | undefined)?.account_type ?? null,
      isLocalDemo: false,
      isPlatformAdmin: adminRole !== null,
      adminRole,
    }
  }

  if (hasDemoCookie(cookieStore)) {
    return {
      userId: null,
      accountType: cookieStore.get('atlas_demo_role')?.value ?? 'talent',
      isLocalDemo: true,
      isPlatformAdmin: false,
      adminRole: null,
    }
  }

  return {
    userId: null,
    accountType: null,
    isLocalDemo: false,
    isPlatformAdmin: false,
    adminRole: null,
  }
}
