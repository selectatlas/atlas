import { describe, it, expect } from 'vitest'
import {
  APPLICANT_TABS,
  PIPELINE_STEPS,
  applicationMatchesTab,
  countApplicantsByTab,
  derivePipelineStage,
  pipelineStageIndex,
} from './job-pipeline'
import type { ApplicationStatus } from '@/types'

describe('derivePipelineStage', () => {
  it('returns post when there are no applications', () => {
    expect(derivePipelineStage([])).toBe('post')
  })

  it('returns review when applications exist but none are shortlisted or hired', () => {
    expect(derivePipelineStage(['sent'])).toBe('review')
    expect(derivePipelineStage(['sent', 'viewed', 'responded'])).toBe('review')
  })

  it('returns shortlist when at least one application is shortlisted', () => {
    expect(derivePipelineStage(['sent', 'shortlisted', 'viewed'])).toBe('shortlist')
  })

  it('returns hire when at least one application is hired, even alongside shortlisted', () => {
    expect(derivePipelineStage(['shortlisted', 'hired', 'sent'])).toBe('hire')
  })
})

describe('pipelineStageIndex', () => {
  it('orders stages post, review, shortlist, hire', () => {
    expect(pipelineStageIndex('post')).toBe(0)
    expect(pipelineStageIndex('review')).toBe(1)
    expect(pipelineStageIndex('shortlist')).toBe(2)
    expect(pipelineStageIndex('hire')).toBe(3)
  })

  it('covers every defined step', () => {
    for (const step of PIPELINE_STEPS) {
      expect(pipelineStageIndex(step.stage)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('applicationMatchesTab', () => {
  it('matches every status on the all tab', () => {
    const statuses: ApplicationStatus[] = ['sent', 'viewed', 'responded', 'shortlisted', 'hired']
    for (const status of statuses) {
      expect(applicationMatchesTab(status, 'all')).toBe(true)
    }
  })

  it('matches only the exact status on a specific tab', () => {
    expect(applicationMatchesTab('shortlisted', 'shortlisted')).toBe(true)
    expect(applicationMatchesTab('viewed', 'shortlisted')).toBe(false)
    expect(applicationMatchesTab('sent', 'viewed')).toBe(false)
    expect(applicationMatchesTab('hired', 'hired')).toBe(true)
  })
})

describe('countApplicantsByTab', () => {
  it('returns zeros for an empty list', () => {
    expect(countApplicantsByTab([])).toEqual({
      all: 0,
      viewed: 0,
      responded: 0,
      shortlisted: 0,
      hired: 0,
    })
  })

  it('counts each tab and includes sent applications only in all', () => {
    const statuses: ApplicationStatus[] = [
      'sent',
      'sent',
      'viewed',
      'responded',
      'responded',
      'shortlisted',
      'hired',
    ]
    expect(countApplicantsByTab(statuses)).toEqual({
      all: 7,
      viewed: 1,
      responded: 2,
      shortlisted: 1,
      hired: 1,
    })
  })

  it('has a tab definition for every counted key', () => {
    const counts = countApplicantsByTab([])
    for (const { tab } of APPLICANT_TABS) {
      expect(counts[tab]).toBe(0)
    }
  })
})
