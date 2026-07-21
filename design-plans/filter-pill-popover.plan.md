# FilterPill dropdowns are built on the shadcn Popover primitive

Written against: 77a27a0 (main). The audit that produced this finding ran at 09d7591; `git diff 09d7591..77a27a0 -- src/components/search/ src/components/ui/popover.tsx` is empty, so every citation below was re-verified against 77a27a0 and holds.

## Evidence chain

- Surface: Hirer AI search, `src/app/(app)/(hirer)/search/page.tsx` → `SearchHeader.tsx:135` → `FilterBar.tsx:73` → `FilterPill.tsx`. The pills are the quick per-filter dropdowns (up to 3) sitting between the category tabs and the "All filters" button.
- Problem: `src/components/search/FilterPill.tsx` (entire file, 53 lines) hand-rolls a dropdown out of `<details>/<summary>` with an absolute-positioned panel (`FilterPill.tsx:34`: `absolute left-0 top-[calc(100%+0.5rem)] z-50 … bg-popover p-4 text-popover-foreground shadow-md`). It already consumes the popover tokens (`bg-popover`, `text-popover-foreground` from `src/app/globals.css:105-106/:179-180`) while bypassing the Popover component that owns them. Consequences of the hand-roll: no outside-click or Escape dismissal (an open `<details>` stays open until the summary is clicked again), no portal (the panel can be clipped by any ancestor with overflow/transform and competes on `z-50` with siblings), no collision avoidance (the panel can run off the right edge of small viewports since it always anchors `left-0`), and hidden-marker hacks (`marker:content-none [&::-webkit-details-marker]:hidden`) that exist only to fight the native element.
- Design evidence:
  - `AGENTS.md:73`: "**Do not** hand-roll buttons, inputs, dialogs, badges, cards, or other controls when a shadcn equivalent exists in the project or registry."
  - `docs/design.md:216`: "The reusable interaction layer lives in `src/components/ui` and is configured with `components.json` using the shadcn `base-nova` style" … "Motion follows the CRISP tokens in `src/app/globals.css`: 150ms for presses, tooltips, and small popovers".
  - The shadcn equivalent exists and is in production use: `src/components/ui/popover.tsx` (Base UI `@base-ui/react/popover` wrapper, base-nova) is consumed by `src/components/layout/NotificationsBell.tsx:66-110` and `src/components/messages/MessageActionsMenu.tsx:44-92`. FilterPill is the only dropdown on the app that avoids it.
- Owner: `src/components/search/FilterPill.tsx`
- Scope and affected surfaces: `src/components/search/FilterPill.tsx` only. Rendered exclusively via `FilterBar.tsx:73` on the hirer search route.
- Uncertainty: none. The Popover wrapper's controlled `open`/`onOpenChange` API and the `PopoverTrigger render={...}` custom-trigger pattern are both proven in `NotificationsBell.tsx:66-74`; the draft-sync-on-open and close-on-apply behaviors map 1:1 onto them.

## Design decision

Rebuild FilterPill on `Popover`/`PopoverTrigger`/`PopoverContent` from `src/components/ui/popover.tsx`, controlled by a local `open` state (the NotificationsBell pattern). The pill button keeps its exact visual identity (same class string minus the two `<details>`-marker hacks that become dead code on a `<button>`); the panel keeps its width clamp, spacing, and contents (FilterSection in compact mode + "Show results" apply button) but inherits the system popover chrome (portal, `ring-1 ring-foreground/10`, `rounded-lg`, open/close fade+zoom animation, `z-50` in an isolated stacking context) exactly as NotificationsBell does. This resolves the root problem - a parallel hand-rolled implementation of a primitive the system already owns - and as a side effect gains outside-click/Escape dismissal, focus return to the trigger, and viewport collision handling on iOS Safari, where the current `left-0` panel can overflow the right edge for pills near the row's end.

Deliberate chrome deltas (adopting the system default rather than preserving the hand-roll): panel `rounded-xl border border-border` becomes the PopoverContent default `rounded-lg ring-1 ring-foreground/10`, and the panel gains the standard popover open/close animation. Both match every other popover in the app; keeping the old chrome would preserve the drift this change removes.

## Reuse

