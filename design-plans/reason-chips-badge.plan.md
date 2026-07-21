# Match-reason chips render on the shadcn Badge primitive everywhere they appear

Written against: 77a27a0 (main). Audit evidence was captured at 09d7591; every citation below has been re-verified against the current tree and line numbers are current.

## Evidence chain

- Surface: Hirer AI search results, grid view and list view - `src/app/(app)/(hirer)/search/page.tsx` renders `TalentCard` (line 435, grid) and `TalentListItem` (line 455, list), passing `matchReasons={isAiMode ? match_reasons : undefined}` (lines 439 and 459). The "why this match" reason chips only appear in AI mode.
- Problem: Both card variants hand-roll the match-reason chips as raw `<span>` elements that imitate the Badge secondary variant:
  - Grid card, `src/components/talent/TalentCard.tsx` lines 133-140: `<span className="inline-flex max-w-full items-center truncate rounded-full bg-secondary/70 px-2 py-1 text-[10px] font-medium text-secondary-foreground">`
  - List item, `src/components/talent/TalentCard.tsx` lines 265-272: `<span className="truncate rounded-full bg-secondary/70 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">`

  The same file already imports and uses the real primitive for sibling chips on the same cards: capability chips at lines 147 and 150 (`<Badge variant="secondary" className="text-[11px]">`), skill chips at lines 158-164 and 282-284. One card, two implementations of the same visual object.
- Design evidence:
  - `AGENTS.md:73`: "**Do not** hand-roll buttons, inputs, dialogs, badges, cards, or other controls when a shadcn equivalent exists in the project or registry."
  - `docs/design.md:152-158` defines the `badge` component token: backgroundColor `{colors.secondary}`, textColor `{colors.on-secondary}`, rounded `{rounded.full}`, height `1.25rem`. Note the token says `colors.secondary`, not a 70% tint - the hand-rolled `bg-secondary/70` is off-token.
  - `docs/design.md:216`: "Use ... `Badge` for short metadata".
  - Repo exemplar: the talent-side discover surface already renders job match reasons on the primitive - `src/app/(app)/(talent)/discover/page.tsx:1044` (`<Badge variant="secondary" className="text-[11px]">{reason}</Badge>`) and `src/app/(app)/(talent)/discover/[id]/page.tsx:244` (`<Badge variant="secondary">{reason}</Badge>`). Hirer search is the only surface that imitates instead of reuses.
- Owner: `src/components/talent/TalentCard.tsx` (both `TalentCard` and `TalentListItem` exports).
- Scope and affected surfaces: `src/app/(app)/(hirer)/search/page.tsx` (only consumer that passes `matchReasons`); `src/components/talent/SimilarTalent.tsx` also renders `TalentCard` but never passes `matchReasons`, so it is unaffected. `SwipeStack.tsx` currently drops `match_reasons` entirely - a separate plan (match-presentation-parity) adds reason pills there and must copy the Badge pattern this plan establishes.
- Uncertainty: none. All line numbers, class strings, and consumers verified against the working tree at 77a27a0.

## Design decision

