import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

// Role gate only - the shared (app) layout renders the shell.
export default async function HirerLayout({ children }: { children: React.ReactNode }) {
  const { accountType, isPlatformAdmin } = await getSession()
  if (accountType !== 'hirer' && !isPlatformAdmin) redirect('/discover')
  return children
}
