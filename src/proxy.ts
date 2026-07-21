import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeInternalPath } from '@/lib/safe-redirect'

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // PostHog reverse proxy: analytics beacons and lazy-loaded extension
  // scripts (surveys, exception autocapture) are unauthenticated and must
  // never hit the auth logic below. Proxied here rather than via
  // next.config rewrites so we control the host header (PostHog routes on
  // it) and strip cookies (Supabase auth tokens must not reach PostHog).
  if (pathname.startsWith('/ingest/')) {
    const isAsset = pathname.startsWith('/ingest/static/') || pathname.startsWith('/ingest/array/')
    const hostname = isAsset ? 'us-assets.i.posthog.com' : 'us.i.posthog.com'
    const url = request.nextUrl.clone()
    url.protocol = 'https'
    url.hostname = hostname
    url.port = '443'
    url.pathname = pathname.replace(/^\/ingest/, '')
    const headers = new Headers(request.headers)
    headers.set('host', hostname)
    headers.delete('cookie')
    return NextResponse.rewrite(url, { request: { headers } })
  }

  if (process.env.NODE_ENV === 'development' && request.nextUrl.pathname === '/api/demo-login') {
    return NextResponse.next()
  }

  const hasDemoCookie = process.env.NODE_ENV === 'development' && request.cookies.get('atlas_demo')?.value === '1'

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  // A leftover demo cookie must never mask a real session.
  if (claims && hasDemoCookie) {
    supabaseResponse.cookies.delete('atlas_demo')
    supabaseResponse.cookies.delete('atlas_demo_role')
  }

  if (hasDemoCookie && !claims) return NextResponse.next()

  // Public machine-readable endpoints: health checks (uptime monitors) and
  // SEO files (crawlers never authenticate).
  if (pathname === '/api/health' || pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return NextResponse.next()
  }

  if (process.env.NODE_ENV === 'production' && pathname === '/design-system') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // OAuth callback: the user has no session yet — the route handler exchanges
  // the code for one. The handler rate-limits itself and rejects bad codes.
  if (pathname === '/auth/callback') {
    return NextResponse.next()
  }

  const isPublicLandingRoute = pathname === '/' || pathname === '/terms' || pathname === '/privacy'
  const isSuspendedRoute = pathname === '/suspended'
  // Public marketplace: anonymous visitors browse open jobs and the reduced
  // talent directory; the feed APIs behind the explorers are public too
  // (anon-scoped by RLS/views + rate limited). Only the /talent LIST is
  // public - /talent/{id} full profiles stay gated, so an anonymous click
  // falls through to the login redirect below with ?next= preserved.
  const isPublicJobsPage = pathname === '/jobs' || pathname.startsWith('/jobs/')
  const isPublicJobsApi = pathname === '/api/jobs/public'
  const isPublicTalentPage = pathname === '/talent'
  const isPublicTalentApi = pathname === '/api/talent/public'
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'

  if (isPublicLandingRoute || isSuspendedRoute) {
    return NextResponse.next()
  }

  if (!claims && (isPublicJobsPage || isPublicJobsApi || isPublicTalentPage || isPublicTalentApi)) {
    return NextResponse.next()
  }

  // Keep the public auth UI responsive during local development even when
  // the configured Supabase project is unavailable.
  if (process.env.NODE_ENV === 'development' && isAuthRoute) {
    return NextResponse.next()
  }

  // supabase client + claims already resolved above for demo/session precedence.

  // Redirect unauthenticated users to login (except auth routes).
  // API calls get a JSON 401 instead of an HTML redirect.
  if (!claims && !isAuthRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Round-trip the gated destination so sign-in lands the user back where
    // they were heading (validated by safeInternalPath before use).
    url.search = ''
    url.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  // Suspension enforcement for API calls. Unlike the role routing below,
  // this IS enforcement: it is DB-backed via the security-definer
  // is_caller_suspended() (migration 022), so a suspended user with a live
  // session cannot keep using the API from an already-loaded tab. Routes
  // using getAuthenticatedCaller() re-check independently; this catch-all
  // covers the routes that authenticate ad hoc.
  if (claims && pathname.startsWith('/api/')) {
    const { data: suspended } = await supabase.rpc('is_caller_suspended')
    if (suspended === true) {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    }
  }

  // Redirect authenticated users away from auth pages. A validated ?next=
  // (e.g. an already-signed-in user tapping "Sign in to apply" on a public
  // job) is honored instead of dumping them on /home.
  if (claims && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = safeInternalPath(request.nextUrl.searchParams.get('next'))
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Role-based route protection.
  //
  // NOTE: account_type/platform_admin here come from JWT user_metadata, which
  // users can rewrite via auth.updateUser() - so this block is OPTIMISTIC
  // UX-level routing only, never enforcement. Real enforcement is DB-backed:
  // API routes resolve roles from profiles/platform_admins via
  // getAuthenticatedCaller()/requirePlatformAdmin(), layouts via getSession(),
  // and row access via RLS.
  if (claims) {
    const metadata = claims.user_metadata as { account_type?: string; platform_admin?: boolean } | undefined
    const accountType = metadata?.account_type
    const isPlatformAdmin = metadata?.platform_admin === true
    const hirerOnlyPrefixes = ['/search', '/my-jobs', '/outreach', '/talent', '/shortlists']
    const talentOnlyPrefixes = ['/discover']
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

    if (isAdminRoute) {
      return supabaseResponse
    }

    if (isPlatformAdmin) {
      return supabaseResponse
    }

    // Signed-in talent get the authed job experience (apply flow, passes)
    // instead of the public marketplace pages. Hirers/admins may browse the
    // public pages freely.
    if (accountType === 'talent' && isPublicJobsPage) {
      const url = request.nextUrl.clone()
      url.pathname = pathname === '/jobs' ? '/discover' : pathname.replace(/^\/jobs/, '/discover')
      return NextResponse.redirect(url)
    }

    if (accountType === 'talent' && hirerOnlyPrefixes.some(p => pathname.startsWith(p))) {
      // Talent may preview their own public profile page - everything else
      // behind hirer-only prefixes stays off limits.
      const isOwnProfilePreview = pathname === `/talent/${claims.sub}`
      if (!isOwnProfilePreview) {
        const url = request.nextUrl.clone()
        url.pathname = '/discover'
        return NextResponse.redirect(url)
      }
    }

    if (accountType === 'hirer' && talentOnlyPrefixes.some(p => pathname.startsWith(p))) {
      const url = request.nextUrl.clone()
      url.pathname = '/search'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
