'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function signOut() {
  const cookieStore = await cookies()
  const localDemoMode = process.env.NODE_ENV === 'development' && cookieStore.get('castd_demo')?.value === '1'
  if (localDemoMode) {
    cookieStore.delete('castd_demo')
    cookieStore.delete('castd_demo_role')
  } else {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect('/login')
}
