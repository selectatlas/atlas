import { describe, expect, it } from 'vitest'
import { isThreadUnread, sumInbox } from '@/lib/inbox'

describe('inbox helpers', () => {
  it('marks threads unread when the latest message is from someone else after last read', () => {
    expect(
      isThreadUnread(
        { sender_id: 'other', created_at: '2026-01-02T12:00:00.000Z' },
        '2026-01-01T12:00:00.000Z',
        'me',
      ),
    ).toBe(true)
  })

  it('does not mark own messages as unread', () => {
    expect(
      isThreadUnread(
        { sender_id: 'me', created_at: '2026-01-02T12:00:00.000Z' },
        '2026-01-01T12:00:00.000Z',
        'me',
      ),
    ).toBe(false)
  })

  it('sums unread counts', () => {
    expect(sumInbox({ unreadMessages: 2, unreadApplications: 1, unreadOutreach: 3, unreadSavedSearches: 1 })).toBe(7)
  })
})
