import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (process.env.NODE_ENV === 'development' && request.nextUrl.pathname === '/api/demo-login') {
    return NextResponse.next()
  }

  const localDemoMode = process.env.NODE_ENV === 'development' && request.cookies.get('atlas_demo')?.value === '1'
  if (localDemoMode) return NextResponse.next()

  const isPublicLandingRoute = pathname === '/'
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'

  if (isPublicLandingRoute) {
    return NextResponse.next()
  }

  // Keep the public auth UI responsive during local development even when
  // the configured Supabase project is unavailable.
  if (process.env.NODE_ENV === 'development' && isAuthRoute) {
    return NextResponse.next()
  }

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

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except auth routes).
  // API calls get a JSON 401 instead of an HTML redirect.
  if (!user && !isAuthRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    const accountType = user.user_metadata?.account_type
    const url = request.nextUrl.clone()
    url.pathname = accountType === 'hirer' ? '/search' : '/discover'
    return NextResponse.redirect(url)
  }

  // Role-based route protection
  if (user) {
    const accountType = user.user_metadata?.account_type
    const hirerOnlyPrefixes = ['/search', '/jobs', '/outreach', '/talent']
    // '/activity' and '/messages' are shared surfaces — both roles have them in their nav
    const talentOnlyPrefixes = ['/discover', '/profile']

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
