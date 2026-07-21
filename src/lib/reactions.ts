// Emoji reactions on messages. The allowed set is mirrored by the DB check
// constraint in migration 028 — keep the two in sync via a new migration.

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉'] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === 'string' && (REACTION_EMOJIS as readonly string[]).includes(value)
}

export type MessageReaction = {
  message_id: string
  profile_id: string
  emoji: string
}

export type ReactionPill = {
  emoji: string
  count: number
  mine: boolean
}

// Groups a thread's flat reaction rows into render-ready pills for one
// message, ordered by the canonical emoji order.
export function aggregateReactions(
  reactions: MessageReaction[],
  messageId: string,
  userId: string | null,
): ReactionPill[] {
  const pills: ReactionPill[] = []
  for (const emoji of REACTION_EMOJIS) {
    const rows = reactions.filter(r => r.message_id === messageId && r.emoji === emoji)
    if (rows.length === 0) continue
    pills.push({
      emoji,
      count: rows.length,
      mine: userId !== null && rows.some(r => r.profile_id === userId),
    })
  }
  return pills
}

export function myReactionFor(
  reactions: MessageReaction[],
  messageId: string,
  userId: string | null,
): string | null {
  if (!userId) return null
  return reactions.find(r => r.message_id === messageId && r.profile_id === userId)?.emoji ?? null
}

export type ReactionEvent = {
  message_id: string
  profile_id: string
  emoji: string | null
}

// Pure reducer applied for both optimistic local updates and incoming
// realtime broadcasts. A null emoji removes the user's reaction; a string
// sets or replaces it (one reaction per user per message).
export function applyReactionEvent(
  reactions: MessageReaction[],
  event: ReactionEvent,
): MessageReaction[] {
  const rest = reactions.filter(
    r => !(r.message_id === event.message_id && r.profile_id === event.profile_id),
  )
  if (event.emoji === null) return rest
  return [...rest, { message_id: event.message_id, profile_id: event.profile_id, emoji: event.emoji }]
}

export function quotedSnippet(content: string, max = 120): string {
  const cleaned = content.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1).trimEnd()}…`
}
