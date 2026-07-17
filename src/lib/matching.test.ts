import { describe, expect, it } from 'vitest'
import { DEMO_JOBS, DEMO_PROFILE } from '@/lib/demo-data'
import { buildApplicationNote, getJobMatchReasons, getJobMeta } from '@/lib/matching'

describe('talent job matching', () => {
  it('explains the strongest fit signals for a job', () => {
    const reasons = getJobMatchReasons(DEMO_JOBS[0], DEMO_PROFILE)

    expect(reasons).toContain('Dancer role')
    expect(reasons).toContain('Matches your Bollywood skill')
    expect(reasons).toContain('Based in London')
  })

  it('drafts an application note that references a matching skill', () => {
    const note = buildApplicationNote(DEMO_JOBS[0], DEMO_PROFILE)

    expect(note).toContain(`considered for ${DEMO_JOBS[0].title}`)
    expect(note).toContain('my experience in Bollywood')
  })

  it('drafts a generic application note when no profile is available', () => {
    const note = buildApplicationNote(DEMO_JOBS[0], null)

    expect(note).toContain("Hi, I'm there")
    expect(note).not.toContain('my experience in')
  })

  it('formats structured job context for the brief view', () => {
    expect(getJobMeta(DEMO_JOBS[0])).toMatchObject({
      dateLabel: '5 Dec 2026 – 6 Dec 2026',
      deadlineLabel: '20 Nov 2026',
      workTypeLabel: 'In person',
    })
  })
})
