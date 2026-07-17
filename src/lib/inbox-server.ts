import type { SupabaseClient } from '@supabase/supabase-js'
import { isThreadUnread, sumInbox, type InboxNotification, type InboxSummary } from '@/lib/inbox'
import { threadPreviewSnippet } from '@/lib/messages-view'
import { buildSavedSearchHref, newMatchesBody } from '@/lib/saved-searches'
import { fetchSavedSearchesWithNewMatches } from '@/lib/saved-searches-server'

type ThreadRow = {
  id: string
  created_at: string
  messages: Array<{ id: string; content: string; kind: string | null; sender_id: string; created_at: string }>
  thread_participants: Array<{
    profile_id: string
    last_read_at: string
    profiles: { full_name: string; avatar_url: string | null } | null
  }>
}

export async function fetchInboxForUser(
  supabase: SupabaseClient,
  userId: string,
  accountType: 'hirer' | 'talent',
): Promise<{ summary: InboxSummary; notifications: InboxNotification[] }> {
  const notifications: InboxNotification[] = []
  let unreadMessages = 0

  const { data: myThreads } = await supabase
    .from('thread_participants')
    .select('thread_id, last_read_at, archived_at')
    .eq('profile_id', userId)

  // Archived threads stay out of unread counts and notifications.
  const activeThreads = (myThreads ?? []).filter(row => row.archived_at === null)
  const threadIds = activeThreads.map(row => row.thread_id as string)
  const readByThread = new Map(
    activeThreads.map(row => [row.thread_id as string, row.last_read_at as string]),
  )

  if (threadIds.length > 0) {
    const { data: threads } = await supabase
      .from('message_threads')
      .select(`
        id,
        created_at,
        thread_participants(profile_id, last_read_at, profiles(full_name, avatar_url)),
        messages(id, content, kind, sender_id, created_at)
      `)
      .in('id', threadIds)
      .order('created_at', { referencedTable: 'messages', ascending: false })
      .limit(1, { foreignTable: 'messages' })

    for (const thread of (threads ?? []) as unknown as ThreadRow[]) {
      const msg = thread.messages?.[0]
      const lastReadAt = readByThread.get(thread.id) ?? new Date(0).toISOString()
      const unread = isThreadUnread(msg, lastReadAt, userId)
      if (!unread) continue

      unreadMessages += 1
      const other = thread.thread_participants.find(p => p.profile_id !== userId)
      notifications.push({
        id: `message-${thread.id}`,
        kind: 'message',
        title: other?.profiles?.full_name ?? 'New message',
        body: msg ? threadPreviewSnippet(msg) : 'New message',
        href: `/messages/${thread.id}`,
        createdAt: msg?.created_at ?? thread.created_at,
        unread: true,
      })
    }
  }

  let unreadApplications = 0
  let unreadOutreach = 0
  let unreadSavedSearches = 0

  if (accountType === 'hirer') {
    const { data: jobs } = await supabase.from('jobs').select('id').eq('hirer_id', userId)
    const jobIds = (jobs ?? []).map(job => job.id as string)

    if (jobIds.length > 0) {
      const { data: applications } = await supabase
        .from('applications')
        .select('id, job_id, status, created_at, jobs(title), profiles!talent_id(full_name)')
        .in('job_id', jobIds)
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(20)

      unreadApplications = applications?.length ?? 0
      for (const app of applications ?? []) {
        const job = app.jobs as unknown as { title: string } | null
        const talent = app.profiles as unknown as { full_name: string } | null
        notifications.push({
          id: `application-${app.id}`,
          kind: 'application',
          title: `Application for ${job?.title ?? 'your job'}`,
          body: `${talent?.full_name ?? 'Someone'} applied`,
          href: `/jobs/${app.job_id as string}`,
          createdAt: app.created_at as string,
          unread: true,
        })
      }
    }

    const { data: outreach } = await supabase
      .from('outreach')
      .select('id, message, status, created_at, profiles!talent_id(full_name)')
      .eq('hirer_id', userId)
      .eq('status', 'responded')
      .order('created_at', { ascending: false })
      .limit(10)

    unreadOutreach = outreach?.length ?? 0
    for (const row of outreach ?? []) {
      const talent = row.profiles as unknown as { full_name: string } | null
      notifications.push({
        id: `outreach-${row.id}`,
        kind: 'outreach',
        title: `${talent?.full_name ?? 'Talent'} responded`,
        body: (row.message as string).slice(0, 120),
        href: '/outreach',
        createdAt: row.created_at as string,
        unread: true,
      })
    }

    // Saved-search alerts: new matching talent since each search was last
    // run, computed at read time (no cron, no notifications table).
    const savedSearches = await fetchSavedSearchesWithNewMatches(supabase, userId)
    for (const search of savedSearches) {
      if (search.newMatches === 0) continue
      unreadSavedSearches += 1
      notifications.push({
        id: `saved-search-${search.id}`,
        kind: 'saved_search',
        title: `New matches for "${search.name}"`,
        body: newMatchesBody(search.newMatches),
        href: buildSavedSearchHref(search),
        createdAt: search.latestMatchAt ?? search.createdAt,
        unread: true,
      })
    }
  }

  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const summary = {
    unreadMessages,
    unreadApplications,
    unreadOutreach,
    unreadSavedSearches,
    totalUnread: 0,
  }
  summary.totalUnread = sumInbox(summary)

  return { summary, notifications }
}
