import { describe, it, expect } from 'vitest'
import { jobEmbeddingSourceText, parseStoredEmbedding, getTalentMatchReasons } from './job-matching'
import type { Job } from '@/types'

const job = {
  id: 'job-1',
  hirer_id: 'hirer-1',
  title: 'Contemporary dancers for music video',
  description: 'One-day shoot in London.',
  category: 'dancer',
  skills_required: ['Contemporary', 'Ballet'],
  location: 'London, UK',
  budget: '£350/day',
  status: 'open',
  created_at: '2026-07-21T00:00:00Z',
  start_date: '2026-09-07',
} as unknown as Job

describe('jobEmbeddingSourceText', () => {
  // Pins the exact concatenation embedJob writes (src/lib/job-embedding.ts).
  // If that formula changes, this test must change with it or read-time
  // fallback embeddings land in a different vector space than search expects.
  it('matches the embedJob source-text formula exactly', () => {
    expect(jobEmbeddingSourceText(job)).toBe(
      'Contemporary dancers for music video One-day shoot in London. Contemporary Ballet',
    )
  })

  it('tolerates a null skills list', () => {
    expect(jobEmbeddingSourceText({ ...job, skills_required: null as unknown as string[] })).toBe(
      'Contemporary dancers for music video One-day shoot in London. ',
    )
  })
})

describe('parseStoredEmbedding', () => {
  it('parses the pgvector JSON-array string form', () => {
    expect(parseStoredEmbedding('[0.1,0.2,0.3]')).toEqual([0.1, 0.2, 0.3])
  })

  it('passes a real number array through', () => {
    expect(parseStoredEmbedding([0.1, 0.2])).toEqual([0.1, 0.2])
  })

  it('rejects anything that is not a non-empty numeric array', () => {
    expect(parseStoredEmbedding(null)).toBeNull()
    expect(parseStoredEmbedding(undefined)).toBeNull()
    expect(parseStoredEmbedding('not json')).toBeNull()
    expect(parseStoredEmbedding('[]')).toBeNull()
    expect(parseStoredEmbedding([])).toBeNull()
    expect(parseStoredEmbedding('[0.1,"a"]')).toBeNull()
    expect(parseStoredEmbedding([0.1, Number.NaN])).toBeNull()
    expect(parseStoredEmbedding({ embedding: [0.1] })).toBeNull()
  })
})

describe('getTalentMatchReasons', () => {
  it('cites overlapping skills first', () => {
    const reasons = getTalentMatchReasons(job, {
      city: 'Manchester',
      country: 'UK',
      availability: null,
      talent_skills: [{ category: 'dancer', skill: 'Contemporary' }],
    })
    expect(reasons[0]).toBe('Skill: Contemporary')
  })

  it('matches skills case-insensitively and by substring', () => {
    const reasons = getTalentMatchReasons(job, {
      city: null,
      country: null,
      availability: null,
      talent_skills: [{ category: 'dancer', skill: 'contemporary dance' }],
    })
    expect(reasons).toContain('Skill: Contemporary')
  })

  it('credits the category, location and availability', () => {
    const reasons = getTalentMatchReasons(job, {
      city: 'London',
      country: 'UK',
      availability: 'Available September and October',
      talent_skills: [{ category: 'dancer', skill: 'Ballet' }],
    })
    expect(reasons).toContain('Dancer talent')
    expect(reasons).toContain('Based in London')
    expect(reasons).toHaveLength(3)
  })

  it('returns an empty list when nothing concrete lines up', () => {
    expect(
      getTalentMatchReasons(job, {
        city: 'Berlin',
        country: 'Germany',
        availability: null,
        talent_skills: [{ category: 'actor', skill: 'Voice acting' }],
      }),
    ).toEqual([])
  })

  it('caps reasons at three', () => {
    const reasons = getTalentMatchReasons(job, {
      city: 'London',
      country: 'UK',
      availability: 'September',
      talent_skills: [
        { category: 'dancer', skill: 'Contemporary' },
        { category: 'dancer', skill: 'Ballet' },
      ],
    })
    expect(reasons.length).toBeLessThanOrEqual(3)
  })
})
