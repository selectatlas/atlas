# Every icon on the search surface comes from the configured Lucide set

Written against: commit 77a27a0 (main). Source audit (`design-plans/2026-07-21-search-surface-audit.md`, findings B12 + B13) was written at 09d7591; every citation below was re-verified against the current working tree at 77a27a0 and line numbers are current.

## Evidence chain

- Surface: Hirer AI search results, `src/app/(app)/(hirer)/search/page.tsx` - specifically the result-card overlay (`ShortlistButton` inside `TalentCard`) and the swipe view (`SwipeStack`), both rendered from the page's single `displayResults` array.
- Problem (direct observation):
  1. **B12** - `src/components/talent/ShortlistButton.tsx:77-89` renders a hand-written Heroicons bookmark `<svg>` (`strokeWidth={1.8}`, Heroicons path `M17.593 3.322c1.1.128…`) inside a shadcn `Button`. Its direct sibling in the same card overlay, `MessageNowButton` (`src/components/talent/MessageNowButton.tsx:3,22`), uses Lucide `MessageSquare` at stroke 2. The grid/list card around it uses Lucide `Eye, Heart, MapPin` (`TalentCard.tsx:3`). One icon in the overlay is visibly lighter-stroked and off-library.
  2. **B13** - `src/components/talent/SwipeStack.tsx` uses raw text glyphs and inline Heroicons SVGs for all five of its iconographic controls: `✕` (U+2715, line 199, Pass button), `✓` (U+2713, line 237, Contact button), an inline undo-arrow SVG (lines 211-213, Undo button), an inline eye SVG (lines 224-227, View profile button), and an inline map-pin SVG (lines 285-288, location row). Every one of these icons already exists as a Lucide component used elsewhere on this exact surface.
- Design evidence:
  - `components.json:13` - `"iconLibrary": "lucide"` is the configured icon library for the project.
  - `docs/design.md:216` - "The reusable interaction layer lives in `src/components/ui` and is configured with `components.json` using the shadcn `base-nova` style and Lucide icons."
  - `AGENTS.md:73` - "**Do not** hand-roll buttons, inputs, dialogs, badges, cards, or other controls when a shadcn equivalent exists in the project or registry." Hand-written SVG copies of icons that the configured library already ships are the icon-level instance of this rule.
  - In-repo precedent on the same surface: `TalentCard.tsx:3` (`Eye, Heart, MapPin`), `MessageNowButton.tsx:3` (`MessageSquare`), `SearchHeader.tsx:4` (`Grid2X2, List, MoveHorizontal, Sparkles, X`), `FilterBar.tsx:4` (`RotateCcw`, …), `BookingCard.tsx:4,104` (Lucide `Bookmark` already imported and rendered elsewhere in the talent component family).
- Owner: `src/components/talent/ShortlistButton.tsx`, `src/components/talent/SwipeStack.tsx`.
- Scope and affected surfaces:
  - `SwipeStack` has exactly one consumer: `src/app/(app)/(hirer)/search/page.tsx` (verified by grep).
  - `ShortlistButton` has five consumers, all of which inherit the corrected icon: `TalentCard.tsx:88` (grid overlay) and `:299` (list row), `src/components/saved/SavedTalentRow.tsx:55`, `src/app/(app)/talent/[id]/page.tsx:177`, `src/components/talent/BookingCard.tsx:96`.
- Uncertainty: none blocking. Two facts an executor might otherwise re-derive, verified here:
  1. All six needed exports exist in the installed `lucide-react`: `Bookmark`, `X`, `Check`, `Undo2`, `Eye`, `MapPin` (verified with `node -e "require('lucide-react')"` against `node_modules`).
  2. Rendered bookmark size does not change. The current bookmark `<svg>` carries `w-5 h-5`, but shadcn `Button`'s base class `[&_svg:not([class*='size-'])]:size-4` (`src/components/ui/button.tsx:7`) compiles to a higher-specificity descendant rule (class + element + attribute `:not()` beats the bare `.w-5`/`.h-5` utilities), so the icon already renders at 16px. Replacing it with a `size-4` Lucide `Bookmark` preserves the rendered size and matches the `size-4` `MessageSquare` sibling in the same overlay.
  3. No unit test or Playwright spec asserts on the `✕`/`✓` glyphs, the inline SVG paths, or the shortlist/swipe aria-labels (verified by grep across `src/**/*.test.ts*` and `e2e/`).

## Design decision

Replace every hand-written icon on the search surface with the equivalent component from the configured Lucide set, changing nothing else: same buttons, same handlers, same aria-labels, same colours, same layout. This resolves the root problem (a single surface mixing three icon sources - Lucide, Heroicons copies, and Unicode text glyphs - producing visible stroke-weight and optical-size drift between siblings) by making `lucide-react` the sole icon source, which is exactly what `components.json` already declares. Text glyphs additionally render at the mercy of the platform font (U+2713/U+2715 differ between iOS and desktop fonts); Lucide components render identically everywhere, which matters for the phone-first investor demo.

