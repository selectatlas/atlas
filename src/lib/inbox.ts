export type NotificationKind = 'message' | 'application' | 'outreach' | 'saved_search'

export type InboxNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string
  href: string
  createdAt: string
  unread: boolean
}

export type InboxSummary = {
  unreadMessages: number
  unreadApplications: number
  unreadOutreach: number
  unreadSavedSearches: number
  totalUnread: number
}

export function sumInbox(summary: Pick<InboxSummary, 'unreadMessages' | 'unreadApplications' | 'unreadOutreach' | 'unreadSavedSearches'>): number {
  return summary.unreadMessages + summary.unreadApplications + summary.unreadOutreach + summary.unreadSavedSearches
}

// Bumble-style "Your move": the other participant sent the latest message
// and is waiting on a reply. Unread threads are always your move; a thread
// you have read stays your move until you respond.
export function isYourMove(
  lastMessage: { sender_id: string } | null | undefined,
  unread: boolean,
  userId: string | null,
): boolean {
  if (unread) return true
  if (!lastMessage || !userId) return false
  return lastMessage.sender_id !== '' && lastMessage.sender_id !== userId
}

export function isThreadUnread(
  lastMessage: { sender_id: string; created_at: string } | null | undefined,
  lastReadAt: string,
  userId: string,
): boolean {
  if (!lastMessage) return false
  if (lastMessage.sender_id === userId) return false
  return new Date(lastMessage.created_at).getTime() > new Date(lastReadAt).getTime()
}
