# All select controls on the search surface use the shadcn Select primitive

Written against: 77a27a0 (main). Design contract DESIGN.md was introduced at 09d7591; both files cited below are unchanged at 77a27a0.

## Evidence chain

- Surface: Hirer AI search page `src/app/(app)/(hirer)/search/page.tsx`, specifically its header controls (`src/components/search/SearchHeader.tsx`) and the filter editor (`src/components/search/FilterSection.tsx`, rendered through `FilterPill.tsx` and `AllFiltersSheet.tsx`).
- Problem (two instances of one defect - hand-rolled native `<select>` where the project's shadcn Select exists):
  1. `src/components/search/SearchHeader.tsx:148-156` - the browse-mode sort control is a hand-styled native `<select>` (`className="h-8 cursor-pointer appearance-none rounded-lg border border-border bg-background px-2.5 text-xs ..."`) with two `<option>` children. It renders the platform picker on iOS, has no themed popup, no check indicator, and drifts visually from every other dropdown in the app.
  2. `src/components/search/FilterSection.tsx:76-79` - the `kind === 'single'` branch hand-rolls a native `<select>` (`className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ..."`) with an `<option value="">Any</option>` sentinel. Today exactly one filter definition uses this branch: `category` (`src/lib/filter-taxonomy.ts:49`).
- Design evidence:
  - `AGENTS.md:73`: "**Do not** hand-roll buttons, inputs, dialogs, badges, cards, or other controls when a shadcn equivalent exists in the project or registry."
  - `AGENTS.md:71`: "**Default:** use existing components under `src/components/ui/` or add them with `npx shadcn@latest add <component>`."
  - `docs/design.md:220`: "Do prefer shadcn primitives over bespoke controls."
  - `docs/design.md:216`: the interaction layer is "configured with `components.json` using the shadcn `base-nova` style and Lucide icons."
  - The shadcn equivalent already exists: `src/components/ui/select.tsx` (Base UI `@base-ui/react/select` v1.5.0 wrapper exporting `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`) and is already used on the discover page (`src/app/(app)/(talent)/discover/page.tsx:725-742`), in `JobFilterSheet.tsx:138-147` (`SheetSelect`), and inside a Dialog in `AdminAccountsPanel.tsx:287-296, 353-362`.
- Owner: `src/components/ui/select.tsx` (shadcn-generated, do not edit); consuming files listed under Changes.
- Scope and affected surfaces: `src/components/search/SearchHeader.tsx` and `src/components/search/FilterSection.tsx`. FilterSection's single-kind branch renders in two places on the search page: the `category` FilterPill dropdown (`src/components/search/FilterPill.tsx:35`, `compact` mode) and the All-filters drawer (`src/components/search/AllFiltersSheet.tsx:85`).
- Uncertainty: none blocking. The "Any" option maps to a `null` item value, which is the Base UI documented pattern and is supported by the installed typings (`node_modules/@base-ui/react/esm/select/root/SelectRoot.d.ts:134,138,142` - `value` accepts `null`; `items` accepts `ReadonlyArray<{ label: React.ReactNode; value: any }>`; `SelectItem.d.ts:30` - `value?: any`). No e2e spec targets either control (grep of `e2e/*.spec.ts` for "Sort talent" / selectOption returns nothing), so no test updates are required.

## Design decision

Replace both native `<select>` elements with the project's shadcn Select composition (`Select` + `SelectTrigger` + `SelectValue` + `SelectContent` + `SelectItem`), following the existing `SheetSelect` exemplar. This resolves the root problem - a parallel bespoke dropdown pattern living beside the sanctioned primitive on the flagship demo surface - and gives both controls the themed popup, check indicator, focus ring, and dark-mode behavior every other dropdown in the app already has. No behavior changes: same values, same handlers, same "Any" clearing semantics, same layout footprint.

## Reuse

- Component: `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `@/components/ui/select` (base-nova, Base UI). Pass the `items` prop on `Select` so `SelectValue` renders labels (per `SelectRoot.d.ts:97-108`).
- Sizing tokens already in the primitive: `SelectTrigger` default size is `h-8 rounded-lg border-input text-sm` (see `src/components/ui/select.tsx:44`), which matches the sort control's current 32px height; the filter control keeps `h-9 w-full` via `className` to stay aligned with sibling `Input` fields.
- Exemplar: `src/components/talent/JobFilterSheet.tsx:126-150` (`SheetSelect` - label + `items` + null-guarded `onValueChange`). Secondary exemplars: `src/app/(app)/(talent)/discover/page.tsx:725-742` (Select in a toolbar row), `src/components/admin/AdminAccountsPanel.tsx:353-362` (Select portalled from inside a Dialog - precedent for the AllFiltersSheet context).

## Changes

1. `src/components/search/SearchHeader.tsx`
   - Change: replace the native sort `<select>` with shadcn Select.
     - Add to the imports (after line 9, `import { Button } from '@/components/ui/button'`):

       ```tsx
       import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
       ```

     - Add a module-level constant after `type SortMode = 'newest' | 'available'` (line 13):

       ```tsx
       const SORT_OPTIONS: Record<SortMode, string> = {
         newest: 'Newest',
         available: 'Available first',
       }
       ```

     - Replace lines 147-157 exactly:

       ```tsx
               {!isAiMode && (
                 <select
                   aria-label="Sort talent"
                   value={sortMode}
                   onChange={e => onSortModeChange(e.target.value as SortMode)}
                   className="h-8 cursor-pointer appearance-none rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-2 focus:ring-ring/30"
                 >
                   <option value="newest">Newest</option>
                   <option value="available">Available first</option>
                 </select>
               )}
       ```

       with:

       ```tsx
               {!isAiMode && (
                 <Select
                   items={SORT_OPTIONS}
                   value={sortMode}
                   onValueChange={value => onSortModeChange((value ?? 'newest') as SortMode)}
                 >
                   <SelectTrigger aria-label="Sort talent" className="bg-background text-xs">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                       <SelectItem key={value} value={value}>{label}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               )}
       ```

   - Preserve: `aria-label="Sort talent"` (now on `SelectTrigger`); the `!isAiMode` render guard; the `sortMode`/`onSortModeChange` controlled wiring (the parent at `src/app/(app)/(hirer)/search/page.tsx:328-330` is untouched); the 32px control height (SelectTrigger default `data-[size=default]:h-8`) and `text-xs` label size so the row with the view-mode toggle (lines 158-179) does not shift; option labels "Newest" and "Available first" and values `newest`/`available` (the page serialises `sortMode` into the browse fetch at page.tsx:96).
   - Verify: in browse mode (empty query) the sort control renders as a shadcn trigger with chevron; opening it shows a themed popup with a check on the active item; choosing "Available first" re-fetches browse results sorted by availability; the control still disappears in AI mode; the popup renders above the sticky header (trigger sits inside a `fixed ... z-30` container when stuck - SearchHeader.tsx:73 - and `SelectContent` portals at `z-50`).

2. `src/components/search/FilterSection.tsx`
   - Change: replace the `kind === 'single'` native `<select>` with shadcn Select, using a `null`-valued item for "Any".
     - Add to the imports (after line 7, `import { Label } from '@/components/ui/label'`):

       ```tsx
       import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
       ```

     - Replace lines 72-82 exactly:

       ```tsx
         if (definition.kind === 'single') {
           return (
             <div className="space-y-2">
               {!compact && <p className="text-sm font-medium">{definition.label}</p>}
               <select value={typeof value === 'string' ? value : ''} onChange={event => update(event.target.value || undefined)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
                 <option value="">Any</option>
                 {definition.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
               </select>
             </div>
           )
         }
       ```

       with:

       ```tsx
         if (definition.kind === 'single') {
           const items = [
             { value: null, label: 'Any' },
             ...(definition.options ?? []).map(option => ({ value: option.value, label: option.label })),
           ]
           return (
             <div className="space-y-2">
               {!compact && <p className="text-sm font-medium">{definition.label}</p>}
               <Select
                 items={items}
                 value={typeof value === 'string' && value !== '' ? value : null}
                 onValueChange={next => update(typeof next === 'string' ? next : undefined)}
               >
                 <SelectTrigger aria-label={definition.label} className="h-9 w-full bg-background">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value={null}>Any</SelectItem>
                   {definition.options?.map(option => (
                     <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           )
         }
       ```

   - Preserve: the clearing semantics - selecting "Any" calls `update(undefined)`, which deletes the key from `SearchFilters` via the existing `update()` at lines 27-33 (exactly what `event.target.value || undefined` did); the `compact` label suppression; option `value`/`label` pairs from `definition.options` (for `category` these are the `SEARCH_CATEGORIES` values, which flow into the browse query and filter serialisation - do not remap them); the `h-9 w-full` footprint so it stays aligned with the `Input` fields in the same sheet; all other `kind` branches (`boolean`, `range`, `text`, multi fallthrough) untouched.
   - Verify: the Category pill on the search page opens its panel with a shadcn select showing "Any"; picking "Dancer" then "Show results" applies `category=dancer` and narrows browse results; re-opening and picking "Any" then "Show results" removes the category filter (active-pill styling clears); the same control works inside the "All filters" drawer, with the popup painting above the drawer (same portalled `z-50` pattern the admin Dialog already relies on).

## Scope

- Inherit: `src/components/search/FilterPill.tsx:35` and `src/components/search/AllFiltersSheet.tsx:85` (both render `FilterSection` and receive the new control with no changes of their own); `src/app/(app)/(hirer)/search/page.tsx` (renders `SearchHeader`, unchanged).
- Verify: FilterPill's `<details>` panel - the Select popup portals to `document.body`, so clicking an item must not close the `<details>` (it will not: FilterPill has no outside-click handler; the panel closes only via the "Show results" button at FilterPill.tsx:45). AllFiltersSheet's Dialog-based drawer - confirm popup stacking as noted above.
- Exclude: `src/components/talent/JobFilterSheet.tsx`, `src/app/(app)/(talent)/discover/page.tsx`, `src/components/admin/AdminAccountsPanel.tsx` (already compliant); `src/components/ui/select.tsx` (shadcn-generated, never hand-edit per AGENTS.md:55); the FilterPill `<details>`-to-Popover rebuild (audit finding B7, separate plan); the AllFiltersSheet Dialog-to-Sheet swap (audit finding F3, separate plan); any change to sort/filter values, fetch logic, or `SearchFilters` serialisation.

## Validation

- Product: as a hirer with an empty query, sort browse results by "Available first" and expect available talent listed first; filter to Category = Dancer via the pill and expect the result grid to narrow; reset to "Any" and expect the full set back. None of the rehearsed AI-query demo paths touch either control in AI mode (sort is browse-only), so the walkthrough cannot regress.
- Interface: `/search` in browse mode (grid, list, swipe views); sticky vs non-sticky header states (scroll down until the header pins, then open the sort popup); the Category pill panel and the "All filters" drawer; iOS Safari viewport first (~390px) - confirm the Select popup replaces the native iOS wheel/sheet picker and is tappable, then desktop widths; long option labels ("Photographer or videographer") stay on one line in the popup and truncate in the trigger (`*:data-[slot=select-value]:line-clamp-1` is built into the trigger); dark mode popup contrast.
- System: both controls now compose the same `@/components/ui/select` primitive as discover, JobFilterSheet, and admin - after this change, `grep -rn "<select" src --include="*.tsx"` must return zero product-source hits (no parallel native-select pattern remains).
- Repository: `npm run lint && npm run typecheck && npm test` → passes (lint runs `--max-warnings 0`; no unit test covers these components, so no test edits expected).

## Stop conditions

- Stop if `<SelectItem value={null}>` does not render or select correctly with `@base-ui/react` 1.5.0 at runtime (typings support it; if runtime disagrees, fall back to a `''`-valued item with `items` as a `Record` including an `''` key, and `onValueChange={next => update(next || undefined)}` - do not invent a sentinel value that could leak into `SearchFilters`).
- Stop if opening the Select inside the FilterPill `<details>` panel closes the panel or traps focus - that would mean the B7 Popover rebuild must land first, and this plan's FilterSection change should pause rather than patch around it.
- Stop if any additional `kind: 'single'` filter definitions exist beyond `category` with option values that collide with the "Any" semantics (at 77a27a0 there is exactly one; re-grep `kind: 'single'` in `src/lib/filter-taxonomy.ts` before starting).
- Stop if the change requires touching `src/components/ui/select.tsx` - the primitive is sufficient as-is; needing to edit it means the approach is wrong.

## Design documentation

- None required: this change brings the surface into compliance with rules already written in `AGENTS.md:69-74` and `docs/design.md:220`; no new convention is introduced.
