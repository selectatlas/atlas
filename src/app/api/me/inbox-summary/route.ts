import { createClient } from '@/lib/supabase/server'
import { getSession, isServerDemoOnly } from '@/lib/auth'
import { fetchInboxForUser } from '@/lib/inbox-server'

export async function GET() {
  if (await isServerDemoOnly()) {
    return Response.json({
      unreadMessages: 0,
      unreadApplications: 0,
      unreadOutreach: 0,
      totalUnread: 0,
    })
  }

  const [supabase, session] = await Promise.all([createClient(), getSession()])
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accountType =
    session.accountType === 'hirer' || session.accountType === 'talent'
      ? session.accountType
      : 'talent'

  const { summary } = await fetchInboxForUser(supabase, session.userId, accountType)
  return Response.json(summary)
}
