import { describe, it, expect } from 'vitest'
import {
  SYSTEM_MESSAGE_KINDS,
  isSystemMessageKind,
  systemCardTitle,
  buildSystemMessageContent,
} from './system-messages'

describe('isSystemMessageKind', () => {
  it('accepts every system kind', () => {
    for (const kind of SYSTEM_MESSAGE_KINDS) {
      expect(isSystemMessageKind(kind)).toBe(true)
    }
  })

  it('rejects text, unknown kinds and missing values', () => {
    expect(isSystemMessageKind('text')).toBe(false)
    expect(isSystemMessageKind('payment_released')).toBe(false)
    expect(isSystemMessageKind(null)).toBe(false)
    expect(isSystemMessageKind(undefined)).toBe(false)
    expect(isSystemMessageKind('')).toBe(false)
  })
})

describe('systemCardTitle', () => {
  it('has a title for every system kind', () => {
    expect(systemCardTitle('application_received')).toBe('Application received')
    expect(systemCardTitle('outreach_sent')).toBe('Outreach sent')
    expect(systemCardTitle('application_shortlisted')).toBe('Shortlisted')
    expect(systemCardTitle('application_hired')).toBe('Hired')
  })
})

describe('buildSystemMessageContent', () => {
  it('includes the job title when available', () => {
    expect(buildSystemMessageContent('application_received', { jobTitle: 'West End Revival' }))
      .toBe('Applied to West End Revival')
    expect(buildSystemMessageContent('outreach_sent', { jobTitle: 'West End Revival' }))
      .toBe('Reached out about West End Revival')
    expect(buildSystemMessageContent('application_shortlisted', { jobTitle: 'West End Revival' }))
      .toBe('Shortlisted for West End Revival')
    expect(buildSystemMessageContent('application_hired', { jobTitle: 'West End Revival' }))
      .toBe('Hired for West End Revival')
  })

  it('falls back to a generic sentence without a job title', () => {
    expect(buildSystemMessageContent('application_received')).toBe('Submitted an application')
    expect(buildSystemMessageContent('outreach_sent', { jobTitle: null }))
      .toBe('Reached out to start a conversation')
    expect(buildSystemMessageContent('application_shortlisted', { jobTitle: '  ' }))
      .toBe('Application shortlisted')
    expect(buildSystemMessageContent('application_hired', { jobTitle: '' }))
      .toBe('Hired for this role')
  })
})