- `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover` (do not add or regenerate anything; the component exists).
- `PopoverTrigger render={<button … />}` custom-trigger pattern with controlled `open`/`onOpenChange`. Exemplar: `src/components/layout/NotificationsBell.tsx:66-74`.
- Width/padding override via `className` on `PopoverContent` (exemplar: `NotificationsBell.tsx:75` overrides `w-80 gap-0 p-0`; `MessageActionsMenu.tsx:49` overrides `w-auto gap-1 p-1.5`).
- Popover colour tokens `--popover`/`--popover-foreground` (`src/app/globals.css:105-106`, dark `:179-180`) - now consumed through the component that owns them instead of raw utilities.
- Motion token compliance is inherited: PopoverContent's `duration-100` open/close is the system's small-popover treatment already accepted on NotificationsBell and MessageActionsMenu.

## Changes

1. `src/components/search/FilterPill.tsx`
   - Change: replace the whole file with the Popover-based implementation below. This is a mechanical rewrite; behavior mapping is: `<details onToggle open → syncDraft()>` becomes `onOpenChange(true) → setDraftValue(...)`; `detailsRef.current?.removeAttribute('open')` becomes `setOpen(false)`; `group-open:rotate-180` on the chevron becomes a conditional `rotate-180` from the controlled `open` state; the panel div's `absolute left-0 top-[calc(100%+0.5rem)] z-50` positioning becomes `align="start" sideOffset={8}` (0.5rem = 8px, identical placement); the panel's `space-y-4` becomes `gap-4` because PopoverContent is already `flex flex-col`.

     Exact replacement content:

     ```tsx
     'use client'

     import { useState } from 'react'
     import { ChevronDown } from 'lucide-react'
     import type { TalentFilterDefinition } from '@/lib/filter-taxonomy'
     import type { SearchFilters, SearchFilterValue } from '@/lib/search-filters'
     import { Button } from '@/components/ui/button'
     import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
     import { FilterSection } from './FilterSection'

     export function FilterPill({ definition, filters, onChange }: { definition: TalentFilterDefinition; filters: SearchFilters; onChange: (filters: SearchFilters) => void }) {
       const [open, setOpen] = useState(false)
       const [draftValue, setDraftValue] = useState<SearchFilterValue | undefined>(filters[definition.key as keyof SearchFilters])
       const active = filters[definition.key as keyof SearchFilters] !== undefined
       const draft = { ...filters, [definition.key]: draftValue }

       function onOpenChange(next: boolean) {
         setOpen(next)
         // Re-seed the draft from the applied filters every time the panel opens,
         // so a previously abandoned draft never leaks into a fresh session.
         if (next) setDraftValue(filters[definition.key as keyof SearchFilters])
       }

       return (
         <Popover open={open} onOpenChange={onOpenChange}>
           <PopoverTrigger
             render={
               <button
                 type="button"
                 className={`flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.8rem] font-medium outline-none transition-[transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] ${
                   active
                     ? 'border-transparent bg-secondary text-secondary-foreground'
                     : 'border-border bg-background hover:bg-muted hover:text-foreground'
                 }`}
               />
             }
           >
             {definition.label}
             <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
           </PopoverTrigger>
           <PopoverContent align="start" sideOffset={8} className="w-[min(20rem,calc(100vw-2rem))] gap-4 p-4">
             <FilterSection definition={definition} filters={draft} onChange={next => setDraftValue(next[definition.key as keyof SearchFilters])} compact />
             <Button
               type="button"
               size="sm"
               className="w-full"
               onClick={() => {
                 const next = { ...filters }
                 if (draftValue === undefined) delete next[definition.key as keyof SearchFilters]
                 else next[definition.key as keyof SearchFilters] = draftValue
                 onChange(next)
                 setOpen(false)
               }}
             >
               Show results
             </Button>
           </PopoverContent>
         </Popover>
       )
     }
     ```

   - Preserve:
     - Public props contract unchanged: `{ definition, filters, onChange }` - `FilterBar.tsx:73` needs no edit.
     - Draft semantics: edits inside the panel mutate only local `draftValue`; `onChange` fires only on "Show results" (never live-applies), and `draftValue === undefined` deletes the key from the filters object rather than storing `undefined`.
     - Draft re-seed on every open (was `syncDraft()` in `onToggle`, now in `onOpenChange`).
     - The pill's entire visual identity: `h-7 rounded-full px-2.5 text-[0.8rem] font-medium`, the active (`border-transparent bg-secondary text-secondary-foreground`) vs inactive (`border-border bg-background hover:bg-muted hover:text-foreground`) split, `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`, `active:scale-[0.97]`, and the CRISP motion vars `duration-[var(--duration-fast)] ease-[var(--ease-out)]`.
     - Chevron: `ChevronDown` `size-3` with `transition-transform` and 180° rotation while open.
     - Panel width clamp `w-[min(20rem,calc(100vw-2rem))]` and `p-4` interior padding; `FilterSection … compact` as first child, full-width `size="sm"` "Show results" Button as last.
     - Intentionally dropped (dead on a `<button>` trigger): `list-none marker:content-none [&::-webkit-details-marker]:hidden`, `useRef`, and the `group`/`group-open` coupling.
   - Verify: on `/search` in browse mode, each pill opens its panel anchored below-left of the pill with an 8px gap; editing options then clicking elsewhere on the page closes the panel WITHOUT applying (result count unchanged); reopening shows the applied value, not the abandoned draft; "Show results" applies the filter, closes the panel, and the pill flips to the active (secondary) treatment; Escape closes the panel and returns focus to the pill; the chevron rotates while open.

