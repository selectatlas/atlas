// Pre-hire stage timeline for the messages context rail. Derives the
// Upwork-style vertical stepper (Outreach sent / Applied -> Replied ->
// Shortlisted -> Hired) from the thread's linked outreach and application
// statuses. Pure so it is unit-testable without Supabase.

export type PreHireStageKey = 'started' | 'replied' | 'shortlisted' | 'hired'

export type PreHireStage = {
  key: PreHireStageKey
  label: string
  complete: boolean
  current: boolean
}

export type PreHireOrigin = {
  outreach_id?: string | null
  outreach_status?: string | null
  application_status?: string | null
}

const REPLIED_APPLICATION_STATUSES = ['responded', 'shortlisted', 'hired']
const SHORTLISTED_APPLICATION_STATUSES = ['shortlisted', 'hired']

// Returns [] when the thread has no linked outreach or application, so
// callers can skip rendering the timeline entirely.
export function buildPreHireTimeline(origin: PreHireOrigin): PreHireStage[] {
  const hasOutreach = Boolean(origin.outreach_id)
  const applicationStatus = origin.application_status ?? null
  if (!hasOutreach && !applicationStatus) return []

  const replied =
    origin.outreach_status === 'responded' ||
    (applicationStatus !== null && REPLIED_APPLICATION_STATUSES.includes(applicationStatus))
  const shortlisted =
    applicationStatus !== null && SHORTLISTED_APPLICATION_STATUSES.includes(applicationStatus)
  const hired = applicationStatus === 'hired'

  const stages: Array<Omit<PreHireStage, 'current'>> = [
    { key: 'started', label: hasOutreach ? 'Outreach sent' : 'Applied', complete: true },
    { key: 'replied', label: 'Replied', complete: replied || shortlisted || hired },
    { key: 'shortlisted', label: 'Shortlisted', complete: shortlisted || hired },
    { key: 'hired', label: 'Hired', complete: hired },
  ]

  // The current stage is the furthest completed one.
  let currentIndex = 0
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].complete) currentIndex = i
  }

  return stages.map((stage, i) => ({ ...stage, current: i === currentIndex }))
}
