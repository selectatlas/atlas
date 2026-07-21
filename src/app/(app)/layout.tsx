import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { HirerNav } from '@/components/layout/HirerNav'
import { TalentNav } from '@/components/layout/TalentNav'
import { AppShellProvider } from '@/components/layout/app-shell-context'
import { AppTopBar } from '@/components/layout/AppTopBar'
import { SearchCommand } from '@/components/search/SearchCommand'
import { SearchProvider } from '@/components/search/search-context'
import { InboxProvider } from '@/components/layout/inbox-context'
import { LegalFooterLinks } from '@/components/layout/LegalFooterLinks'

// Single persistent shell for every authenticated surface. Because all authed
// routes share this one layout, the sidebar never remounts on navigation -
// only the inner page segment re-renders.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, accountType, shellAccountType, isLocalDemo, isPlatformAdmin } = await getSession()

  if (!userId && !isLocalDemo) redirect('/login')

  if (userId && !isLocalDemo && !isPlatformAdmin) {
    // suspended_at is not column-granted to authenticated sessions (005/013),
    // so selecting it here silently errors and never redirects. The
    // security-definer function from migration 022 is the supported check.
    const supabase = await createClient()
    const { data: suspended } = await supabase.rpc('is_caller_suspended')
    if (suspended === true) redirect('/suspended')
  }

  // Platform admins default to the hirer shell but can flip to the talent
  // shell via the admin sidebar switcher (atlas_admin_view cookie). Resolved
  // in getSession so pages branch on exactly the same value as this nav.
  const isHirer = shellAccountType === 'hirer'
  if (!isLocalDemo && !isHirer && accountType !== 'talent' && !isPlatformAdmin) redirect('/login')

  return (
    <AppShellProvider accountType={isHirer ? 'hirer' : 'talent'} isPlatformAdmin={isPlatformAdmin}>
      <InboxProvider>
        <SearchProvider audience={isHirer ? 'hirer' : 'talent'}>
        <div className="min-h-screen bg-background md:pl-64">
          {isHirer ? <HirerNav /> : <TalentNav />}
          <SearchCommand />
          <div className="flex min-h-screen flex-col">
            <AppTopBar />
            <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:px-8 md:pb-8 lg:px-10">
              <div className="mx-auto w-full max-w-[1440px]">
                {children}
                <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground">
                  <p>© 2026 Atlas</p>
                  <LegalFooterLinks className="justify-start" />
                </footer>
              </div>
            </main>
          </div>
        </div>
        </SearchProvider>
      </InboxProvider>
    </AppShellProvider>
  )
}
