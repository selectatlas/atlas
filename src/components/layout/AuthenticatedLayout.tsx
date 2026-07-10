import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HirerNav } from '@/components/layout/HirerNav'
import { TalentNav } from '@/components/layout/TalentNav'

export async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const isHirer = user.user_metadata?.account_type === 'hirer'
  if (!isHirer && user.user_metadata?.account_type !== 'talent') redirect('/login')

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
