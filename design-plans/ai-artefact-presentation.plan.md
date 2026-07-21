# AI output on the search page renders with the full artefact anatomy

Written against: 77a27a0 (main). The governing DESIGN.md contract was introduced at ancestor commit 09d7591; all line numbers below were re-verified against the working tree at 77a27a0.

Covers audit findings F1 (parsed-intent artefact row) and B3 (deep-search agent summary artefact anatomy) from `design-plans/2026-07-21-search-surface-audit.md`.

## Evidence chain

- Surface: Hirer AI search, `src/app/(app)/(hirer)/search/page.tsx` (route `/search`, rendered inside `(app)` layout chrome).
- Problem (two observations, one root cause - AI output on this page does not follow the mandated artefact anatomy):
  1. **F1**: `/api/search` returns the LLM-parsed intent - `return Response.json({ results: payload, parsed, filters: effectiveFilters })` at `src/app/api/search/route.ts:192` (also `:117` for the empty-result path) - but the client callback `runAiSearch` (`page.tsx:159-201`) reads only `data.error` and `data.results` and discards `data.parsed`. Grep confirms no consumer of `parsed` exists in any client component. The parsed-intent chip row the contract names as its first use case never renders; the only AI feedback is the plain meta text "{n} AI matches / in {ms}ms" in `SearchHeader.tsx:125-131`.
  2. **B3**: The deep-search agent summary (`page.tsx:356-361`) renders as an icon + bare paragraph: it has the tinted container but no header strip, no "AI" label, and no explicit action, so the artefact anatomy is incomplete. A `Regenerate` action is trivially wireable because `runDeepSearch` (`page.tsx:205-268`) already exists on the same component and is safely re-runnable (it guards `if (!q || deepSearching) return` and aborts the prior request).
- Design evidence:
  - `DESIGN.md:51-56`, "AI output as an artefact, not prose": "Wrap AI-produced output in a distinct artefact card: a header strip (icon + type + timestamp) separating it from surrounding prose, a subtle tinted background, an 'AI' label, and an explicit action (Edit, Regenerate, Explain)." Its "Use for" list names this exact surface first: "The parsed-intent chip row above search results ('Understood: contemporary dancer, London, available now'), outreach message drafts, admin AI summaries."
  - `DESIGN.md:42-49`, "Calm, dense evidence cards": "Borders only on the outermost container - never card-in-card", "One accent colour per view" - constrains the artefact to one bordered container and forbids duplicating the "in {ms}ms" timing already shown in SearchHeader.
  - `docs/design.md:152-158` (`badge` component token: secondary background, full rounding, 1.25rem height) - the chip treatment; `docs/design.md:216` mandates `Badge` for short metadata and Lucide icons via the shadcn `base-nova` setup.
  - `AGENTS.md` UI components section: "**Do not** hand-roll buttons, inputs, dialogs, badges, cards, or other controls when a shadcn equivalent exists in the project or registry."
- Owner: `src/app/(app)/(hirer)/search/page.tsx` (both artefacts render here, between `SearchHeader` and the results grid).
- Scope and affected surfaces: `src/app/(app)/(hirer)/search/page.tsx`, `src/components/search/SearchHeader.tsx` (one optional prop so the Edit action can focus the query input), new `src/lib/search-intent.ts` + `src/lib/search-intent.test.ts`. Read-only references: `src/app/api/search/route.ts`, `src/lib/openai.ts` (`ParsedQuery` at `openai.ts:31-41`), `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`.
- Uncertainty: the Edit action relies on `Input` (`src/components/ui/input.tsx`, Base UI `InputPrimitive` with `React.ComponentProps<"input">` spread) forwarding `ref` to the native input under React 19. Established React 19 behaviour (ref-as-prop) and Base UI forwards refs, but verify focus works in the browser; see Stop conditions.

## Design decision

Render both AI outputs on the search page as proper artefact cards, per the DESIGN.md anatomy, without inventing any new pattern:

1. **Parsed-intent chip row (F1)**: store `data.parsed` from `/api/search` in page state and render it in AI mode, directly below `SearchHeader` and above the deep-search controls, as an artefact card: the existing agent-summary container styling (`rounded-xl border border-border/80 bg-muted/40 px-4 py-3`), a header strip of Sparkles icon (`text-primary`) + "AI · Understood" label + an `Edit` action that focuses the query input (editing the query IS editing the parsed intent - it re-parses on the debounce), and a wrapping row of `Badge variant="secondary"` chips, one per parsed field. Chip text is produced by a new pure helper `parsedIntentChips` in `src/lib/search-intent.ts` (one-module-one-test convention).
2. **Deep-search summary anatomy (B3)**: restructure the existing agent-summary block from icon + bare `<p>` into the same anatomy: header strip (Sparkles + "AI summary" label) + `Regenerate` action wired to the existing `runDeepSearch`, with the summary paragraph below. Container styling is unchanged.

