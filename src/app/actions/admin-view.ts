'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

const VIEW_TARGETS = {
  hirer: '/home',
  talent: '/discover',
} as const

export type AdminView = keyof typeof VIEW_TARGETS

// Lets a platform admin browse the app through the hirer or talent shell.
// The cookie only influences which nav the shared (app) layout renders for
// admins - it never grants access, so a stale cookie on a non-admin is inert.
export async function switchAdminView(view: AdminView) {
  const target = VIEW_TARGETS[view]
  if (!target) redirect('/home')

  const { isPlatformAdmin } = await getSession()
  if (!isPlatformAdmin) redirect('/home')

  const cookieStore = await cookies()
  cookieStore.set('atlas_admin_view', view, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  redirect(target)
}
