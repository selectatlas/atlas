// Suggested searches shown as chips when the search input is focused and
// empty, and in the no-results empty state. Every query is engineered to
// return strong matches from the demo world seeded in `src/lib/seed/data.ts`
// (Bollywood dancers, combat actors, food creators, contemporary dancers,
// videographers). Keep these in sync with the demo-critical seed scenarios.

import type { SearchScope } from '@/lib/search-scope'

export interface SuggestedSearch {
  /** Short chip label shown in the UI. */
  label: string
  /** Full natural-language query sent through the AI search path. */
  query: string
}

export const SUGGESTED_SEARCHES: SuggestedSearch[] = [
  {
    label: 'Bollywood dancers in London',
    query: 'Bollywood dancers in London who speak Hindi, available December',
  },
  {
    label: 'Actors with combat skills',
    query: 'Actors with boxing or stage combat experience for a fight scene',
  },
  {
    label: 'Food & drink creators',
    query: 'Food and drink content creators for a restaurant launch campaign',
  },
  {
    label: 'Contemporary dancers',
    query: 'Contemporary dancers in London for a music video shoot',
  },
  {
    label: 'Branded film videographers',
    query: 'Videographers for a branded film and commercial shoot',
  },
]

// Job-side equivalents, shown when the box is scoped to Jobs. Phrased the way
// talent describe what they are looking for, and aimed at the same seeded
// demo world so the examples return rows rather than an empty feed.
export const SUGGESTED_JOB_SEARCHES: SuggestedSearch[] = [
  {
    label: 'Dance jobs in London',
    query: 'Dance jobs in London paying over £300 a day',
  },
  {
    label: 'Remote content work',
    query: 'Remote content creation work for brand campaigns',
  },
  {
    label: 'Acting roles this month',
    query: 'Acting roles starting this month',
  },
]

// Global scope spans talent, jobs, messages and settings, so the examples
// deliberately show that spread rather than three variants of one lookup.
export const SUGGESTED_GLOBAL_SEARCHES: SuggestedSearch[] = [
  { label: 'Find a person by name', query: 'Priya' },
  { label: 'Jump to a job', query: 'music video' },
  { label: 'Open a setting', query: 'notifications' },
]

/**
 * Two or three examples relevant to wherever the box currently is. The empty
 * state uses these, so they must always be safe to run in that scope.
 */
export function examplesForScope(scope: SearchScope): SuggestedSearch[] {
  if (scope === 'talent') return SUGGESTED_SEARCHES.slice(0, 3)
  if (scope === 'jobs') return SUGGESTED_JOB_SEARCHES
  return SUGGESTED_GLOBAL_SEARCHES
}
