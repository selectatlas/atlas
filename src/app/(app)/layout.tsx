import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { HirerNav } from '@/components/layout/HirerNav'
import { TalentNav } from '@/components/layout/TalentNav'

// Single persistent shell for every authenticated surface. Because all authed
// routes share this one layout, the sidebar never remounts on navigation -
// only the inner page segment re-renders.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, accountType, isLocalDemo } = await getSession()

  if (!userId && !isLocalDemo) redirect('/login')

  const isHirer = accountType === 'hirer'
  if (!isLocalDemo && !isHirer && accountType !== 'talent') redirect('/login')

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
