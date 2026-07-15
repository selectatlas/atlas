import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AdminNav } from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, isPlatformAdmin } = await getSession()

  if (!userId) redirect('/login')
  if (!isPlatformAdmin) redirect('/home')

  return (
    <div className="min-h-screen bg-background md:pl-64">
      <AdminNav />
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur sm:px-6 md:px-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform</p>
              <h1 className="font-heading text-lg font-medium">Atlas Admin</h1>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:px-8 md:pb-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1440px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
