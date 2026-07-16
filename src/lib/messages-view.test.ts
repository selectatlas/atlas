import { describe, expect, it } from 'vitest'
import {
  isSeen,
  lastOwnMessageId,
  groupMessagesByDay,
  formatDayLabel,
  formatThreadTime,
} from '@/lib/messages-view'

const msg = (id: string, sender: string, createdAt: string) => ({
  id,
  content: `message ${id}`,
  sender_id: sender,
  created_at: createdAt,
})

describe('isSeen', () => {
  it('is seen when the other participant read at or after the message time', () => {
    expect(isSeen({ created_at: '2026-01-02T12:00:00.000Z' }, '2026-01-02T12:00:00.000Z')).toBe(true)
    expect(isSeen({ created_at: '2026-01-02T12:00:00.000Z' }, '2026-01-02T13:00:00.000Z')).toBe(true)
  })

  it('is not seen when the other participant read before the message', () => {
    expect(isSeen({ created_at: '2026-01-02T12:00:00.000Z' }, '2026-01-02T11:00:00.000Z')).toBe(false)
  })

  it('is not seen without a message or read timestamp', () => {
    expect(isSeen(null, '2026-01-02T12:00:00.000Z')).toBe(false)
    expect(isSeen({ created_at: '2026-01-02T12:00:00.000Z' }, null)).toBe(false)
  })
})

describe('lastOwnMessageId', () => {
  it('finds the latest message sent by the user', () => {
    const messages = [
      msg('1', 'me', '2026-01-01T10:00:00.000Z'),
      msg('2', 'other', '2026-01-01T11:00:00.000Z'),
      msg('3', 'me', '2026-01-01T12:00:00.000Z'),
      msg('4', 'other', '2026-01-01T13:00:00.000Z'),
    ]
    expect(lastOwnMessageId(messages, 'me')).toBe('3')
  })

  it('returns null when the user has not sent anything', () => {
    expect(lastOwnMessageId([msg('1', 'other', '2026-01-01T10:00:00.000Z')], 'me')).toBeNull()
  })
})

describe('groupMessagesByDay', () => {
  it('groups consecutive messages by calendar day', () => {
    const messages = [
      msg('1', 'me', '2026-01-01T10:00:00.000Z'),
      msg('2', 'other', '2026-01-01T11:00:00.000Z'),
      msg('3', 'me', '2026-01-02T09:00:00.000Z'),
    ]
    const groups = groupMessagesByDay(messages, new Date('2026-01-02T12:00:00.000Z'))
    expect(groups).toHaveLength(2)
    expect(groups[0].messages.map(m => m.id)).toEqual(['1', '2'])
    expect(groups[0].label).toBe('Yesterday')
    expect(groups[1].messages.map(m => m.id)).toEqual(['3'])
    expect(groups[1].label).toBe('Today')
  })

  it('returns no groups for an empty list', () => {
    expect(groupMessagesByDay([])).toEqual([])
  })
})

describe('formatDayLabel', () => {
  it('labels older days with a short date', () => {
    const label = formatDayLabel(new Date('2026-01-05T10:00:00.000Z'), new Date('2026-06-01T12:00:00.000Z'))
    expect(label).toContain('Jan')
    expect(label).toContain('5')
  })
})

describe('formatThreadTime', () => {
  it('shows a clock time within 24 hours', () => {
    const now = new Date('2026-01-02T12:00:00.000Z')
    expect(formatThreadTime('2026-01-02T09:30:00.000Z', now)).toMatch(/\d{2}:\d{2}/)
  })

  it('shows Yesterday between 24 and 48 hours', () => {
    const now = new Date('2026-01-02T12:00:00.000Z')
    expect(formatThreadTime('2026-01-01T09:30:00.000Z', now)).toBe('Yesterday')
  })

  it('shows a short date beyond 48 hours', () => {
    const now = new Date('2026-01-10T12:00:00.000Z')
    expect(formatThreadTime('2026-01-01T09:30:00.000Z', now)).toContain('Jan')
  })
})
