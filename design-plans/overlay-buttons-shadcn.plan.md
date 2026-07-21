# All icon overlay buttons on result cards use shadcn Button variant="ghost" size="icon"

Written against: 77a27a0 (main). Audit evidence originally cited commit 09d7591; only `design-plans/*.md` files landed between the two - every product-source citation below was re-verified at 77a27a0 and line numbers are current.

## Evidence chain

- Surface: Hirer search result cards (`/search` grid via `src/app/(app)/(hirer)/search/page.tsx:435-446`) and every other consumer of `TalentCard` (e.g. `src/components/talent/SimilarTalent.tsx:17`). Two overlay regions on the card image: the bottom-right action cluster (message + shortlist) and the carousel prev/next arrows.
- Problem (audit findings B10, B11 of `design-plans/2026-07-21-search-surface-audit.md`):
  - B10: `src/components/talent/MessageNowButton.tsx:11-24` is a raw `<button>` with hand-written icon-button classes (`flex size-8 cursor-pointer items-center justify-center rounded-full ...`), rendered at `TalentCard.tsx:86` directly beside `ShortlistButton`, which is already a shadcn `Button variant="ghost" size="icon"` (`ShortlistButton.tsx:70-76`). Two implementations of the same 32px icon button sit in one overlay. They also disagree on shape: MessageNowButton is `rounded-full`, the adjacent ShortlistButton falls back to Button's default `rounded-lg`.
  - B11: `src/components/talent/TalentCardMedia.tsx:48-63` renders the carousel prev/next arrows as two raw `<button>` elements with a third hand-written icon-button recipe (`flex size-7 ... rounded-full bg-background/80 ...`).
- Design evidence:
  - `AGENTS.md:73`: "**Do not** hand-roll buttons, inputs, dialogs, badges, cards, or other controls when a shadcn equivalent exists in the project or registry."
  - `docs/design.md:216`: "The reusable interaction layer lives in `src/components/ui` and is configured with `components.json` using the shadcn `base-nova` style and Lucide icons. Use `Button` variants for actions ... Every interactive component needs a visible focus state, a disabled state, and a clear text label or accessible name." The raw buttons have no focus-visible treatment; shadcn Button provides `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`.
  - `docs/design.md:119-125`: `button-ghost` component token (transparent background, foreground text) is the documented style for quiet actions; `src/components/ui/button.tsx:16-17` implements it, and `:28` defines `icon: "size-8"` - identical to MessageNowButton's current `size-8`.
  - `TalentCardMedia.tsx:13-16` (comment): "Only the active image is mounted, so a 48-card grid doesn't fetch every image of every profile up front" - a documented perf choice that rules out replacing the hand-rolled carousel with shadcn `Carousel` (which mounts all slides). Only the arrow *buttons* are in scope.
- Owner: `src/components/talent/MessageNowButton.tsx`, `src/components/talent/TalentCardMedia.tsx` (arrow buttons only), plus one className on the `ShortlistButton` instance at `src/components/talent/TalentCard.tsx:88-91`.
- Scope and affected surfaces: `/search` grid (browse + AI modes), `SimilarTalent` grids on talent profiles (renders `TalentCard` without `onMessage`, so only the carousel arrows apply there).
- Uncertainty: none on the contract. One mechanical hazard is handled explicitly in Changes: shadcn Button's base class includes a press effect `active:not-aria-[haspopup]:translate-y-px` (`button.tsx:7`), which would clobber the arrows' `-translate-y-1/2` centering on press if both lived on the same element - the plan moves positioning to a wrapper element to isolate the transforms.

## Design decision

Rebuild both raw icon buttons on the existing shadcn `Button` with `variant="ghost" size="icon"`, keeping their overlay-specific presentation (translucent `bg-background` scrim, blur, shadow, circular shape, hover-reveal) as `className` overrides - exactly the composition pattern `ShortlistButton` already uses at `TalentCard.tsx:88-91`. This removes the two parallel hand-rolled icon-button implementations, and gives all overlay buttons the system's focus-visible ring, disabled handling, and press affordance for free.

Two deliberate presentation calls:

1. **Shape unifies on `rounded-full`.** Every other element overlaid on the card image is circular (match-score pill `TalentCard.tsx:73`, carousel dots `TalentCardMedia.tsx:73`, both raw buttons today). The `ShortlistButton` instance's default `rounded-lg` is the outlier in this context, so the overlay instance gets `rounded-full` added to its per-instance className (component and all other consumers untouched).
2. **Arrows grow from `size-7` (28px) to `size-8` (32px)** by adopting `size="icon"`. This matches the adjacent action cluster, and a larger tap target on an image-overlay control is strictly better on the priority browser (iOS Safari). Position anchors (`left-2` / `right-2` / `top-1/2`) are unchanged; the button grows 2px in each direction inside a 4:3 media area, which absorbs it without crowding the dots (`bottom-2`).

## Reuse

