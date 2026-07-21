import { describe, expect, it } from 'vitest'
import {
  aggregateReactions,
  applyReactionEvent,
  isReactionEmoji,
  myReactionFor,
  quotedSnippet,
  REACTION_EMOJIS,
  type MessageReaction,
} from './reactions'

const reactions: MessageReaction[] = [
  { message_id: 'm1', profile_id: 'alice', emoji: '👍' },
  { message_id: 'm1', profile_id: 'bob', emoji: '👍' },
  { message_id: 'm1', profile_id: 'cara', emoji: '❤️' },
  { message_id: 'm2', profile_id: 'alice', emoji: '🎉' },
]

describe('isReactionEmoji', () => {
  it('accepts the canonical set', () => {
    for (const emoji of REACTION_EMOJIS) {
      expect(isReactionEmoji(emoji)).toBe(true)
    }
  })

  it('rejects other values', () => {
    expect(isReactionEmoji('🔥')).toBe(false)
    expect(isReactionEmoji('')).toBe(false)
    expect(isReactionEmoji(null)).toBe(false)
    expect(isReactionEmoji(42)).toBe(false)
  })
})

describe('aggregateReactions', () => {
  it('groups counts per emoji for one message in canonical order', () => {
    expect(aggregateReactions(reactions, 'm1', 'bob')).toEqual([
      { emoji: '👍', count: 2, mine: true },
      { emoji: '❤️', count: 1, mine: false },
    ])
  })

  it('returns empty for a message without reactions', () => {
    expect(aggregateReactions(reactions, 'm3', 'alice')).toEqual([])
  })

  it('marks nothing mine when userId is null', () => {
    const pills = aggregateReactions(reactions, 'm1', null)
    expect(pills.every(p => !p.mine)).toBe(true)
  })
})

describe('myReactionFor', () => {
  it('returns the user reaction when present', () => {
    expect(myReactionFor(reactions, 'm1', 'cara')).toBe('❤️')
  })

  it('returns null when absent or signed out', () => {
    expect(myReactionFor(reactions, 'm2', 'bob')).toBeNull()
    expect(myReactionFor(reactions, 'm1', null)).toBeNull()
  })
})

describe('applyReactionEvent', () => {
  it('adds a new reaction', () => {
    const next = applyReactionEvent(reactions, { message_id: 'm2', profile_id: 'bob', emoji: '😂' })
    expect(next).toContainEqual({ message_id: 'm2', profile_id: 'bob', emoji: '😂' })
    expect(next).toHaveLength(reactions.length + 1)
  })

  it('replaces an existing reaction from the same user', () => {
    const next = applyReactionEvent(reactions, { message_id: 'm1', profile_id: 'alice', emoji: '🎉' })
    expect(next.filter(r => r.message_id === 'm1' && r.profile_id === 'alice')).toEqual([
      { message_id: 'm1', profile_id: 'alice', emoji: '🎉' },
    ])
    expect(next).toHaveLength(reactions.length)
  })

  it('removes on null emoji', () => {
    const next = applyReactionEvent(reactions, { message_id: 'm1', profile_id: 'alice', emoji: null })
    expect(next.some(r => r.message_id === 'm1' && r.profile_id === 'alice')).toBe(false)
    expect(next).toHaveLength(reactions.length - 1)
  })

  it('does not mutate the input array', () => {
    const before = [...reactions]
    applyReactionEvent(reactions, { message_id: 'm1', profile_id: 'alice', emoji: null })
    expect(reactions).toEqual(before)
  })
})

describe('quotedSnippet', () => {
  it('collapses whitespace and trims', () => {
    expect(quotedSnippet('  hello\n\n  world  ')).toBe('hello world')
  })

  it('truncates long content with an ellipsis', () => {
    const long = 'a'.repeat(200)
    const snippet = quotedSnippet(long)
    expect(snippet.length).toBeLessThanOrEqual(120)
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('leaves short content untouched', () => {
    expect(quotedSnippet('short')).toBe('short')
  })
})
