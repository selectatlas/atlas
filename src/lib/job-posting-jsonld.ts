import { SITE_URL } from '@/lib/site'
import type { Job } from '@/types'

// Schema.org JobPosting for public job detail pages - what gets Atlas jobs
// into Google Jobs. Maps directly from the public_open_jobs view row.

export type PublicJobRow = Job & { hirer_name: string | null }

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// JSON.stringify does not escape "</script>", so hirer-controlled strings
// (title, location, ...) could otherwise break out of the inline
// <script type="application/ld+json"> element. Escaping every "<" keeps the
// payload inert in an HTML context while staying valid JSON.
export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function buildJobPostingJsonLd(job: PublicJobRow): Record<string, unknown> {
  // Google wants HTML in description; wrap plain-text paragraphs in <p>.
  const description = job.description
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description,
    datePosted: job.created_at.slice(0, 10),
    // Gig-marketplace briefs are engagements, not employment.
    employmentType: 'CONTRACTOR',
    hiringOrganization: { '@type': 'Organization', name: job.hirer_name ?? 'Atlas hirer' },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: job.location, addressCountry: 'GB' },
    },
    identifier: { '@type': 'PropertyValue', name: 'Atlas', value: job.id },
    url: `${SITE_URL}/jobs/${job.id}`,
    directApply: true,
  }

  const validThrough = job.application_deadline ?? job.end_date
  if (validThrough) jsonLd.validThrough = validThrough

  if (job.work_type === 'remote') {
    jsonLd.jobLocationType = 'TELECOMMUTE'
    jsonLd.applicantLocationRequirements = { '@type': 'Country', name: 'UK' }
  }

  if (job.budget_min != null || job.budget_max != null) {
    // Budgets are day rates ("£300 per day") - mirrors parseBudgetRange/021.
    jsonLd.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'GBP',
      value: {
        '@type': 'QuantitativeValue',
        ...(job.budget_min != null ? { minValue: job.budget_min } : {}),
        ...(job.budget_max != null ? { maxValue: job.budget_max } : {}),
        unitText: 'DAY',
      },
    }
  }

  return jsonLd
}
