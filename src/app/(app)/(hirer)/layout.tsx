import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

// Role gate only - the shared (app) layout renders the shell.
export default async function HirerLayout({ children }: { children: React.ReactNode }) {
  const { accountType } = await getSession()
  if (accountType !== 'hirer') redirect('/discover')
  return children
}
