import { getSession } from '@/lib/auth'
import { HirerProfileEditor } from '@/components/profile/HirerProfileEditor'
import { TalentProfileEditor } from '@/components/profile/TalentProfileEditor'

export default async function ProfilePage() {
  // Follows the workspace shell, not the raw account type: an admin viewing
  // the talent workspace must get the talent profile builder, not the hirer
  // one behind a talent nav.
  const { shellAccountType } = await getSession()

  if (shellAccountType === 'hirer') return <HirerProfileEditor />
  return <TalentProfileEditor />
}
