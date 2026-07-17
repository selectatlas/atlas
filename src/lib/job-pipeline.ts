import type { ApplicationStatus } from '@/types'

/**
 * Presentation-layer pipeline model for a hirer's job detail screen.
 * Purely derived from existing application statuses - no schema involved.
 */

export type PipelineStage = 'post' | 'review' | 'shortlist' | 'hire'

export const PIPELINE_STEPS: ReadonlyArray<{ stage: PipelineStage; label: string }> = [
  { stage: 'post', label: 'Post' },
  { stage: 'review', label: 'Review applicants' },
  { stage: 'shortlist', label: 'Shortlist' },
  { stage: 'hire', label: 'Hire' },
]

/** The furthest stage the job has reached, derived from its applications. */
export function derivePipelineStage(statuses: ApplicationStatus[]): PipelineStage {
  if (statuses.includes('hired')) return 'hire'
  if (statuses.includes('shortlisted')) return 'shortlist'
  if (statuses.length > 0) return 'review'
  return 'post'
}

export function pipelineStageIndex(stage: PipelineStage): number {
  return PIPELINE_STEPS.findIndex(step => step.stage === stage)
}

export type ApplicantTab = 'all' | 'viewed' | 'responded' | 'shortlisted' | 'hired' | 'declined'

export const APPLICANT_TABS: ReadonlyArray<{ tab: ApplicantTab; label: string }> = [
  { tab: 'all', label: 'All' },
  { tab: 'viewed', label: 'Viewed' },
  { tab: 'responded', label: 'Responded' },
  { tab: 'shortlisted', label: 'Shortlisted' },
  { tab: 'hired', label: 'Hired' },
  { tab: 'declined', label: 'Declined' },
]

export function applicationMatchesTab(status: ApplicationStatus, tab: ApplicantTab): boolean {
  if (tab === 'all') return true
  return status === tab
}

export function countApplicantsByTab(statuses: ApplicationStatus[]): Record<ApplicantTab, number> {
  const counts: Record<ApplicantTab, number> = {
    all: statuses.length,
    viewed: 0,
    responded: 0,
    shortlisted: 0,
    hired: 0,
    declined: 0,
  }
  for (const status of statuses) {
    if (status !== 'sent') {
      counts[status] += 1
    }
  }
  return counts
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  sent: 'Applied',
  viewed: 'Viewed',
  responded: 'Responded',
  shortlisted: 'Shortlisted',
  hired: 'Hired',
  declined: 'Declined',
}
