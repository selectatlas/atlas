# AI match score and why-this-match reasons render identically across grid, list, and swipe views

Written against: 77a27a0c11f4ca7090d8c1c98ef33b2ba9ee1042 (main). The source audit (`design-plans/2026-07-21-search-surface-audit.md`) was written against 09d7591; every line number below has been re-verified against the current tree and is accurate as written here.

## Evidence chain

- Surface: Hirer AI search results, `src/app/(app)/(hirer)/search/page.tsx`, which renders one `displayResults: TalentSearchResult[]` array through three switchable view modes: grid (`TalentCard`, page.tsx:432-450), list (`TalentListItem`, page.tsx:452-467), and swipe (`SwipeStack`, page.tsx:420-430).
- Problem: The same AI match data renders three different ways depending on which view toggle the hirer picks.
  1. **Colour split (audit F2)**: `src/components/talent/SwipeStack.tsx:311` renders the match score pill as `bg-accent text-accent-foreground` (blue), while grid (`TalentCard.tsx:73`) and list (`TalentCard.tsx:252`) render the identical value as `bg-brand-lime … text-black`.
  2. **Copy split (audit B4)**: the list pill (`TalentCard.tsx:253`) reads `{matchScore}%` and the swipe pill (`SwipeStack.tsx:312`) reads `{match_score}%`, while the grid pill (`TalentCard.tsx:74`) reads `{matchScore}% match`.
  3. **Missing reasons (audit B2)**: `SwipeStack.tsx:12` declares a local type `type TalentResult = { profile: Profile & { talent_skills: TalentSkill[] }; match_score: number }` that structurally drops the optional `match_reasons?: string[]` field present on the shared `TalentSearchResult` (`src/types/index.ts:139-145`). The page passes the full array (page.tsx:423) but SwipeStack never destructures or renders reasons, so swipe view silently loses the why-this-match pills that grid (`TalentCard.tsx:128-142`) and list (`TalentCard.tsx:260-274`) both show.
- Design evidence:
  - `docs/design.md:159-165` defines the `match-score` component token: `backgroundColor: "{colors.brand-lime}"`, `rounded: "{rounded.full}"`.
  - `docs/design.md:196`: "`brand-lime` is deliberately scarce and should mean match confidence, recommendation, or a positive decision."
  - `docs/design.md:216`: "Match scores should use `match-score`, never a generic success badge, because the lime colour carries product meaning."
  - `docs/design.md:220`: "Do use lime only for match confidence or a similarly meaningful signal."
  - `DESIGN.md:25-29` ("Colour-independent status"): "Every status pairs a word with a number and/or directional glyph: '92% match ↑' … Colour reinforces; it never carries the meaning alone." — this is why the pill copy must be "{n}% match", not a bare "{n}%".
  - `DESIGN.md:58-62` ("Contextual AI insights, not isolated widgets"): "The match-score explanation belongs on the talent card" — "Use for: Why-this-match explanations". The swipe card is a talent card; it must carry the explanation too.
  - `DESIGN.md:68` ("One grammar reused across every view") reinforces that the three view modes of one result set share one presentation grammar.
