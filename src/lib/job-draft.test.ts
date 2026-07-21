import { describe, it, expect } from 'vitest'
import { buildJobDraftSystemPrompt, canonicalizeSkills, coerceJobDraft, EMPTY_JOB_DRAFT } from './job-draft'

const validRaw = {
  title: 'Contemporary dancers for music video',
  description: 'We are casting three contemporary dancers for a one-day music video shoot in London.',
  category: 'dancer',
  skills_required: ['Contemporary', 'Ballet'],
  location: 'London, UK',
  budget: '£350/day',
  work_type: 'in_person',
  start_date: '2026-09-07',
  end_date: '2026-09-08',
  application_deadline: '2026-08-25',
  duration: '1 shoot day',
  usage_rights: 'Social and tour visuals, 12 months',
  travel_required: false,
}

describe('coerceJobDraft', () => {
  it('passes a well-formed draft through unchanged', () => {
    expect(coerceJobDraft(validRaw)).toEqual(validRaw)
  })

  it('returns an empty draft for non-object input', () => {
    expect(coerceJobDraft(null)).toEqual(EMPTY_JOB_DRAFT)
    expect(coerceJobDraft('a string')).toEqual(EMPTY_JOB_DRAFT)
    expect(coerceJobDraft(['an', 'array'])).toEqual(EMPTY_JOB_DRAFT)
    expect(coerceJobDraft(undefined)).toEqual(EMPTY_JOB_DRAFT)
  })

  it('nulls a category outside the platform taxonomy', () => {
    expect(coerceJobDraft({ ...validRaw, category: 'musician' }).category).toBeNull()
    expect(coerceJobDraft({ ...validRaw, category: 'actor' }).category).toBe('actor')
  })

  it('nulls a work type outside the allowed values', () => {
    expect(coerceJobDraft({ ...validRaw, work_type: 'onsite' }).work_type).toBeNull()
    expect(coerceJobDraft({ ...validRaw, work_type: 'remote' }).work_type).toBe('remote')
  })

  it('rejects dates that are not real YYYY-MM-DD calendar dates', () => {
    expect(coerceJobDraft({ ...validRaw, start_date: 'next week' }).start_date).toBeNull()
    expect(coerceJobDraft({ ...validRaw, start_date: '2026-13-40' }).start_date).toBeNull()
    expect(coerceJobDraft({ ...validRaw, start_date: '2026-02-30' }).start_date).toBeNull()
    expect(coerceJobDraft({ ...validRaw, start_date: '2026-09-07' }).start_date).toBe('2026-09-07')
  })

  it('only accepts a real boolean for travel_required', () => {
    expect(coerceJobDraft({ ...validRaw, travel_required: 'yes' }).travel_required).toBeNull()
    expect(coerceJobDraft({ ...validRaw, travel_required: true }).travel_required).toBe(true)
  })

  it('truncates over-long strings instead of dropping the field', () => {
    const draft = coerceJobDraft({ ...validRaw, title: 'x'.repeat(250) })
    expect(draft.title).toHaveLength(200)
  })

  it('nulls empty and non-string fields', () => {
    const draft = coerceJobDraft({ ...validRaw, title: '   ', location: 42 })
    expect(draft.title).toBeNull()
    expect(draft.location).toBeNull()
  })

  it('defaults skills to an empty array when absent or malformed', () => {
    expect(coerceJobDraft({ ...validRaw, skills_required: undefined }).skills_required).toEqual([])
    expect(coerceJobDraft({ ...validRaw, skills_required: 'Contemporary' }).skills_required).toEqual([])
  })
})

describe('canonicalizeSkills', () => {
  it('maps known skills to the platform casing for the category', () => {
    expect(canonicalizeSkills(['bollywood', 'KRUMPING'], 'dancer')).toEqual(['Bollywood', 'KRUMPING'])
    expect(canonicalizeSkills(['contemporary'], 'dancer')).toEqual(['Contemporary'])
  })

  it('keeps unrecognised custom skills as typed', () => {
    expect(canonicalizeSkills(['Aerial silks'], 'dancer')).toEqual(['Aerial silks'])
  })

  it('leaves skills untouched when no category is known', () => {
    expect(canonicalizeSkills(['contemporary'], null)).toEqual(['contemporary'])
  })

  it('dedupes case-insensitively', () => {
    expect(canonicalizeSkills(['Ballet', 'ballet', 'BALLET'], 'dancer')).toEqual(['Ballet'])
  })

  it('drops empty and over-long skills and caps the list at 20', () => {
    expect(canonicalizeSkills(['  ', 'x'.repeat(51), 'Jazz'], 'dancer')).toEqual(['Jazz'])
    const many = Array.from({ length: 30 }, (_, i) => `Skill ${i}`)
    expect(canonicalizeSkills(many, 'dancer')).toHaveLength(20)
  })
})

describe('buildJobDraftSystemPrompt', () => {
  it('injects the current date so relative timing resolves', () => {
    expect(buildJobDraftSystemPrompt('2026-07-21')).toContain('2026-07-21')
  })

  it('enumerates every draft key the coercer expects', () => {
    const prompt = buildJobDraftSystemPrompt('2026-07-21')
    for (const key of Object.keys(EMPTY_JOB_DRAFT)) {
      expect(prompt).toContain(key)
    }
  })

  it('lists the four platform categories and three work types', () => {
    const prompt = buildJobDraftSystemPrompt('2026-07-21')
    for (const category of ['dancer', 'actor', 'photographer_videographer', 'content_creator']) {
      expect(prompt).toContain(category)
    }
    for (const workType of ['in_person', 'hybrid', 'remote']) {
      expect(prompt).toContain(workType)
    }
  })
})
