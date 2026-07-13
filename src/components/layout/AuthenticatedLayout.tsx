import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { HirerNav } from '@/components/layout/HirerNav'
import { TalentNav } from '@/components/layout/TalentNav'

export async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const localDemoMode = process.env.NODE_ENV === 'development' && cookieStore.get('atlas_demo')?.value === '1'
  const supabase = localDemoMode ? null : await createClient()
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } }

  if (!user && !localDemoMode) redirect('/login')

  const accountType = localDemoMode
    ? cookieStore.get('atlas_demo_role')?.value ?? 'talent'
    : user?.user_metadata?.account_type
  const isHirer = accountType === 'hirer'
  if (!localDemoMode && !isHirer && accountType !== 'talent') redirect('/login')

  return (
    <div className="min-h-screen bg-background md:pl-64">
      {isHirer ? <HirerNav /> : <TalentNav />}
      <main className="min-h-screen px-4 pb-24 pt-16 sm:px-6 md:px-8 md:pb-8 md:pt-8 lg:px-10">
        <div className="mx-auto w-full max-w-[1440px]">
          {children}
        </div>
      </main>
    </div>
  )
}
