import type { ThreadMessage } from '@/lib/messages-view'

export type ThreadListItem = {
  id: string
  otherId: string | null
  otherName: string
  otherAvatar: string | null
  lastMessage: string
  lastMessageKind?: string | null
  lastSenderId: string
  lastMessageAt: string
  unread?: boolean
  archived?: boolean
  originJobId: string | null
  originJobTitle: string | null
}

export type ThreadOrigin = {
  outreach_id: string | null
  outreach_sent_at: string | null
  job_id: string | null
  job_title: string | null
}

export type ThreadOther = {
  profile_id: string | null
  full_name: string
  avatar_url: string | null
  last_read_at: string | null
}

export type ThreadDetail = {
  thread_id: string
  created_at: string | null
  archived: boolean
  read_at: string
  other: ThreadOther | null
  origin: ThreadOrigin
  messages: ThreadMessage[]
}

// Fired whenever a thread's list-relevant state changes (archive, new thread)
// so the conversation list refreshes without prop-drilling through the layout.
export const THREADS_CHANGED_EVENT = 'atlas:threads-changed'

export function emitThreadsChanged() {
  window.dispatchEvent(new CustomEvent(THREADS_CHANGED_EVENT))
}
