import { getSession } from '@/lib/auth'
import { HirerProfileEditor } from '@/components/profile/HirerProfileEditor'
import { TalentProfileEditor } from '@/components/profile/TalentProfileEditor'

export default async function ProfilePage() {
  const { accountType } = await getSession()

  if (accountType === 'hirer') return <HirerProfileEditor />
  return <TalentProfileEditor />
}