- `Button` from `@/components/ui/button` with `variant="ghost" size="icon"` (`size-8`, ghost hover, focus-visible ring, press translate).
- Overlay scrim recipe already in the codebase: `bg-background/90 shadow-sm backdrop-blur-sm hover:bg-background` (the `hover:bg-background` override wins over ghost's `hover:bg-muted` via the `cn`/tailwind-merge call in `button.tsx:52`).
- Motion tokens: `--duration-fast` (`src/app/globals.css:23`; 150ms, equal to Tailwind's default transition duration that Button's base transition uses).
- Exemplar: `src/components/talent/ShortlistButton.tsx:70-76` composed at `src/components/talent/TalentCard.tsx:88-91`.

## Changes

1. `src/components/talent/MessageNowButton.tsx`
   - Change: replace the raw `<button>` with shadcn `Button variant="ghost" size="icon"`. Full new file content (comments preserved verbatim):

     ```tsx
     'use client'

     import { MessageSquare } from 'lucide-react'
     import { Button } from '@/components/ui/button'

     // "Message now" straight from the card (client feedback 20 Jul 2026, after
     // the Collabstr reference) - opens the existing outreach flow without
     // visiting the profile. Rendered only when a handler is passed, so
     // server-rendered card grids (e.g. SimilarTalent) simply omit it.
     export function MessageNowButton({ name, onMessage }: { name: string; onMessage: () => void }) {
       return (
         <Button
           variant="ghost"
           size="icon"
           aria-label={`Message ${name}`}
           onClick={event => {
             // The whole card is a link - the button must not navigate.
             event.preventDefault()
             event.stopPropagation()
             onMessage()
           }}
           className="cursor-pointer rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-sm duration-[var(--duration-fast)] hover:bg-background"
         >
           <MessageSquare className="size-4" />
         </Button>
       )
     }
     ```

     Dropped classes and why: `flex items-center justify-center` (Button base is `inline-flex items-center justify-center`), `size-8` (provided by `size="icon"`), `transition-colors` (Button base already transitions color/background-color/opacity and more; keeping `transition-colors` would *narrow* the base transition list via tailwind-merge). `type="button"` is dropped; the component is never inside a form and the handler calls `preventDefault()` regardless - same as the adjacent `ShortlistButton`.
   - Preserve: `aria-label={`Message ${name}`}`; `preventDefault()` + `stopPropagation()` (the whole card is a link - the button must not navigate); the `MessageSquare` Lucide icon at `size-4`; `cursor-pointer` (raw button had it; Button does not add one); the `bg-background/90` scrim, shadow, blur, and `hover:bg-background`; the render-only-when-`onMessage`-passed contract (unchanged - gating lives in `TalentCard.tsx:85`).
   - Verify: on `/search`, the message button on a card is visually a 32px circle as before, opens the outreach modal without navigating, and now shows a visible focus ring on keyboard focus and a 1px press-down on click - identical to the shortlist button beside it.

2. `src/components/talent/TalentCardMedia.tsx`
   - Change (a): add `import { Button } from '@/components/ui/button'` after the existing imports (line 6).
   - Change (b): replace the two raw arrow `<button>` blocks (currently lines 48-63) with positioned wrappers around `Button`. The wrapper carries positioning and the hover-reveal opacity fade; the Button carries the visual recipe. This split is load-bearing: Button's base `active:not-aria-[haspopup]:translate-y-px` press effect sets the same translate as `-translate-y-1/2`, so vertical centering must live on an element the press effect never touches.

     Replace:

     ```tsx
     <button
       type="button"
       aria-label="Previous photo"
       onClick={step(-1)}
       className="absolute left-2 top-1/2 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-opacity duration-[var(--duration-fast)] hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
     >
       <ChevronLeft className="size-4" />
     </button>
     <button
       type="button"
       aria-label="Next photo"
       onClick={step(1)}
       className="absolute right-2 top-1/2 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-opacity duration-[var(--duration-fast)] hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
     >
       <ChevronRight className="size-4" />
     </button>
     ```

     with:

     ```tsx
     <span className="absolute left-2 top-1/2 z-10 -translate-y-1/2 transition-opacity duration-[var(--duration-fast)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
       <Button
         variant="ghost"
         size="icon"
         aria-label="Previous photo"
         onClick={step(-1)}
         className="cursor-pointer rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
       >
         <ChevronLeft className="size-4" />
       </Button>
     </span>
     <span className="absolute right-2 top-1/2 z-10 -translate-y-1/2 transition-opacity duration-[var(--duration-fast)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
       <Button
         variant="ghost"
         size="icon"
         aria-label="Next photo"
         onClick={step(1)}
         className="cursor-pointer rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
       >
         <ChevronRight className="size-4" />
       </Button>
     </span>
     ```

     Notes: the hover-reveal classes (`sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100`) target the `group` class on the Card wrapper in `TalentCard.tsx:65` and behave identically from the wrapper `span`. `size-7` intentionally becomes `size-8` via `size="icon"` (see Design decision). Button's hover background transition runs at Tailwind's default 150ms, equal to `--duration-fast`.
   - Preserve: the lazy-mount carousel structure exactly as-is - the file comment at lines 13-16 documents it as a perf choice ("Only the active image is mounted, so a 48-card grid doesn't fetch every image of every profile up front"); do NOT migrate to shadcn `Carousel`. Also preserve: `step()`'s `preventDefault()`/`stopPropagation()` (arrows must not trigger the card link), both `aria-label`s, always-visible arrows on mobile (`sm:` prefix means the opacity-0 reveal only applies ≥640px), the dot indicator block (lines 64-76) untouched, the `count > 1` gate, the `ChevronLeft`/`ChevronRight` Lucide icons at `size-4`, `bg-background/80` opacity level, and the initial-letter fallback.
   - Verify: on a multi-image card, arrows appear on hover (desktop) / always (mobile ≤640px), cycle photos without navigating, stay vertically centred **while pressed** (no jump - this is the wrapper-isolation check), and show a focus ring when tabbed to.

3. `src/components/talent/TalentCard.tsx` (line 88-91)
   - Change: add `rounded-full` to the overlay `ShortlistButton` instance's className so the bottom-right cluster shares one shape. Replace:

     ```tsx
     <ShortlistButton
       talentId={profile.id}
       className="bg-background/90 shadow-sm backdrop-blur-sm hover:bg-background"
     />
     ```

     with:

     ```tsx
     <ShortlistButton
       talentId={profile.id}
       className="rounded-full bg-background/90 shadow-sm backdrop-blur-sm hover:bg-background"
     />
     ```

     (`ShortlistButton` appends `className` after its own classes and Button runs everything through `cn`, so `rounded-full` wins over the base `rounded-lg`.)
   - Preserve: everything else in `TalentCard.tsx` - especially the list-view `ShortlistButton` at line 299 (no overlay scrim, keeps default shape) and the overlay cluster's own hover-reveal wrapper at line 84.
   - Verify: message and shortlist buttons in the card overlay are two identical 32px circles.

## Scope

- Inherit: `/search` grid + AI results (`page.tsx:435-446`, passes `onMessage` → both overlay buttons render); `SimilarTalent.tsx:17` (no `onMessage` → carousel arrows and shortlist only).
- Verify: `TalentListItem` (same file, `TalentCard.tsx:299`) - its `ShortlistButton` is not an overlay and must remain visually unchanged (default `rounded-lg`, no scrim).
- Exclude:
  - shadcn `Carousel` migration - explicitly ruled out by the documented lazy-mount perf choice (`TalentCardMedia.tsx:13-16`).
  - `ShortlistButton`'s hand-written Heroicons SVG (audit B12) and `SwipeStack`'s text-glyph/inline-SVG action buttons (audit B13) - separate findings, separate plans; SwipeStack's action buttons are not card *overlay* buttons.
  - `ShortlistButton` consumers outside the card overlay (`talent/[id]/page.tsx:177`, `SavedTalentRow.tsx:55`, `BookingCard.tsx:96`) - untouched; the `rounded-full` addition is per-instance in `TalentCard.tsx` only.

## Validation

- Product: run a rehearsed demo query on `/search`; on a result card, press an arrow (photo advances, no navigation), press the message icon (outreach modal opens, no navigation), toggle shortlist. All three behave exactly as before the change.
- Interface: iPhone-width viewport first (iOS Safari is the priority browser) - arrows and action cluster are always visible below `sm` and are comfortably tappable at 32px; ≥640px, hover and keyboard focus (`group-focus-within`) reveal them. Check a single-image card (no arrows render), a no-image card (initial fallback, no arrows), and dark mode (scrim `bg-background/80|90` adapts via token). Confirm arrows do not jump vertically while held pressed.
- System: zero raw `<button>` elements remain in `MessageNowButton.tsx` / `TalentCardMedia.tsx`; all three overlay buttons are `Button variant="ghost" size="icon"` + overlay-scrim className - one recipe, no parallel pattern. No new components, tokens, or dependencies introduced.
- Repository: `npm run lint && npm run typecheck && npm test` → passes (lint runs `--max-warnings 0`).

## Stop conditions

- Stop if the wrapper-span approach still shows a press-position glitch on the arrows (i.e., Button's `active:translate-y-px` interacting with positioning in an unexpected way) - do not stack `active:` overrides on the Button; report instead.
- Stop if tailwind-merge does not resolve `hover:bg-background` over ghost's `hover:bg-muted` (visible as a grey flash on hover) - that would mean the Button `cn` pipeline differs from what `button.tsx:52` shows, and the recipe needs rethinking rather than patching.
- Stop if any consumer outside `TalentCard`/`SimilarTalent`/search is found rendering these components (would widen visual blast radius beyond this plan's verification).
- Stop if the 28px→32px arrow growth visibly collides with the dot indicators or category chip on the smallest supported card width - flag for a sizing decision (`size="icon-sm"` is the 28px fallback) rather than improvising.

## Design documentation

- After acceptance, add to `DESIGN.md` (patterns file): image-overlay icon buttons on cards are `Button variant="ghost" size="icon"` with `rounded-full bg-background/80-90 shadow-sm backdrop-blur-sm hover:bg-background`, positioned by a wrapper element when they need transform-based centering (Button's press effect owns the button's own transform). Exemplar: `TalentCard` overlay cluster + `TalentCardMedia` arrows.
