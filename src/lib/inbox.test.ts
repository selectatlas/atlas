import { describe, expect, it } from 'vitest'
import { isThreadUnread, isYourMove, sumInbox } from '@/lib/inbox'

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

  it('is your move when the thread is unread', () => {
    expect(isYourMove({ sender_id: 'other' }, true, 'me')).toBe(true)
  })

  it('stays your move after reading if the other side sent last', () => {
    expect(isYourMove({ sender_id: 'other' }, false, 'me')).toBe(true)
  })

  it('is not your move once you sent the latest message', () => {
    expect(isYourMove({ sender_id: 'me' }, false, 'me')).toBe(false)
  })

  it('is not your move without a message or a user', () => {
    expect(isYourMove(null, false, 'me')).toBe(false)
    expect(isYourMove({ sender_id: '' }, false, 'me')).toBe(false)
    expect(isYourMove({ sender_id: 'other' }, false, null)).toBe(false)
  })

  it('sums unread counts', () => {
    expect(sumInbox({ unreadMessages: 2, unreadApplications: 1, unreadOutreach: 3, unreadSavedSearches: 1 })).toBe(7)
  })
})
