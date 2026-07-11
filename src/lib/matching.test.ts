import { describe, expect, it } from 'vitest'
import { DEMO_JOBS, DEMO_PROFILE } from '@/lib/demo-data'
import { getJobMatchReasons, getJobMeta } from '@/lib/matching'

describe('talent job matching', () => {
  it('explains the strongest fit signals for a job', () => {
    const reasons = getJobMatchReasons(DEMO_JOBS[0], DEMO_PROFILE)

    expect(reasons).toContain('Dancer role')
    expect(reasons).toContain('Matches your Bollywood skill')
    expect(reasons).toContain('Based in London')
  })

  it('formats structured job context for the brief view', () => {
    expect(getJobMeta(DEMO_JOBS[0])).toMatchObject({
      dateLabel: '5 Dec 2026 – 6 Dec 2026',
      deadlineLabel: '20 Nov 2026',
      workTypeLabel: 'In person',
    })
  })
})