- Owner: `src/components/talent/SwipeStack.tsx` (colour, copy, missing reasons) and `src/components/talent/TalentCard.tsx` (`TalentListItem` copy).
- Scope and affected surfaces: `src/components/talent/SwipeStack.tsx`, `src/components/talent/TalentCard.tsx`. Sole consumer of both view components on this data path is `src/app/(app)/(hirer)/search/page.tsx` (verified by grep: SwipeStack has exactly one consumer; `TalentListItem` is imported only by this page). `TalentCard` (grid) is already correct and is NOT edited. Page is not edited.
- Uncertainty: none. All cited line numbers, class strings, and the data flow (`/api/search` returns `match_reasons` at `src/app/api/search/route.ts:140,182`; browse `/api/talent` returns `match_score: 0` at `src/app/api/talent/route.ts:98`, so SwipeStack's existing `match_score > 0` gate already means "AI mode only") were re-verified against the working tree. No unit or Playwright test asserts on the current "{n}%" copy or `bg-accent` pill classes (verified by grep across `src/**/*.test.ts*` and `e2e/`).

## Design decision

Make the grid pill (`TalentCard.tsx:72-76`) the canonical match-score presentation - `rounded-full bg-brand-lime … font-bold text-black` with "{n}% match" copy - and converge the other two views on it; then give the swipe card the same why-this-match reason pills the other two views already render.

- **Colour**: lime is the token-mandated match-confidence colour (`docs/design.md:159-160, :196, :216`). `bg-accent` on the swipe pill is a contract violation, not a variant.
- **Text colour**: the token table says `textColor: "{colors.foreground}"` (`docs/design.md:161`), but the established repo implementation of `match-score` is `text-black` in all three existing usages (`TalentCard.tsx:73`, `TalentCard.tsx:252`, `src/app/design-system/page.tsx:252`) because `--brand-lime: #dfff62` is the same light value in both themes (`src/app/globals.css:126, :200`) and `foreground` flips to near-white in dark mode, which would fail contrast on lime. Follow the repo exemplar: `text-black`.
- **Copy**: "{n}% match" satisfies DESIGN.md's colour-independent-status rule (word + number); a bare "{n}%" relies on lime alone to say "match".
- **Reasons in swipe**: the data is already in the array the page passes; the only blocker is SwipeStack's narrowed local type. Widen the type to the shared `TalentSearchResult` and render the exact reason-pill markup from `TalentCard.tsx:133-140`, capped at 3 reasons because the swipe card is a fixed 520px `overflow-hidden` container (`SwipeStack.tsx:144, :158`) — the list view sets precedent for view-appropriate capping (`TalentCard.tsx:265` slices to 2). Grid remains uncapped.
- **Not changed**: the swipe row's "AI match score" label stays - it names provenance (DESIGN.md:31-38 "Believable numbers need provenance") and does not conflict with the pill copy. The list pill keeps its compact geometry (`px-1.5 py-0.5 text-[10px]`); only its copy changes - B4 is a copy finding, not a sizing finding.

## Reuse

- Token: `bg-brand-lime` + `text-black` (the repo's `match-score` implementation; Tailwind v4 token `--color-brand-lime` from `src/app/globals.css:12`).
- Pill copy pattern: `{score}% match` — exemplar `src/components/talent/TalentCard.tsx:74`.
- Reason-pill markup: `span.inline-flex max-w-full items-center truncate rounded-full bg-secondary/70 px-2 py-1 text-[10px] font-medium text-secondary-foreground` inside a `div.flex flex-wrap gap-1.5` with `aria-label="Why this talent matches"` — exemplar `src/components/talent/TalentCard.tsx:128-142`.
- Shared type: `TalentSearchResult` from `src/types/index.ts:139-145` (already what the page passes).
- Exemplar: `src/components/talent/TalentCard.tsx` (grid card, already contract-correct).

## Changes

1. `src/components/talent/SwipeStack.tsx`
   - Change (type, fixes B2 root cause): replace the narrowed local type with the shared one.

     Line 5, current:
     ```ts
     import type { Profile, TalentSkill } from '@/types'
     ```
     Replace with:
     ```ts
     import type { Profile, TalentSkill, TalentSearchResult } from '@/types'
     ```
     (`Profile` and `TalentSkill` remain used by `LastAction` and the prop callbacks - keep them.)

     Line 12, current:
     ```ts
     type TalentResult = { profile: Profile & { talent_skills: TalentSkill[] }; match_score: number }
     ```
     Replace with:
     ```ts
     type TalentResult = TalentSearchResult
     ```
     (`TalentSearchResult.profile` is the same `Profile & { talent_skills: TalentSkill[] }` intersection, so `SwipeStackProps`, `CardContent`, and every `current.profile` access compile unchanged.)

   - Change (destructure + render, fixes F2 and B2 presentation): in `CardContent` (currently lines 248-319), line 249 currently reads:
     ```ts
     const { profile, match_score } = result
     ```
     Replace with:
     ```ts
     const { profile, match_score, match_reasons } = result
     ```

     Then replace the match-score block at lines 308-315, current:
     ```tsx
     {match_score > 0 && (
       <div className="mt-3 pt-3 border-t flex items-center justify-between">
         <span className="text-muted-foreground text-xs">AI match score</span>
         <span className="bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 rounded-full">
           {match_score}%
         </span>
       </div>
     )}
     ```
     with:
     ```tsx
     {match_score > 0 && (
       <div className="mt-3 pt-3 border-t">
         <div className="flex items-center justify-between">
           <span className="text-muted-foreground text-xs">AI match score</span>
           <span className="bg-brand-lime text-black text-xs font-bold px-2.5 py-1 rounded-full">
             {match_score}% match
           </span>
         </div>
         {match_reasons && match_reasons.length > 0 && (
           <div
             className="mt-2 flex flex-wrap gap-1.5"
             aria-label="Why this talent matches"
           >
             {match_reasons.slice(0, 3).map(reason => (
               <span
                 key={reason}
                 className="inline-flex max-w-full items-center truncate rounded-full bg-secondary/70 px-2 py-1 text-[10px] font-medium text-secondary-foreground"
               >
                 {reason}
               </span>
             ))}
           </div>
         )}
       </div>
     )}
     ```
   - Preserve:
     - The `match_score > 0` gate (browse mode returns `match_score: 0`, so score and reasons stay AI-mode-only - identical gating semantics to grid/list's `isAiMode` check).
     - All other `bg-accent` usages in this file: the CONTACT swipe-indicator overlay (lines 174-175) and the Contact action button (line 234) are action affordances, not match-confidence signals - do NOT touch them (audit F2 explicitly scopes them out).
     - Pill geometry `text-xs font-bold px-2.5 py-1 rounded-full` (already matches the grid pill).
     - Everything else in the component untouched: drag physics, pointer capture, damping, velocity threshold, keyboard handlers, reduced-motion behaviour, `lastAction`/undo state, aria-labels on the action buttons, the fixed 520px stack height, the next-card scale trick, and the progress chip.
   - Verify: in swipe view after an AI search, the current and next cards show a lime pill reading e.g. "87% match" with black text, with up to 3 secondary-tinted reason pills directly beneath it; in browse mode (no query) the block is absent; `npm run typecheck` passes with the widened type.

2. `src/components/talent/TalentCard.tsx` (component `TalentListItem` only - the grid `TalentCard` is already correct, do not edit it)
   - Change (fixes B4): line 253, inside the pill at lines 251-255, current:
     ```tsx
     {matchScore !== undefined && (
       <span className="shrink-0 rounded-full bg-brand-lime px-1.5 py-0.5 text-[10px] font-bold text-black">
         {matchScore}%
       </span>
     )}
     ```
     Replace `{matchScore}%` with `{matchScore}% match` (single-line copy change; classes unchanged):
     ```tsx
     {matchScore !== undefined && (
       <span className="shrink-0 rounded-full bg-brand-lime px-1.5 py-0.5 text-[10px] font-bold text-black">
         {matchScore}% match
       </span>
     )}
     ```
   - Preserve: the compact list-pill geometry (`px-1.5 py-0.5 text-[10px]`), `shrink-0` (protects the pill in the truncating name row), the `matchScore !== undefined` gate, the list view's 2-reason cap at line 265, and every other part of both components.
   - Verify: list view after an AI search shows "87% match" in the lime pill on the name row; the name still truncates before the pill shrinks; browse mode shows no pill.

## Scope

- Inherit: `src/app/(app)/(hirer)/search/page.tsx` - the sole consumer of `SwipeStack` and `TalentListItem` (verified by grep) - receives all three fixes with zero page edits, in both live AI search and local demo mode (`searchDemoTalent` in `src/lib/demo-data.ts` also returns `match_reasons`, so demo-mode swipe gains reason pills too).
- Verify: grid view (`TalentCard`) on the same page - must be visually unchanged (it is the exemplar; it is not edited). The talent detail route reached by tapping a card is untouched.
- Exclude:
  - `SwipeStack`'s text glyphs/inline SVGs (audit B13) and its amber undo button - separate finding, do not fold in.
  - The hand-rolled reason-pill spans vs `Badge variant="secondary"` question (audit B9) - this plan deliberately copies the existing span markup so all three views stay identical; migrating all three to `Badge` is B9's job in one pass later. Do not migrate only the new swipe instance.
  - Emerald availability colour (B8), parsed-intent artefact row (F1), AllFiltersSheet (F3), and every other audit finding.
  - `src/app/design-system/page.tsx` showcase (line 293 shows a bare "94%" badge in a mock) - documentation page, not a product surface fed by `match_score`; leave it.

## Validation

- Product: as a hirer, run a rehearsed demo query (e.g. "contemporary dancer in London available now"), then flip the same result set through grid → list → swipe. Expected: every view shows the identical score as a lime "{n}% match" pill with black text, and why-this-match reason pills adjacent (grid: all reasons; list: 2; swipe: up to 3). Pass a card in swipe view - the next card shows the same treatment.
- Interface: mobile iOS Safari first (investors demo on phones; swipe view is the phone-centric mode). Check: swipe card at 390px width with a 3-reason, long-string result (reason pills truncate via `truncate`/`max-w-full`, card does not overflow its 520px height thanks to `overflow-hidden`); 0-reason and 0-score (browse mode) states render no empty container; dark mode - lime pill keeps black text and stays readable; drag gesture still fires contact/pass and reason pills do not intercept the pointer (they are inert spans inside the existing pointer-captured card).
- System: confirm no new colour, token, or pill pattern was introduced - the swipe pill now uses the exact class set of `TalentCard.tsx:73` (modulo the pre-existing class ordering in SwipeStack) and the reason pills are byte-identical markup to `TalentCard.tsx:133-140`. Grep check: `grep -n "bg-accent" src/components/talent/SwipeStack.tsx` returns only lines 174, 175, 234 (action affordances).
- Repository: `npm run lint && npm run typecheck && npm test` → passes (lint runs `--max-warnings 0`; no test asserts on the old copy or classes, so no test updates are expected).

## Stop conditions

- Stop if `type TalentResult = TalentSearchResult` produces typecheck errors in `SwipeStack.tsx` or its consumer - that would mean the shared type has drifted from what the page passes, and reconciling types is a scope change.
- Stop if reason pills visually overflow or clip the fixed-height swipe card on a 390px viewport even with the 3-reason cap - the card height/layout would need rework, which exceeds this plan.
- Stop if any grid-view pixel changes - `TalentCard` (grid) must not be touched; a diff there means the edit landed in the wrong component.

## Design documentation

- After acceptance, record in `docs/design.md` (Components section, `match-score` entry) that the implemented text colour for `match-score` is `text-black` in both themes (lime stays light in dark mode), and that the canonical pill copy is "{n}% match" - resolving the token table's `textColor: "{colors.foreground}"` ambiguity in favour of the shipped convention.
