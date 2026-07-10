import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'

  // Redirect unauthenticated users to login (except auth routes)
  if (!user && !isAuthRoute) {
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
    const talentOnlyPrefixes = ['/discover', '/profile', '/activity']

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
