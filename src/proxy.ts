import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

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
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'

  if (isPublicLandingRoute || isSuspendedRoute) {
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
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (claims && isAuthRoute) {
    const accountType = (claims.user_metadata as { account_type?: string } | undefined)?.account_type
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  // Role-based route protection
  if (claims) {
    const metadata = claims.user_metadata as { account_type?: string; platform_admin?: boolean } | undefined
    const accountType = metadata?.account_type
    const isPlatformAdmin = metadata?.platform_admin === true
    const hirerOnlyPrefixes = ['/search', '/jobs', '/outreach', '/talent', '/shortlists']
    const talentOnlyPrefixes = ['/discover']
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

    if (isAdminRoute) {
      return supabaseResponse
    }

    if (isPlatformAdmin) {
      return supabaseResponse
    }

    if (accountType === 'talent' && hirerOnlyPrefixes.some(p => pathname.startsWith(p))) {
      const url = request.nextUrl.clone()
      url.pathname = '/discover'
      return NextResponse.redirect(url)
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
