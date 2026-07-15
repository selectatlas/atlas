'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function signOut() {
  // Always clear both: a user can hold a demo cookie and a real session at once,
  // and logout must end both.
  const cookieStore = await cookies()
  cookieStore.delete('atlas_demo')
  cookieStore.delete('atlas_demo_role')
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