The one behaviour worth keeping from the hand-written bookmark - fill-on-active - transfers directly: Lucide components forward the `fill` prop to the svg root, so `fill={shortlisted ? 'currentColor' : 'none'}` works unchanged.

## Reuse

- `lucide-react` components already in the dependency tree and already used on this surface: `Bookmark`, `X`, `Check`, `Undo2`, `Eye`, `MapPin`. No new dependency, no new pattern.
- Exemplar (Bookmark, including `text-primary`-style colouring via className): `src/components/talent/BookingCard.tsx:104` - `<Bookmark className="size-3.5 text-primary" />`.
- Exemplar (icon inheriting Button's svg sizing, sibling in the same overlay): `src/components/talent/MessageNowButton.tsx:22` - `<MessageSquare className="size-4" />`.
- Exemplar (MapPin in a plain metadata row, explicit size): `src/components/talent/TalentCard.tsx:277` - `<MapPin className="size-3.5" />`.
- Exemplar (X used as an icon on this surface): `src/components/search/ActiveFilterChips.tsx:3` / `SearchHeader.tsx:4`.

## Changes

1. `src/components/talent/ShortlistButton.tsx`
   - Change: add the Lucide import and replace the inline svg (lines 77-89) with `Bookmark`.

     Add after line 5 (`import { Button } from '@/components/ui/button'`):

     ```tsx
     import { Bookmark } from 'lucide-react'
     ```

     Replace this exact block (lines 77-89):

     ```tsx
       <svg
         className="w-5 h-5"
         fill={shortlisted ? 'currentColor' : 'none'}
         viewBox="0 0 24 24"
         stroke="currentColor"
         strokeWidth={1.8}
       >
         <path
           strokeLinecap="round"
           strokeLinejoin="round"
           d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
         />
       </svg>
     ```

     with:

     ```tsx
       <Bookmark className="size-4" fill={shortlisted ? 'currentColor' : 'none'} />
     ```

   - Preserve: the `Button variant="ghost" size="icon"` wrapper and its `onClick` (preventDefault + toggle), the conditional `text-amber-500 hover:text-amber-600` active colouring and `className` pass-through (line 74), the dynamic `aria-label` (line 75), the `loading`/`toggling` state machine and demo-mode sessionStorage branch, the fill-on-active behaviour (filled bookmark when `shortlisted`).
   - Verify: bookmark renders at the same 16px as before (see Uncertainty note 2) at stroke 2, visually matching the `MessageSquare` beside it in the card overlay; clicking still toggles outline ↔ filled amber; no `<svg>` literal remains in the file.

2. `src/components/talent/SwipeStack.tsx`
   - Change: add the Lucide import and make five icon substitutions. Do not touch drag logic, keyboard handling, indicators, or the score pill.

     Add after line 10 (`import { Button } from '@/components/ui/button'`):

     ```tsx
     import { Check, Eye, MapPin, Undo2, X } from 'lucide-react'
     ```

     a. **Pass button glyph** (line 199). Replace the lone text child `✕` of the Pass `Button` with `<X className="size-6" />`, and remove the now-dead `text-xl` from that button's className, i.e. line 197:

     ```tsx
     className="size-14 rounded-full bg-muted text-xl text-muted-foreground shadow-sm hover:text-foreground"
     ```

     becomes

     ```tsx
     className="size-14 rounded-full bg-muted text-muted-foreground shadow-sm hover:text-foreground"
     ```

     (`text-xl` existed only to size the text glyph; `size-6` = 24px is the standard icon proportion for a 56px circular target and reads at least as large as the old 20px-font glyph.)

     b. **Undo button svg** (lines 211-213). Replace:

     ```tsx
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
             </svg>
     ```

     with:

     ```tsx
             <Undo2 className="size-4" />
     ```

     c. **View-profile button svg** (lines 224-227). Replace:

     ```tsx
           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
             <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
           </svg>
     ```

     with:

     ```tsx
           <Eye className="size-4" />
     ```

     d. **Contact button glyph** (line 237). Replace the lone text child `✓` of the Contact `Button` with `<Check className="size-6" />`, and remove `text-xl` from that button's className, i.e. line 234:

     ```tsx
     className="size-14 rounded-full bg-accent text-xl text-accent-foreground shadow-sm hover:bg-accent/80"
     ```

     becomes

     ```tsx
     className="size-14 rounded-full bg-accent text-accent-foreground shadow-sm hover:bg-accent/80"
     ```

     e. **Location map-pin svg in `CardContent`** (lines 285-288). Replace:

     ```tsx
             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
               <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
             </svg>
     ```

     with (matching the exemplar at `TalentCard.tsx:277`; this element is inside a plain `div`, not a `Button`, so the explicit size class is required):

     ```tsx
             <MapPin className="size-3.5" />
     ```

   - Preserve: all `onClick` handlers, `setLastAction` calls, and `advance()` sequencing on Pass/Contact; `aria-label="Pass"`, `"Undo last action"` (+ `title`), `"View profile"`, `"Contact"`; the conditional render of the Undo button on `lastAction`; every other className token on the four action buttons (sizes `size-14`/`size-10`, `rounded-full`, colours including the amber Undo treatment at line 209); the drag/velocity/damping gesture system, keyboard arrows, reduced-motion handling, pointer capture; the CONTACT/PASS drag indicator badges (lines 172-186 - these are words, not icons); the `✨` empty-state emoji (line 132 - decorative empty-state art, not a control icon, and outside audit finding B13); the AI match score pill (lines 308-315 - owned by `design-plans/match-presentation-parity.plan.md`, do not touch here).
   - Verify: swipe view shows crisp stroke-2 icons on all four action buttons and the location row; icons render identically on iOS Safari and desktop (no font-dependent glyph shapes); no `<svg>` literal and no `✕`/`✓` character remains in the file; drag, keyboard, and undo behaviour unchanged.

## Scope

- Inherit: all five `ShortlistButton` consumers receive the corrected bookmark automatically - search grid overlay and list row (`TalentCard.tsx:88, :299`), saved-talent row (`SavedTalentRow.tsx:55`), talent profile page (`talent/[id]/page.tsx:177`), booking card (`BookingCard.tsx:96`). Swipe view changes reach only the hirer search page (sole `SwipeStack` consumer).
- Verify: `src/app/(app)/talent/[id]/page.tsx` header - the bookmark there previously rendered without the overlay background; confirm it still aligns with adjacent controls at its (unchanged) 16px rendered size. Confirm the two `size-14` swipe action buttons still feel balanced next to the `size-10` Undo/Eye buttons with the new `size-6` icons.
- Exclude:
  - `SwipeStack.tsx:311-312` score pill colour/copy and the `TalentResult` type widening - owned by `design-plans/match-presentation-parity.plan.md` (audit F2/B4/B2). If that plan has already been applied, the line numbers above may shift; re-anchor on the quoted code, which is unique in the file.
  - `SwipeStack.tsx:132` `✨` empty-state emoji - decorative content, not a control icon; not part of finding B13.
  - `MessageNowButton.tsx` raw-`<button>` wrapper (audit B10) and `TalentCardMedia.tsx` carousel arrows (audit B11) - separate findings, already Lucide-iconed, out of this plan's scope.
  - The CONTACT/PASS drag-indicator text badges - words by design, not glyph icons.

## Validation

- Product: run an AI search as a hirer, switch to swipe view. Pass (X), Contact (Check), View profile (Eye) and - after one action - Undo (Undo2) all render as line icons and perform their actions; the card's location row shows the Lucide pin. In grid view, hover/tap a card: bookmark toggles outline → filled amber and persists on reload.
- Interface: `/search` in grid, list, and swipe modes; talent profile page and saved-talent list for the inherited bookmark; shortlisted-active state (filled amber) vs default; iOS Safari viewport first (390px) - confirm the swipe action icons are crisp and identical to desktop rendering, which the old U+2713/U+2715 glyphs were not.
- System: `git grep -n '<svg' src/components/talent/ShortlistButton.tsx src/components/talent/SwipeStack.tsx` returns nothing; `git grep -n '✕\|✓' src/components/talent/SwipeStack.tsx` returns nothing; no new icon pattern introduced - only `lucide-react` imports consistent with `components.json:13`.
- Repository: `npm run lint && npm run typecheck && npm test` → passes (lint runs `--max-warnings 0`; the removed `text-xl` tokens and added imports must leave no unused-import warnings - all five SwipeStack imports are used).

## Stop conditions

- Stop if any of the quoted code blocks no longer match the file verbatim (another plan from this audit batch - notably `match-presentation-parity.plan.md` - may have edited `SwipeStack.tsx` first). Re-anchor edits on the quoted code rather than line numbers; if the quoted code itself is gone, stop and reconcile with the applied plan before proceeding.
- Stop if `Bookmark`, `X`, `Check`, `Undo2`, `Eye`, or `MapPin` fails to import from the installed `lucide-react` (would indicate a dependency change since verification).
- Stop if the filled bookmark state does not render (Lucide `fill` prop not reaching the svg root would indicate a lucide-react API change) - do not work around it by reintroducing a hand-written svg.

## Design documentation

- After acceptance, record in `DESIGN.md` (or `docs/design.md` component section): "All icons come from `lucide-react` (the `components.json` icon library). Hand-written icon SVGs and Unicode glyph icons (✓, ✕, arrows) are not permitted in components; stateful fills (e.g. active bookmark) use the Lucide component's `fill` prop."
