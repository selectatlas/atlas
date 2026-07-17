import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEMO_HIRER, DEMO_PASSWORD } from '@/lib/seed/demo-world'

// GET /api/demo-login?role=hirer|talent — development-only shortcut buttons.
//
// Signs in with a REAL Supabase session as the seeded demo account so every
// feature behaves exactly like production: uploads, messages, RLS-protected
// writes, storage ownership. Falls back to the cookie-only demo mode (fake
// session, read-only surfaces) when the database has not been seeded yet.
const DEMO_ACCOUNTS = {
  hirer: DEMO_HIRER.email,
  talent: 'priya.singh@atlas-demo.com',
} as const

export async function GET(request: Request) {
  const loginUrl = new URL('/login', request.url)

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.redirect(loginUrl)
  }

  const requestedRole = new URL(request.url).searchParams.get('role')
  const role = requestedRole === 'hirer' ? 'hirer' : 'talent'

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_ACCOUNTS[role],
    password: DEMO_PASSWORD,
  })

  const response = NextResponse.redirect(new URL('/home', request.url))

  if (!error) {
    // Real session established (auth cookies were written by the Supabase
    // client). Clear any leftover cookie-demo state so it can never mask the
    // real session.
    response.cookies.set('atlas_demo', '', { path: '/', maxAge: 0, sameSite: 'lax' })
    response.cookies.set('atlas_demo_role', '', { path: '/', maxAge: 0, sameSite: 'lax' })
    return response
  }

  response.cookies.set('atlas_demo', '1', {
    path: '/',
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
  })
  response.cookies.set('atlas_demo_role', role, {
    path: '/',
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
  })
  return response
}
