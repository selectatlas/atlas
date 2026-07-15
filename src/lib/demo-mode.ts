// Local demo mode is dev-only, driven by the atlas_demo cookie set by /api/demo-login.
// The NODE_ENV guard matters: the cookie lives for 24h, so without it a leftover
// demo cookie would mask real data (e.g. an empty messages inbox) after a real login.

export function hasDemoCookie(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    typeof document !== 'undefined' &&
    document.cookie.split(';').some(cookie => cookie.trim().startsWith('atlas_demo=1'))
  )
}

/** Sync check — only the cookie. Prefer isActiveLocalDemoMode() when a real session may exist. */
export function isLocalDemoMode(): boolean {
  return hasDemoCookie()
}

/** True only when the demo cookie is set and there is no signed-in Supabase user. */
export async function isActiveLocalDemoMode(): Promise<boolean> {
  if (!hasDemoCookie()) return false

  const { createClient } = await import('@/lib/supabase/client')
  const { data: { user } } = await createClient().auth.getUser()
  if (user) {
    clearLocalDemoCookies()
    return false
  }
  return true
}

export function clearLocalDemoCookies(): void {
  if (typeof document === 'undefined') return
  document.cookie = 'atlas_demo=; Max-Age=0; path=/; SameSite=Lax'
  document.cookie = 'atlas_demo_role=; Max-Age=0; path=/; SameSite=Lax'
}