## Scope

- Inherit: `src/components/search/FilterBar.tsx:73` (sole consumer) - receives the change with zero edits. FilterBar keys each pill by `${definition.key}:${JSON.stringify(filterValue)}`, so applying a value remounts the pill; with `open` now initialized `false` in state this closes the popover after apply exactly as the explicit `setOpen(false)` intends - no conflict.
- Verify: `src/components/search/FilterSection.tsx` renders unchanged inside the new PopoverContent (its `compact` branch uses its own text sizes, so PopoverContent's base `text-sm` has no visible effect); the pill row in `FilterBar` still wraps correctly since the trigger geometry is identical.
- Exclude: `FilterSection.tsx`'s native `<select>` (audit B6) and `SearchHeader.tsx`'s sort `<select>` (B5) are separate planned changes - do not touch them here. `AllFiltersSheet` (F3), `ActiveFilterChips`, and all other audit findings are out of scope. Do not modify `src/components/ui/popover.tsx`.

## Validation

- Product: a hirer on `/search` narrows browse results with a quick filter pill (e.g. Dancers → a style pill), taps "Show results", and the grid updates with the pill shown active - the rehearsed-demo filter flow works end to end and dismissal now behaves like every other dropdown in the app.
- Interface: `/search` (hirer role) in browse mode. States: pill closed/open, inactive/active, draft edited then dismissed (outside click AND Escape), draft applied, panel reopened after apply. Content extremes: the last (rightmost) pill on a 375px-wide viewport - the old `left-0` panel could overflow the right screen edge; the Popover positioner must keep it fully on-screen. Viewports: iOS Safari 375px first (verify outside-tap dismissal works on touch), then md/desktop. Also confirm the panel portals above result cards and the sticky header without clipping.
- System: FilterPill now consumes the same `Popover` wrapper as `NotificationsBell` and `MessageActionsMenu` - zero remaining `<details>`-based dropdowns in `src/components/search/` (grep `<details` to confirm), and no new popover-like pattern was introduced.
- Repository: `npm run lint && npm run typecheck && npm test` → passes (lint runs `--max-warnings 0`; the removed `useRef` import must not linger). No unit test exists for FilterPill (component tests are not part of the `src/lib` one-module-one-test convention) and no e2e spec touches the filter pills (verified by grep over `e2e/*.spec.ts`), so no test updates are required. Playwright runs in CI only (no Docker on this machine).

## Stop conditions

- Stop if `PopoverTrigger render={<button …/>}` does not forward the trigger's open state/handlers as it does in NotificationsBell (e.g. type errors from the Base UI `render` prop on this version) - do not fall back to a hand-rolled wrapper; report instead.
- Stop if the Popover portal renders the panel behind the search page's sticky header or result cards (stacking regression) - that would need a shared fix in `src/components/ui/popover.tsx`, which is out of scope.
- Stop if outside-click dismissal on iOS Safari fails in real testing - do not add custom document-level listeners; report the primitive-level gap.
- Stop before widening into B5/B6 (`<select>` replacements) even though they live in the same files' orbit.

## Design documentation

- None. This change moves FilterPill INTO compliance with existing contracts (`AGENTS.md:73`, `docs/design.md:216`); no new decision needs recording. If the team later wants "quick filter = Popover, full filter config = Sheet" written down, add it under DESIGN.md's "Configure in place via anchored panel" pattern - optional.
