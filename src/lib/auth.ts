import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getPlatformAdminRole } from '@/lib/platform-admin'

export type ShellAccountType = 'hirer' | 'talent'

export interface SessionInfo {
  userId: string | null
  accountType: string | null
  // Which workspace shell to render. Differs from accountType only for
  // platform admins, who default to the hirer shell but can flip to talent
  // via the sidebar switcher. Every surface that branches on role must use
  // this, or the switcher leaves the nav and the page disagreeing.
  shellAccountType: ShellAccountType
  isLocalDemo: boolean
  isPlatformAdmin: boolean
  adminRole: 'owner' | 'moderator' | 'support' | null
}

// Presentation only - the cookie never grants access, which stays gated on
// isPlatformAdmin and the per-route checks.
export function resolveShellAccountType(
  accountType: string | null,
  isPlatformAdmin: boolean,
  adminView: string | undefined,
): ShellAccountType {
  if (isPlatformAdmin) return adminView === 'talent' ? 'talent' : 'hirer'
  return accountType === 'hirer' ? 'hirer' : 'talent'
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
    // account_type must come from the profiles row, not JWT user_metadata:
    // users can rewrite their own user_metadata via auth.updateUser(), so a
    // metadata-derived role would let talent forge their way into hirer
    // layouts. Metadata is only a fallback for brand-new users whose profile
    // row does not exist yet (pre-onboarding).
    const [adminRole, { data: profile }] = await Promise.all([
      getPlatformAdminRole(claims.sub),
      supabase.from('profiles').select('account_type').eq('id', claims.sub).maybeSingle(),
    ])
    const accountType =
      profile?.account_type ??
      (claims.user_metadata as { account_type?: string } | undefined)?.account_type ??
      null
    const isPlatformAdmin = adminRole !== null
    return {
      userId: claims.sub,
      accountType,
      shellAccountType: resolveShellAccountType(
        accountType,
        isPlatformAdmin,
        isPlatformAdmin ? cookieStore.get('atlas_admin_view')?.value : undefined,
      ),
      isLocalDemo: false,
      isPlatformAdmin,
      adminRole,
    }
  }

  if (hasDemoCookie(cookieStore)) {
    const demoRole = cookieStore.get('atlas_demo_role')?.value ?? 'talent'
    return {
      userId: null,
      accountType: demoRole,
      shellAccountType: resolveShellAccountType(demoRole, false, undefined),
      isLocalDemo: true,
      isPlatformAdmin: false,
      adminRole: null,
    }
  }

  return {
    userId: null,
    accountType: null,
    shellAccountType: 'talent',
    isLocalDemo: false,
    isPlatformAdmin: false,
    adminRole: null,
  }
}
