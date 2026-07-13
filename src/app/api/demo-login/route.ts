import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const loginUrl = new URL('/login', request.url)

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.redirect(loginUrl)
  }

  const requestedRole = new URL(request.url).searchParams.get('role')
  const role = requestedRole === 'hirer' ? 'hirer' : 'talent'
  const response = NextResponse.redirect(new URL(role === 'hirer' ? '/search' : '/discover', request.url))
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
