import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { HirerNav } from '@/components/layout/HirerNav'
import { TalentNav } from '@/components/layout/TalentNav'
import { AppShellProvider } from '@/components/layout/app-shell-context'
import { AppTopBar } from '@/components/layout/AppTopBar'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { InboxProvider } from '@/components/layout/inbox-context'

// Single persistent shell for every authenticated surface. Because all authed
// routes share this one layout, the sidebar never remounts on navigation -
// only the inner page segment re-renders.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, accountType, isLocalDemo, isPlatformAdmin } = await getSession()

  if (!userId && !isLocalDemo) redirect('/login')

  if (userId && !isLocalDemo && !isPlatformAdmin) {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('suspended_at')
      .eq('id', userId)
      .maybeSingle()
    if (profile?.suspended_at) redirect('/suspended')
  }

  const isHirer = accountType === 'hirer' || isPlatformAdmin
  if (!isLocalDemo && !isHirer && accountType !== 'talent' && !isPlatformAdmin) redirect('/login')

  return (
    <AppShellProvider accountType={isHirer ? 'hirer' : 'talent'} isPlatformAdmin={isPlatformAdmin}>
      <InboxProvider>
        <div className="min-h-screen bg-background md:pl-64">
          {isHirer ? <HirerNav /> : <TalentNav />}
          <CommandPalette />
          <div className="flex min-h-screen flex-col">
            <AppTopBar />
            <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:px-8 md:pb-8 lg:px-10">
              <div className="mx-auto w-full max-w-[1440px]">
                {children}
              </div>
            </main>
          </div>
        </div>
      </InboxProvider>
    </AppShellProvider>
  )
}
