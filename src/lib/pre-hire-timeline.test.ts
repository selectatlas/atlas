import { describe, expect, it } from 'vitest'
import { buildPreHireTimeline } from '@/lib/pre-hire-timeline'

describe('buildPreHireTimeline', () => {
  it('returns no stages for threads with no linked outreach or application', () => {
    expect(buildPreHireTimeline({ outreach_id: null, application_status: null })).toEqual([])
    expect(buildPreHireTimeline({})).toEqual([])
  })

  it('starts at "Outreach sent" for outreach-origin threads', () => {
    const stages = buildPreHireTimeline({ outreach_id: 'o1', outreach_status: 'sent' })
    expect(stages.map(s => s.label)).toEqual(['Outreach sent', 'Replied', 'Shortlisted', 'Hired'])
    expect(stages[0]).toMatchObject({ complete: true, current: true })
    expect(stages.slice(1).every(s => !s.complete && !s.current)).toBe(true)
  })

  it('starts at "Applied" for application-origin threads', () => {
    const stages = buildPreHireTimeline({ outreach_id: null, application_status: 'sent' })
    expect(stages[0]).toMatchObject({ label: 'Applied', complete: true, current: true })
    expect(stages[1].complete).toBe(false)
  })

  it('does not count a viewed application as replied', () => {
    const stages = buildPreHireTimeline({ application_status: 'viewed' })
    expect(stages[1]).toMatchObject({ key: 'replied', complete: false })
    expect(stages[0].current).toBe(true)
  })

  it('marks replied when the outreach got a response', () => {
    const stages = buildPreHireTimeline({ outreach_id: 'o1', outreach_status: 'responded' })
    expect(stages[1]).toMatchObject({ key: 'replied', complete: true, current: true })
    expect(stages[2].complete).toBe(false)
  })

  it('marks replied when the application got a response', () => {
    const stages = buildPreHireTimeline({ application_status: 'responded' })
    expect(stages[1]).toMatchObject({ key: 'replied', complete: true, current: true })
  })

  it('completes earlier stages when shortlisted', () => {
    const stages = buildPreHireTimeline({ application_status: 'shortlisted' })
    expect(stages.map(s => s.complete)).toEqual([true, true, true, false])
    expect(stages[2].current).toBe(true)
  })

  it('completes every stage when hired', () => {
    const stages = buildPreHireTimeline({ outreach_id: 'o1', outreach_status: 'responded', application_status: 'hired' })
    expect(stages.every(s => s.complete)).toBe(true)
    expect(stages[3].current).toBe(true)
    expect(stages.filter(s => s.current)).toHaveLength(1)
  })
})
