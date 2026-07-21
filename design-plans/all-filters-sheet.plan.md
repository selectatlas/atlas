# The All filters drawer is a real shadcn Sheet sliding in from the right

Written against: 77a27a0 (audit was run at 09d7591; the two later commits touched only e2e tests, and every citation below has been re-verified against 77a27a0)

## Evidence chain

- Surface: Hirer AI search page, "All filters" drawer. Render path: `src/app/(app)/(hirer)/search/page.tsx:317` (`<SearchHeader …>`) → `src/components/search/SearchHeader.tsx:135` (`<FilterBar …>`) → `src/components/search/FilterBar.tsx:74` ("All filters" trigger button) and `:79` (`{sheetOpen && <AllFiltersSheet open …>}`) → `src/components/search/AllFiltersSheet.tsx`.
- Problem: `AllFiltersSheet.tsx` composes shadcn `Dialog`/`DialogContent` (imported at line 5, used at lines 58-63) and forces the centered dialog into a right-edge panel with eleven `!important` utilities plus one responsive variant on line 62: `!inset-y-0 !left-auto !right-0 !top-0 !h-dvh !max-w-xl !translate-x-0 !translate-y-0 !grid-rows-[auto_minmax(0,1fr)_auto] !rounded-none !p-0 sm:!max-w-xl`. The overrides reposition the panel but cannot remove `DialogContent`'s open animation - `src/components/ui/dialog.tsx:56` bakes in `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` - so the panel center-zooms into place at the screen edge instead of sliding in from the right.
- Design evidence:
  - `DESIGN.md:100-104` ("Configure in place via anchored panel, not a route change"): "Anchor a slide-over/drawer (shadcn `Sheet`) to the trigger, keeping the underlying results visible and scrollable behind it. Reserve … modals for one-off, all-or-nothing decisions." Its "Use for" list at line 104 names "filter configuration" explicitly.
  - `AGENTS.md:73`: "**Do not** hand-roll buttons, inputs, dialogs, badges, cards, or other controls when a shadcn equivalent exists in the project or registry." The shadcn equivalent exists: `src/components/ui/sheet.tsx` (`SheetContent` defaults to `side="right"` at line 42 and carries the correct slide-in transition: `data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full … data-[side=right]:data-starting-style:translate-x-[2.5rem]` at line 56).
  - In-repo exemplar: `src/components/talent/JobFilterSheet.tsx:38-44` already composes `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetFooter` for the talent-side filter drawer.
- Owner: `src/components/search/AllFiltersSheet.tsx`
- Scope and affected surfaces: `src/components/search/AllFiltersSheet.tsx` only. Sole consumer is `src/components/search/FilterBar.tsx:79` (verified by grep - no other importer), reached exclusively from the hirer search page.
- Uncertainty: none blocking. One known limitation stays as-is: `FilterBar.tsx:79` conditionally mounts the drawer (`{sheetOpen && …}`), so the closing animation never plays (the component unmounts immediately). That is pre-existing behavior (the Dialog's `zoom-out-95` never played either) and is deliberately kept, because the conditional mount is what guarantees a fresh `draft` per open (same rationale as JobFilterSheet's "Remount per open" comment at `JobFilterSheet.tsx:40`).

## Design decision

Replace the Dialog composition inside `AllFiltersSheet` with the project's `Sheet` primitives, `side="right"`. This is the component the design contract assigns to filter configuration, it removes all twelve `!important` position/shape overrides (the Sheet is already a right-anchored, full-height, unrounded panel), and it replaces the wrong center-zoom animation with the intended slide-in-from-right transition. The panel's identity - header with labeled Close button, collapsible sections, sticky Reset/"Show results (N)" footer, `sm:max-w-xl` width - is preserved via small className overrides, exactly how `JobFilterSheet` customizes the same primitive. No behavior, state, or data flow changes.

Layout note for the executor: `DialogContent` is a `grid` (hence the `!grid-rows-[auto_minmax(0,1fr)_auto]` hack), while `SheetContent` is `flex flex-col`. The existing middle section already carries `min-h-0 flex-1 overflow-y-auto`, which is precisely the flex-column idiom, so the grid-rows override is simply dropped - nothing replaces it.

