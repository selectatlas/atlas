import { describe, expect, it } from 'vitest'
import { buildJobPostingJsonLd, serializeJsonLd, type PublicJobRow } from './job-posting-jsonld'

function makeJob(overrides: Partial<PublicJobRow> = {}): PublicJobRow {
  return {
    id: '40000000-0000-0000-0000-000000000004',
    hirer_id: '10000000-0000-0000-0000-000000000001',
    title: 'Commercial dancer',
    description: 'Two-day shoot in London.\n\nRehearsal on day one.',
    category: 'dancer',
    skills_required: ['hip hop'],
    location: 'London',
    budget: '£300 per day',
    budget_min: 300,
    budget_max: 300,
    status: 'open',
    created_at: '2026-07-01T09:30:00+00:00',
    hirer_name: 'Riverside Studios',
    ...overrides,
  }
}

describe('buildJobPostingJsonLd', () => {
  it('maps the core JobPosting fields', () => {
    const jsonLd = buildJobPostingJsonLd(makeJob())
    expect(jsonLd['@type']).toBe('JobPosting')
    expect(jsonLd.title).toBe('Commercial dancer')
    expect(jsonLd.datePosted).toBe('2026-07-01')
    expect(jsonLd.employmentType).toBe('CONTRACTOR')
    expect(jsonLd.hiringOrganization).toEqual({ '@type': 'Organization', name: 'Riverside Studios' })
    expect(jsonLd.jobLocation).toMatchObject({ address: { addressLocality: 'London', addressCountry: 'GB' } })
    expect(jsonLd.url).toContain('/jobs/40000000-0000-0000-0000-000000000004')
    expect(jsonLd.directApply).toBe(true)
  })

  it('wraps description paragraphs in escaped HTML', () => {
    const jsonLd = buildJobPostingJsonLd(makeJob({ description: 'Line <one> & two.\nLine three.' }))
    expect(jsonLd.description).toBe('<p>Line &lt;one&gt; &amp; two.</p><p>Line three.</p>')
  })

  it('prefers application_deadline over end_date for validThrough and omits when absent', () => {
    expect(
      buildJobPostingJsonLd(makeJob({ application_deadline: '2026-08-01', end_date: '2026-09-01' })).validThrough
    ).toBe('2026-08-01')
    expect(buildJobPostingJsonLd(makeJob({ application_deadline: null, end_date: '2026-09-01' })).validThrough).toBe(
      '2026-09-01'
    )
    expect(buildJobPostingJsonLd(makeJob())).not.toHaveProperty('validThrough')
  })

  it('marks remote jobs as TELECOMMUTE', () => {
    const jsonLd = buildJobPostingJsonLd(makeJob({ work_type: 'remote' }))
    expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
    expect(jsonLd.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'UK' })
    expect(buildJobPostingJsonLd(makeJob())).not.toHaveProperty('jobLocationType')
  })

  it('includes baseSalary only when budget bounds exist', () => {
    expect(buildJobPostingJsonLd(makeJob()).baseSalary).toMatchObject({
      currency: 'GBP',
      value: { minValue: 300, maxValue: 300, unitText: 'DAY' },
    })
    expect(
      buildJobPostingJsonLd(makeJob({ budget: null, budget_min: null, budget_max: null }))
    ).not.toHaveProperty('baseSalary')
  })

  it('falls back to a generic organization name when the hirer has none', () => {
    expect(buildJobPostingJsonLd(makeJob({ hirer_name: null })).hiringOrganization).toEqual({
      '@type': 'Organization',
      name: 'Atlas hirer',
    })
  })
})

describe('serializeJsonLd', () => {
  it('neutralizes </script> breakouts in hirer-controlled strings', () => {
    const serialized = serializeJsonLd(
      buildJobPostingJsonLd(makeJob({ title: '</script><script>alert(1)</script>' }))
    )
    expect(serialized).not.toContain('</script>')
    expect(serialized).toContain('\\u003c/script')
    // Still valid JSON with the original value intact.
    expect(JSON.parse(serialized).title).toBe('</script><script>alert(1)</script>')
  })
})
