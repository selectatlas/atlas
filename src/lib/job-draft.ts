import { SKILLS_BY_CATEGORY, CATEGORY_LABELS } from '@/lib/skills'
import { cleanOptionalDate } from '@/lib/validation'
import type { Category, JobWorkType } from '@/types'

// A job brief drafted by the model from one sentence of hirer intent. Shape
// mirrors the POST /api/jobs body so the review form can prefill directly.
// Nothing here is trusted: the model fills it, `coerceJobDraft` sanitises it,
// and POST /api/jobs validates it again before anything is written.
export interface JobDraft {
  title: string | null
  description: string | null
  category: Category | null
  skills_required: string[]
  location: string | null
  budget: string | null
  work_type: JobWorkType | null
  start_date: string | null
  end_date: string | null
  application_deadline: string | null
  duration: string | null
  usage_rights: string | null
  travel_required: boolean | null
}

export const EMPTY_JOB_DRAFT: JobDraft = {
  title: null,
  description: null,
  category: null,
  skills_required: [],
  location: null,
  budget: null,
  work_type: null,
  start_date: null,
  end_date: null,
  application_deadline: null,
  duration: null,
  usage_rights: null,
  travel_required: null,
}

const CATEGORIES = Object.keys(SKILLS_BY_CATEGORY) as Category[]
const WORK_TYPES: JobWorkType[] = ['in_person', 'hybrid', 'remote']

// Field caps match the POST /api/jobs validation limits, so a draft that
// survives coercion can always be posted without a second round of edits.
const TITLE_MAX = 200
const DESCRIPTION_MAX = 5000
const LOCATION_MAX = 200
const BUDGET_MAX = 100
const DURATION_MAX = 200
const USAGE_RIGHTS_MAX = 500
const MAX_SKILLS = 20
const SKILL_MAX = 50

// Over-long model output is truncated rather than dropped: the hirer reviews
// and edits every field before posting, so a clipped sentence is recoverable
// where a silently emptied field is not.
function cleanDraftString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trim() : trimmed
}

export function buildJobDraftSystemPrompt(today: string): string {
  const categoryList = CATEGORIES.map(category => `"${category}" (${CATEGORY_LABELS[category]})`).join(', ')
  return `You turn a hirer's one-line brief into a job post for a creative-industry casting platform (dancers, actors, photographers/videographers, content creators).

Today's date is ${today}. Resolve any relative timing ("first week of September", "next month") to a real calendar date in that context, always in the future.

Return a JSON object with exactly these keys:
- title: a concise professional job title, max ${TITLE_MAX} characters
- description: 2 to 4 sentences expanding the brief into a clear role description, max ${DESCRIPTION_MAX} characters
- category: one of ${categoryList}, or null
- skills_required: array of specific skills or styles named or clearly implied by the brief (e.g. ["Contemporary", "Ballet"]), max ${MAX_SKILLS} items
- location: city or region string, or null
- budget: budget as written by the hirer (e.g. "£350/day"), or null
- work_type: one of "in_person", "hybrid", "remote", or null
- start_date: YYYY-MM-DD, or null
- end_date: YYYY-MM-DD, or null
- application_deadline: YYYY-MM-DD, or null
- duration: short free-text length of engagement (e.g. "2 rehearsal days + 1 shoot day"), or null
- usage_rights: short free-text usage/licensing terms, or null
- travel_required: true or false only when the brief makes it clear, otherwise null

Write the title and description yourself: they should read as a professional casting brief. Every other field must be extracted only from what the hirer stated or clearly implied - never invent a location, budget, date, or requirement. Use null when the brief does not say. Do not use em dashes.`
}

// Maps model-supplied skills onto the platform's canonical casing where they
// match a known skill for the category, and keeps unrecognised ones as typed:
// the manual form allows custom skills, so a draft must be able to too.
export function canonicalizeSkills(skills: string[], category: Category | null): string[] {
  const canonical = category ? SKILLS_BY_CATEGORY[category] : []
  const byLower = new Map(canonical.map(skill => [skill.toLowerCase(), skill]))
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of skills) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (trimmed.length === 0 || trimmed.length > SKILL_MAX) continue
    const lower = trimmed.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    result.push(byLower.get(lower) ?? trimmed)
    if (result.length >= MAX_SKILLS) break
  }

  return result
}

export function coerceJobDraft(raw: unknown): JobDraft {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...EMPTY_JOB_DRAFT }
  const input = raw as Record<string, unknown>

  const category = CATEGORIES.includes(input.category as Category) ? (input.category as Category) : null
  const workType = WORK_TYPES.includes(input.work_type as JobWorkType) ? (input.work_type as JobWorkType) : null

  // Dates go through the same strict YYYY-MM-DD calendar check the jobs route
  // uses, so a hallucinated "2026-13-40" or "next week" becomes null here
  // rather than a 400 at post time.
  const startDate = cleanOptionalDate(input.start_date)
  const endDate = cleanOptionalDate(input.end_date)
  const deadline = cleanOptionalDate(input.application_deadline)

  return {
    title: cleanDraftString(input.title, TITLE_MAX),
    description: cleanDraftString(input.description, DESCRIPTION_MAX),
    category,
    skills_required: canonicalizeSkills(Array.isArray(input.skills_required) ? input.skills_required : [], category),
    location: cleanDraftString(input.location, LOCATION_MAX),
    budget: cleanDraftString(input.budget, BUDGET_MAX),
    work_type: workType,
    start_date: startDate.ok ? startDate.value : null,
    end_date: endDate.ok ? endDate.value : null,
    application_deadline: deadline.ok ? deadline.value : null,
    duration: cleanDraftString(input.duration, DURATION_MAX),
    usage_rights: cleanDraftString(input.usage_rights, USAGE_RIGHTS_MAX),
    travel_required: typeof input.travel_required === 'boolean' ? input.travel_required : null,
  }
}