## Reuse

- `Sheet`, `SheetContent` (default `side="right"`, built-in slide transition, `bg-popover`, `border-l`, `z-50`), `SheetHeader`, `SheetTitle`, `SheetFooter` from `src/components/ui/sheet.tsx`.
- `Button` (already imported), `Collapsible` family, `FilterSection` - all unchanged.
- Exemplar: `src/components/talent/JobFilterSheet.tsx` (Sheet with `open`/`onOpenChange` controlled from the parent, className overrides on `SheetContent`, `SheetHeader`/`SheetTitle`/`SheetFooter` composition, labeled apply button with live count).

## Changes

1. `src/components/search/AllFiltersSheet.tsx`
   - Change (a) - imports. Replace line 5:
     ```tsx
     import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
     ```
     with:
     ```tsx
     import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
     ```
   - Change (b) - root + panel + header. Replace lines 58-63:
     ```tsx
     <Dialog open={open} onOpenChange={next => {
       if (next) setDraft(filters)
       onOpenChange(next)
     }}>
       <DialogContent className="!inset-y-0 !left-auto !right-0 !top-0 !h-dvh !max-w-xl !translate-x-0 !translate-y-0 !grid-rows-[auto_minmax(0,1fr)_auto] !rounded-none !p-0 sm:!max-w-xl" showCloseButton={false}>
         <DialogHeader className="flex-row items-center justify-between border-b border-border px-5 py-4"><DialogTitle className="text-lg">All filters</DialogTitle><Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close</Button></DialogHeader>
     ```
     with:
     ```tsx
     <Sheet open={open} onOpenChange={next => {
       if (next) setDraft(filters)
       onOpenChange(next)
     }}>
       <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl" showCloseButton={false}>
         <SheetHeader className="flex-row items-center justify-between border-b border-border px-5 py-4"><SheetTitle className="text-lg">All filters</SheetTitle><Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close</Button></SheetHeader>
     ```
     Rationale for each override (do not add more): `side` is omitted because `"right"` is `SheetContent`'s default; `gap-0` cancels the base `gap-4` so the header/body/footer borders touch as today; `data-[side=right]:w-full` and `data-[side=right]:sm:max-w-xl` replace the base `data-[side=right]:w-3/4` / `data-[side=right]:sm:max-w-sm` (the `data-[side=right]:` prefix is required so tailwind-merge replaces the base utilities rather than leaving a higher-specificity conflict); `showCloseButton={false}` keeps the built-in X hidden because the header owns a labeled Close button (unchanged identity). All positional/shape hacks (`!inset-y-0`, `!right-0`, `!h-dvh`, `!rounded-none`, `!p-0`, `!grid-rows-[…]`, translate resets) are dropped with no replacement - the Sheet base classes provide right-anchored, full-height, unrounded, unpadded layout natively.
   - Change (c) - footer. Replace the wrapping div of lines 93-96:
     ```tsx
     <div className="flex items-center gap-3 border-t border-border bg-background p-4">
       <Button type="button" variant="outline" onClick={() => updateDraft({})}>Reset</Button>
       <Button type="button" className="flex-1 tabular-nums" onClick={() => { onApply(draft); onOpenChange(false) }}>Show results{count !== null ? ` (${count})` : ''}</Button>
     </div>
     ```
     with:
     ```tsx
     <SheetFooter className="flex-row items-center gap-3 border-t border-border bg-background p-4">
       <Button type="button" variant="outline" onClick={() => updateDraft({})}>Reset</Button>
       <Button type="button" className="flex-1 tabular-nums" onClick={() => { onApply(draft); onOpenChange(false) }}>Show results{count !== null ? ` (${count})` : ''}</Button>
     </SheetFooter>
     ```
   - Change (d) - closing tags. Replace lines 98-99 `</DialogContent>` / `</Dialog>` with `</SheetContent>` / `</Sheet>`.
   - Preserve:
     - The `onOpenChange` wrapper that re-seeds `draft` from `filters` on open (`if (next) setDraft(filters)`), and the `open`/`onOpenChange` prop contract - `Sheet` wraps the same Base UI Dialog root, so props are identical.
     - The debounced `previewCount` effect (lines 29-41), `pruneFiltersForCategory` draft logic, `openSections`/`ALWAYS_OPEN_SECTIONS` behavior, and the entire Collapsible section body (lines 64-92) - byte-for-byte unchanged.
     - The scrollable body's `min-h-0 flex-1 overflow-y-auto px-5 py-4` classes (line 64) - they are what makes the flex-column Sheet layout work.
     - The labeled "Close" ghost button in the header (identity + a11y), the `sr-only` active-filter-count span (line 97), and the "Show results (N)" apply button copy.
     - `SheetTitle` keeps `className="text-lg"` so the heading size does not shrink (Sheet's base title is `text-base`); it also satisfies Base UI's accessible-title requirement exactly as `DialogTitle` did.
   - Verify: on `/search`, tap "All filters" - the panel slides in from the right edge (translate transition, no center zoom), is full-height and flush to the right, full-width on mobile and capped at `max-w-xl` from the `sm` breakpoint, sections expand/collapse, the apply button shows a live count, Reset clears the draft, "Show results" applies filters and closes, and Esc/backdrop-click close it. Zero `!` utilities remain in the file (`grep '!' src/components/search/AllFiltersSheet.tsx` finds only `!==`/`count !== null` comparisons, no `!`-prefixed Tailwind classes).

## Scope

- Inherit: `FilterBar.tsx:79` → `SearchHeader.tsx:135` → hirer search page (`src/app/(app)/(hirer)/search/page.tsx:317`), both browse and AI modes - the drawer is shared and receives the change automatically.
- Verify: `FilterBar.tsx` is the only importer (grep-verified at 77a27a0); re-run the grep after the change to confirm nothing else picked up a dependency.
- Exclude:
  - `FilterBar.tsx`'s conditional mount (`{sheetOpen && …}`) stays - it guarantees a fresh draft per open; the consequent loss of the exit animation is pre-existing and accepted.
  - `OutreachModal` Dialog→Sheet migration (audit backlog B1) - separate plan.
  - Hand-rolled controls inside the drawer's `FilterSection` / `FilterPill` (audit backlog B5-B7) - separate concerns, untouched here.
  - `src/components/ui/dialog.tsx` and `src/components/ui/sheet.tsx` - shadcn-generated primitives, never edited (AGENTS.md "Never edit").

## Validation

- Product: a hirer refining a search opens "All filters", adjusts sections, and applies - underlying results stay visible behind the panel (DESIGN.md anchored-panel intent) and the rehearsed demo flow (query → refine → results) is unbroken.
- Interface: `/search` on iPhone-width viewport first (iOS Safari is the priority browser): panel is full-width, full-height, body scrolls independently, footer stays pinned; then ≥`sm` viewport: panel capped at `max-w-xl`, right-anchored with left border and backdrop blur. States: zero active filters (no count bubbles), many active filters (sections auto-open, count bubbles render, sr-only count updates), `previewCount` rejection (button falls back to "Show results" with no number), category switch inside the drawer (draft pruned). Confirm open motion is a rightward slide with fade, not a zoom.
- System: drawer now uses the same `Sheet` primitive as `JobFilterSheet` - no `!important` overrides, no second slide-over pattern introduced; both filter drawers in the app share one component family.
- Repository: `npm run lint && npm run typecheck && npm test` → passes (lint runs `--max-warnings 0`; the removed `Dialog*` imports must leave no unused-import warnings).

## Stop conditions

- Stop if `SheetContent`'s API in `src/components/ui/sheet.tsx` differs from the one cited here (no `side` default of `"right"`, no `showCloseButton` prop, or missing `data-[side=right]` width utilities) - the file may have been regenerated; re-derive the className overrides before editing.
- Stop if a second importer of `AllFiltersSheet` exists at execution time - scope would widen beyond the hirer search surface.
- Stop if the visual check shows the width overrides losing to the base classes (panel renders at `w-3/4` / `max-w-sm`) - that means tailwind-merge did not reconcile the `data-[side=right]:` variants and the approach needs the maintainer's input rather than reintroducing `!important`.

## Design documentation

- None - this change brings the drawer into compliance with the already-documented contract (DESIGN.md "Configure in place via anchored panel"); no new decision to record.
