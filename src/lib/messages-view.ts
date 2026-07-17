import { isSystemMessageKind, systemCardTitle } from '@/lib/system-messages'

export type ThreadMessage = {
  id: string
  content: string
  sender_id: string
  created_at: string
  kind?: string | null
}

// Inbox and conversation-list snippet for the latest message. System
// messages store a human-readable sentence as content; fall back to the
// card title if a system message ever arrives with empty content.
export function threadPreviewSnippet(message: {
  kind?: string | null
  content: string | null
}): string {
  const content = message.content?.trim() ?? ''
  if (isSystemMessageKind(message.kind) && content.length === 0) {
    return systemCardTitle(message.kind)
  }
  return content
}

// The other participant has seen a message when their last_read_at is at or
// after the message time. Mirrors isThreadUnread semantics in inbox.ts.
export function isSeen(
  message: Pick<ThreadMessage, 'created_at'> | null | undefined,
  otherLastReadAt: string | null | undefined,
): boolean {
  if (!message || !otherLastReadAt) return false
  return new Date(otherLastReadAt).getTime() >= new Date(message.created_at).getTime()
}

export function lastOwnMessageId(messages: ThreadMessage[], userId: string): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id === userId) return messages[i].id
  }
  return null
}

export type MessageDayGroup = {
  dayKey: string
  label: string
  messages: ThreadMessage[]
}

export function groupMessagesByDay(messages: ThreadMessage[], now: Date = new Date()): MessageDayGroup[] {
  const groups: MessageDayGroup[] = []
  for (const message of messages) {
    const date = new Date(message.created_at)
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const current = groups[groups.length - 1]
    if (current && current.dayKey === dayKey) {
      current.messages.push(message)
    } else {
      groups.push({ dayKey, label: formatDayLabel(date, now), messages: [message] })
    }
  }
  return groups
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatDayLabel(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function formatThreadTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const diffHrs = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  if (diffHrs < 24) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffHrs < 48) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
