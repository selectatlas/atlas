export type NotificationKind = 'message' | 'application' | 'outreach'

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
  totalUnread: number
}

export function sumInbox(summary: Pick<InboxSummary, 'unreadMessages' | 'unreadApplications' | 'unreadOutreach'>): number {
  return summary.unreadMessages + summary.unreadApplications + summary.unreadOutreach
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