Replace the two hand-rolled `<span>` chips with `Badge variant="secondary"`, the primitive the same file already uses for capability and skill chips and the primitive the discover surface already uses for the identical "match reason" concept. This removes the parallel implementation, lands the chips on the documented `badge` component token (`bg-secondary`, `rounded-4xl`, `h-5` = the token's 1.25rem height), and gives the match-presentation-parity plan (SwipeStack reason pills) a single canonical pattern to copy.

Deliberate normalisations that come with landing on the primitive (all visually minor, demo-safe):

- `bg-secondary/70` → `bg-secondary` (the token value; same hue, 30% opacity difference, imperceptible on `secondary`).
- Grid chips `text-[10px]` → `text-[11px]`, matching the sibling capability/skill Badges on the same card and the discover exemplar. List chips stay `text-[10px]` because every Badge in the list row already uses `text-[10px]` (skill badges at line 282).
- Chip height becomes the Badge's fixed `h-5` (grid was ~23px, list ~19px; both become 20px, the documented token height).
- Truncation moves to an inner `<span className="truncate">`: Badge is a flex container, so `truncate` on the Badge itself clips without an ellipsis (a latent flaw the current grid span already has). The inner span restores a real ellipsis for long reasons.

## Reuse

- Component: `Badge` from `@/components/ui/badge`, `variant="secondary"` (already imported in `TalentCard.tsx` line 7 - no import change needed).
- Token: `badge` component token, `docs/design.md:152-158`.
- Exemplar: `src/app/(app)/(talent)/discover/page.tsx:1044` (match reasons as `Badge variant="secondary" className="text-[11px]"`); sibling capability chips in `src/components/talent/TalentCard.tsx:147`.

## Changes

1. `src/components/talent/TalentCard.tsx` - grid card (`TalentCard`), lines 128-142

   - Change: replace the hand-rolled span map. Current code:

     ```tsx
             {matchReasons && matchReasons.length > 0 && (
               <div
                 className="mt-3 flex flex-wrap gap-1.5"
                 aria-label="Why this talent matches"
               >
                 {matchReasons.map((reason) => (
                   <span
                     key={reason}
                     className="inline-flex max-w-full items-center truncate rounded-full bg-secondary/70 px-2 py-1 text-[10px] font-medium text-secondary-foreground"
                   >
                     {reason}
                   </span>
                 ))}
               </div>
             )}
     ```

     Replace with:

     ```tsx
             {matchReasons && matchReasons.length > 0 && (
               <div
                 className="mt-3 flex flex-wrap gap-1.5"
                 aria-label="Why this talent matches"
               >
                 {matchReasons.map((reason) => (
                   <Badge
                     key={reason}
                     variant="secondary"
                     className="max-w-full text-[11px]"
                   >
                     <span className="truncate">{reason}</span>
                   </Badge>
                 ))}
               </div>
             )}
     ```

   - Preserve: the wrapper `<div className="mt-3 flex flex-wrap gap-1.5" aria-label="Why this talent matches">` exactly (the aria-label is load-bearing for the group's accessible name); the conditional render on `matchReasons && matchReasons.length > 0`; `key={reason}`; rendering ALL reasons (no slice) in grid view; `max-w-full` so a long reason cannot overflow the card (Badge's base `shrink-0` makes this necessary).
   - Verify: in AI mode on `/search`, grid cards show reason chips visually identical to the "SPAC" / "Stunt registered" capability chips (same height, radius, background, 11px text); a long reason truncates with an ellipsis inside the chip instead of overflowing.

2. `src/components/talent/TalentCard.tsx` - list item (`TalentListItem`), lines 260-274

   - Change: replace the hand-rolled span map. Current code:

     ```tsx
               {matchReasons && matchReasons.length > 0 && (
                 <div
                   className="mt-1 flex flex-wrap gap-1.5"
                   aria-label="Why this talent matches"
                 >
                   {matchReasons.slice(0, 2).map((reason) => (
                     <span
                       key={reason}
                       className="truncate rounded-full bg-secondary/70 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                     >
                       {reason}
                     </span>
                   ))}
                 </div>
               )}
     ```

     Replace with:

     ```tsx
               {matchReasons && matchReasons.length > 0 && (
                 <div
                   className="mt-1 flex flex-wrap gap-1.5"
                   aria-label="Why this talent matches"
                 >
                   {matchReasons.slice(0, 2).map((reason) => (
                     <Badge
                       key={reason}
                       variant="secondary"
                       className="max-w-full px-1.5 text-[10px]"
                     >
                       <span className="truncate">{reason}</span>
                     </Badge>
                   ))}
                 </div>
               )}
     ```

   - Preserve: the wrapper div and its `aria-label="Why this talent matches"`; the `slice(0, 2)` cap (list rows are dense; showing at most two reasons is intentional); `key={reason}`; `text-[10px]` and `px-1.5` to match the list row's existing Badge density (skill badges at line 282 use `text-[10px]`, current chip uses `px-1.5`).
   - Verify: in AI mode with list view selected on `/search`, each row shows at most two reason chips at the same compact density as before, now sharing the Badge shape (`rounded-4xl`, `h-5`) with the row's skill badges.

No other files change. `Badge` is already imported in `TalentCard.tsx`; the hand-rolled class strings `bg-secondary/70 ... text-secondary-foreground` should no longer appear anywhere in the file after the edit (grep to confirm).

## Scope

- Inherit: `src/app/(app)/(hirer)/search/page.tsx` grid view (line 435) and list view (line 455) - the only call sites that pass `matchReasons`. Both receive the change automatically.
- Verify: `src/components/talent/SimilarTalent.tsx:17` renders `TalentCard` without `matchReasons` - confirm no chip row renders there (unchanged behaviour).
- Exclude:
  - `SwipeStack.tsx` reason pills - owned by the match-presentation-parity plan. Coordination requirement: that plan must render its new reason pills with the exact Badge pattern from Change 1 (`Badge variant="secondary"` + inner truncating span), not a copy of the old spans. If that plan lands first with span-based pills, this plan's executor should also convert those to the same Badge pattern and note it.
  - Discover-side match-reason Badges (`discover/page.tsx`, `discover/[id]/page.tsx`) - already on the primitive, untouched.
  - The match SCORE pill (`bg-brand-lime`, TalentCard.tsx:73 and :252) - governed by the `match-score` token (`docs/design.md:159-165`), deliberately NOT a Badge, and covered by other findings (F2/B4). Do not touch it.
  - The category overlay chip (TalentCard.tsx:79) and availability status (TalentCard.tsx:191-192, :295 - finding B8) - out of scope.

## Validation

- Product: run the rehearsed AI search demo query on `/search`; confirm reason chips still communicate "why this match" on every result card in both grid and list view, in both light and dark themes.
- Interface: `/search` in AI mode - grid view and list view; browse mode (no chips must render - `matchReasons` is undefined outside AI mode); a result with a long reason string (chip truncates with ellipsis, card layout does not break); a result with many reasons (grid wraps cleanly at `gap-1.5`, list caps at two). Check at iPhone-width viewport in iOS Safari first (390px), then desktop.
- System: confirm `TalentCard.tsx` contains no remaining hand-rolled chip spans (`grep -n "bg-secondary/70" src/components/talent/TalentCard.tsx` returns nothing) and no new one-off chip pattern was introduced; match-reason rendering now uses the identical primitive as discover.
- Repository: `npm run lint && npm run typecheck && npm test` → passes (lint runs `--max-warnings 0`).

## Stop conditions

- Stop if `Badge`'s base classes (`h-5`, `rounded-4xl`, `px-2`) produce a visibly different chip that breaks the card layout at mobile width - report before inventing compensating overrides beyond those specified.
- Stop if the match-presentation-parity plan has already modified these exact lines in `TalentCard.tsx` (merge conflict or drifted code) - reconcile with that plan's executor rather than force-editing.
- Stop if any consumer besides the search page turns out to pass `matchReasons` (would widen the affected-surface list and demand re-verification).

## Design documentation

- After acceptance, record in `DESIGN.md` (or the audit follow-up): "Match-reason chips are `Badge variant="secondary"` with an inner truncating span - never hand-rolled spans. Grid: `text-[11px]`; compact list rows: `px-1.5 text-[10px]`. The match score is the only pill that is not a Badge (match-score token)."
