// Suggested searches shown as chips when the search input is focused and
// empty, and in the no-results empty state. Every query is engineered to
// return strong matches from the demo world seeded in `src/lib/seed/data.ts`
// (Bollywood dancers, combat actors, food creators, contemporary dancers,
// videographers). Keep these in sync with the demo-critical seed scenarios.

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