Deliberate anatomy choice, recorded so the executor does not re-derive it: the header-strip **timestamp** is omitted on both artefacts. Search timing already renders once per search in `SearchHeader.tsx:125-131` ("in {searchTime}ms" - fed by both standard and deep search via `setSearchTime`), and DESIGN.md's calm-density rule forbids duplicating the same datum in a sibling container. The chip row also hides while `searching`/`deepSearching` and whenever an agent summary is present - the deep-search shortlist is agent-curated, so the standard parse's chips must not claim to describe it.

This resolves the root problem because the proof-of-intelligence (the LLM understood the query) becomes a visible, labelled, actionable artefact on every rehearsed demo query, instead of being computed server-side and thrown away.

## Reuse

- Container: exact class string from the current agent-summary block (`page.tsx:357`): `rounded-xl border border-border/80 bg-muted/40 px-4 py-3` - the page's established tinted AI surface. Exemplar: `src/app/(app)/(hirer)/search/page.tsx:356-361`.
- Chips: `Badge` `variant="secondary"` from `src/components/ui/badge.tsx` (implements the `badge` token in `docs/design.md:152-158`). Exemplar of Badge-as-metadata-chip: `src/components/talent/TalentCard.tsx` skill badges.
- AI icon + label: `Sparkles` (lucide-react, already imported in `page.tsx:5`) with `text-primary`, and the muted-label treatment already used for AI output labelling - exemplar: `src/components/outreach/OutreachModal.tsx:181` (`<p className="text-muted-foreground text-xs font-medium">AI-generated outreach message</p>`).
- Regenerate action: `Button variant="ghost" size="sm"` with a leading icon - exemplar: `OutreachModal.tsx:213-224`. Use Lucide `RefreshCw` for the icon (do NOT copy OutreachModal's inline SVG - audit B12/B13 flag hand-written SVGs as drift; `docs/design.md:216` mandates Lucide).
- Edit action: `Button variant="ghost" size="xs"` with Lucide `Pencil` - size/variant grammar per `src/components/ui/button.tsx:22-34` and existing xs usage in `SearchHeader.tsx:163-176`.
- Type: `ParsedQuery` from `src/lib/openai.ts:31-41` via type-only import. Precedent for a client file type-importing from `@/lib/openai`: `src/components/messages/MessageComposer.tsx:18` (`import type { MessageAssistMode } from '@/lib/openai'`).

## Changes

### 1. `src/lib/search-intent.ts` (new file)

- Change: create a pure formatting helper that turns a `ParsedQuery` into human-readable chip strings. Exact content:

```ts
import type { ParsedQuery } from '@/lib/openai'

/**
 * Human-readable chips for the parsed-intent artefact row above AI search
 * results ("Understood: contemporary dancer, London, available December").
 * Only fields the LLM actually extracted produce a chip.
 */
export function parsedIntentChips(parsed: ParsedQuery): string[] {
  const chips: string[] = []
  if (parsed.category) chips.push(parsed.category.replace(/_/g, ' '))
  chips.push(...parsed.skills)
  if (parsed.location) chips.push(parsed.location)
  if (parsed.availability) chips.push(`Available: ${parsed.availability}`)
  chips.push(...parsed.languages)
  chips.push(...parsed.gender.map(g => g.replace(/_/g, ' ')))
  if (parsed.age_min !== null && parsed.age_max !== null) chips.push(`Age ${parsed.age_min}-${parsed.age_max}`)
  else if (parsed.age_min !== null) chips.push(`Age ${parsed.age_min}+`)
  else if (parsed.age_max !== null) chips.push(`Age up to ${parsed.age_max}`)
  if (parsed.spact === true) chips.push('SPACT')
  return chips
}
```

  ("SPACT" matches the existing filter label in `src/lib/filter-taxonomy.ts:84`; category/gender underscore-to-space matches the server's own display normalisation in `src/app/api/search/route.ts:26`.)
- Preserve: n/a (new file). Do not add rendering logic here - strings only, so it stays unit-testable.
- Verify: `parsedIntentChips` returns `[]` for an all-null parse and correct chips for a full parse (see test file below).

### 2. `src/lib/search-intent.test.ts` (new file)

- Change: colocated Vitest test per the `src/lib` one-module-one-test convention (style exemplar: `src/lib/talent-card-badges.test.ts`). Cover at minimum:
  - all-null/empty `ParsedQuery` returns `[]`
  - full parse (category `photographer_videographer`, skills, location, availability, languages, gender `non_binary`, ages, `spact: true`) returns underscore-free labels, `Available: …`, `Age 25-35`, `SPACT`
  - `age_min` only → `Age 25+`; `age_max` only → `Age up to 35`; `spact: false`/`null` produces no chip
- Verify: `npm test` includes and passes the new file.

### 3. `src/app/(app)/(hirer)/search/page.tsx`

All snippets below are the exact current code at 77a27a0.

- Change (imports): line 5 currently

```tsx
import { SearchX, Sparkles } from 'lucide-react'
```

  becomes

```tsx
import { Pencil, RefreshCw, SearchX, Sparkles } from 'lucide-react'
```

  and add alongside the existing imports:

```tsx
import { Badge } from '@/components/ui/badge'
import { parsedIntentChips } from '@/lib/search-intent'
import type { ParsedQuery } from '@/lib/openai'
```

- Change (state): after line 52 (`const [aiError, setAiError] = useState<string | null>(null)`) add

```tsx
const [parsedIntent, setParsedIntent] = useState<ParsedQuery | null>(null)
```

  and after line 57 (`const aiAbortRef = useRef<AbortController | null>(null)`) add

```tsx
const searchInputRef = useRef<HTMLInputElement>(null)
```

- Change (`runAiSearch`, lines 159-201): keep `parsedIntent` in lockstep with `aiResults`.
  - Line 161: `if (!q.trim()) { setAiResults(null); setSearchTime(null); setSearching(false); return }` → add `setParsedIntent(null)` inside the block (before `return`).
  - Demo branch (lines 168-173): after `setAiResults(searchDemoTalent(q, filters))` add `setParsedIntent(null)` (the local demo path performs no LLM parse - never fake one).
  - Error branch (lines 183-186): add `setParsedIntent(null)` alongside `setAiResults(null)`.
  - Success branch (lines 187-195): after `setAiResults(results)` add

```tsx
setParsedIntent((data.parsed as ParsedQuery | undefined) ?? null)
```

- Change (debounce effect, lines 270-280): current

```tsx
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgentSummary(null)
    if (!query.trim()) { setAiResults(null); setSearchTime(null); return }
```

  becomes

```tsx
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgentSummary(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stale parse must clear when the query changes
    setParsedIntent(null)
    if (!query.trim()) { setAiResults(null); setSearchTime(null); return }
```

- Change (clear handler, line 320): `onClearQuery={() => { setQuery(''); setAiResults(null) }}` → `onClearQuery={() => { setQuery(''); setAiResults(null); setParsedIntent(null) }}`.

- Change (pass the input ref): inside the `<SearchHeader … />` call (lines 317-334) add the prop `inputRef={searchInputRef}`.

- Change (F1 - render the artefact chip row): compute once, near `displayResults` (after line 287):

```tsx
const intentChips = parsedIntent ? parsedIntentChips(parsedIntent) : []
```

  Then insert this block immediately after the closing `/>` of `<SearchHeader … />` (i.e. between lines 334 and 336, before the deep-search controls block):

```tsx
      {isAiMode && !searching && !deepSearching && !agentSummary && intentChips.length > 0 && (
        <section aria-label="AI-parsed search intent" className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">AI · Understood</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto text-muted-foreground hover:text-foreground"
              onClick={() => searchInputRef.current?.focus()}
            >
              <Pencil className="size-3" />
              Edit
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {intentChips.map(chip => (
              <Badge key={chip} variant="secondary">{chip}</Badge>
            ))}
          </div>
        </section>
      )}
```

- Change (B3 - deep-search summary anatomy): current block, lines 356-361:

```tsx
      {isAiMode && agentSummary && !deepSearching && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>{agentSummary}</p>
        </div>
      )}
```

  becomes

```tsx
      {isAiMode && agentSummary && !deepSearching && (
        <section aria-label="AI deep-search summary" className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">AI summary</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto text-muted-foreground hover:text-foreground"
              onClick={runDeepSearch}
              disabled={deepSearching || searching}
            >
              <RefreshCw className="size-3" />
              Regenerate
            </Button>
          </div>
          <p className="mt-1.5">{agentSummary}</p>
        </section>
      )}
```

- Preserve:
  - `runAiSearch` mechanics untouched: AbortController lifecycle, debounce (500ms), `posthog.capture('ai_search_performed', …)` payload, the `aiAbortRef.current === controller` guard, error copy.
  - `runDeepSearch` untouched (NDJSON streaming loop, `posthog.capture('agent_search_performed', …)`, status messages, its `deepSearching` re-entry guard - which is exactly what makes the Regenerate button safe).
  - The deep-search controls block (lines 336-354) untouched: Deep search button, `deepStatus` pulse text, helper copy.
  - Error blocks (`aiError`, `browseError`), skeleton grid, empty state, view modes, Load more, `OutreachModal` - all untouched.
  - `agentSummary` text content and its container styling (same classes, now on `<section>`).
  - The `data.error` handling order in `runAiSearch` (error checked before results).

- Verify:
  - Typing "Bollywood dancers in London, available December" renders, after results load, a bordered tinted card with Sparkles + "AI · Understood" + chips ("dancer", "Bollywood", "London", "Available: December") above the Deep search button, and each chip uses the secondary Badge treatment.
  - Tapping Edit focuses the search input (keyboard opens on iOS).
  - Clearing the query, a fetch error, or entering local demo mode removes the chip row; while a new search is in flight, no stale chips show.
  - Running Deep search hides the chip row and, on completion, shows the summary card with header strip "AI summary" + Regenerate; tapping Regenerate re-runs the agent stream (status pulse reappears) and the button is disabled while `deepSearching || searching`.

### 4. `src/components/search/SearchHeader.tsx`

- Change (line 3): `import { useRef, useEffect, useState } from 'react'` → `import { useRef, useEffect, useState, type Ref } from 'react'`.
- Change (props, lines 15-32): add to `SearchHeaderProps`:

```tsx
  /** Lets the page focus the query input (parsed-intent artefact "Edit" action). */
  inputRef?: Ref<HTMLInputElement>
```

  and add `inputRef` to the destructured params (lines 34-40).
- Change (Input, lines 95-104): add `ref={inputRef}` to the existing `<Input … />` (no other prop changes).
- Preserve: the sticky-header IntersectionObserver logic, `aria-label="Search talent with AI"`, focus/blur handlers driving `SearchSuggestionChips`, clear button, AI meta row, FilterBar/SaveSearchButton row, view toggle + sort control (B5 is out of scope here), exact class strings on the Input.
- Verify: `npm run typecheck` passes; input still renders and focuses normally when the prop is omitted (prop is optional).

## Scope

- Inherit: only `/search` (hirer). `SearchHeader` is consumed solely by this page (verify with grep); the new prop is optional, so any other consumer is unaffected.
- Verify: `src/components/search/SearchSuggestionChips` empty-state flow still works (chip row hidden when no results/query); sticky header mode - the chip row is NOT inside the sticky container, confirm it scrolls away naturally and does not jump when the header pins.
- Exclude:
  - `OutreachModal` artefact/Sheet work (audit B1) and its inline SVG (B12-adjacent) - separate finding, separate plan.
  - SwipeStack score colour (F2), AllFiltersSheet (F3), sort `<select>` (B5), and all other backlog items.
  - Header-strip timestamp - deliberately omitted (rationale in Design decision); do not add a second timing display.
  - No changes to `/api/search` or `/api/search/agent` - the server already returns everything needed.
  - No demo-data fake parse - local demo mode simply shows no chip row.

## Validation

- Product: a hirer types a rehearsed demo query and can see, labelled as AI output, exactly what the system understood, and can regenerate the deep-search shortlist summary in place. The demo's proof-of-intelligence moment now has a visible artefact.
- Interface: on iPhone-width viewport (iOS Safari first): chip row wraps cleanly with 8+ chips (query "female Bollywood and Kathak dancers in London who speak Hindi, age 25-35, available December, SPACT"); minimal parse (all nulls) renders no empty card; long agent summary paragraph wraps inside the card; Edit focus opens the keyboard; dark mode (tokens are semantic, no raw colours introduced); states: searching (row hidden), error (row hidden, error card shows), deep-searching (row hidden, status pulse), deep-search complete (summary card with Regenerate).
- System: no new pattern introduced - container classes are byte-identical to the existing agent-summary card, chips are shadcn `Badge variant="secondary"`, actions are shadcn `Button` ghost variants, icons are Lucide. Confirm no raw `<button>`, no hand-rolled chip spans, no new colour values.
- Repository: `npm run lint && npm run typecheck && npm test` → passes (lint runs `--max-warnings 0`; the two `eslint-disable` comments in the debounce effect must each sit directly above their `set*` call).

## Stop conditions

- Stop if `searchInputRef.current` is null at click time or `.focus()` does nothing (Base UI `InputPrimitive` not forwarding the ref to the native input): keep the chip row and label, drop only the Edit button, and flag the anatomy gap rather than shipping a dead control.
- Stop if `data.parsed` is missing at runtime from `/api/search` responses (contract drift since 77a27a0): re-read `src/app/api/search/route.ts` before touching the client.
- Stop if the chip row visibly pushes results below the fold on the rehearsed demo device in a way stakeholders reject - this is a presentation call the owner must make; do not silently shrink or reposition the artefact.
- Stop if any change would require editing `src/components/ui/*` - none should.

## Design documentation

- After acceptance, append to `DESIGN.md` "AI output as an artefact, not prose" a one-line clarification: on surfaces that already display search timing (the search meta row), the artefact header omits the timestamp to honour the calm-density rule - icon + type label + action is the minimum anatomy.
