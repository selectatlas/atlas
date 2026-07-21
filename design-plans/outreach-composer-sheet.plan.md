# Outreach composer becomes an anchored right-hand Sheet keeping results visible behind it

Written against: 77a27a0 (current `main` HEAD; the governing DESIGN.md contract landed at 09d7591 and is unchanged since)

## Evidence chain

- Surface: The outreach composer, `src/components/outreach/OutreachModal.tsx`, opened from four contexts: the hirer search results page, the shortlist table, the talent-profile booking card, and the talent-profile contact button.
- Problem: The composer is a centered, blocking shadcn `Dialog` (`OutreachModal.tsx:151-152`: `<Dialog open={!!talent} ...><DialogContent className="max-w-lg">`). It covers the results the hirer was scanning, so composing outreach loses their place in the list - the exact failure the design contract names.
- Design evidence:
  - `DESIGN.md:100-104`, "Configure in place via anchored panel, not a route change": *"Anchor a slide-over/drawer (shadcn `Sheet`) to the trigger, keeping the underlying results visible and scrollable behind it. Reserve full routes for destinations users link to and share (a talent's full profile page); reserve modals for one-off, all-or-nothing decisions."* Its Use-for list names this surface verbatim: *"Talent quick-view from search results, **outreach composer**, filter configuration, admin record editing."*
  - `AGENTS.md` (UI components section): do not hand-roll or misuse primitives when a shadcn equivalent exists in the project; `src/components/ui/sheet.tsx` already exists and is consumed elsewhere.
  - Repo precedent for a right-hand Sheet: `src/components/messages/ThreadView.tsx:315-322` (`<SheetContent side="right" className="w-[85vw] gap-0 p-0 sm:max-w-sm">`).
- Owner: `src/components/outreach/OutreachModal.tsx` (sole definition; the Dialog wrapper lives only here).
- Scope and affected surfaces (all four render `<OutreachModal>` with the same props and inherit the change with zero edits):
  - `src/app/(app)/(hirer)/search/page.tsx:483` (import at :11)
  - `src/components/saved/ShortlistTable.tsx:240` (import at :23; only consumer passing `job`)
  - `src/components/talent/BookingCard.tsx:110` (import at :5)
  - `src/components/talent/ContactButton.tsx:54` (import at :5)
- Uncertainty: none. `Sheet` and `Dialog` are both built on `@base-ui/react/dialog` (`sheet.tsx:4`, `dialog.tsx:4`), so the controlled `open` / `onOpenChange` contract is identical - no state or handler changes required.

## Design decision

Swap the composer's wrapper from `Dialog`/`DialogContent` to `Sheet`/`SheetContent side="right"`, keeping every piece of composer behavior (AI draft generation, demo-mode branch, regenerate, send, sent-state redirect) untouched. This resolves the root problem because DESIGN.md classifies outreach as a *frequent, repeatable task performed while scanning a list* - the hirer contacts several candidates in a row - and assigns that class to the anchored Sheet so the result list stays visible and scrollable behind the panel. A centered Dialog is reserved for one-off, all-or-nothing decisions, which this is not.

The change is wrapper-only. No file rename: all four consumers import `OutreachModal` by name, and renaming would be unrelated churn across five files.

## Reuse

- `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` from `src/components/ui/sheet.tsx` (existing shadcn base-nova primitive; `side="right"` gives `inset-y-0 right-0 h-full` with slide-in translate animation and built-in close button + `sr-only` "Close" label).
- Mobile width value `w-[85vw]`: reuse from the repo's existing right-hand Sheet, `ThreadView.tsx:316`.
- Desktop width value `sm:max-w-md`: the repo's standard composer-dialog width (`SaveSearchButton.tsx:79`, `BroadcastDialog.tsx:63`, `NewMessageDialog.tsx:97`).
- Exemplar: `src/components/messages/ThreadView.tsx:315-322` (right Sheet composition) and `src/components/talent/JobFilterSheet.tsx:36-45` (Sheet with `SheetHeader`/`SheetTitle` structure).

## Changes

1. `src/components/outreach/OutreachModal.tsx`

   - Change (a) - imports. Replace lines 9-14:

     ```tsx
     import {
       Dialog,
       DialogContent,
       DialogHeader,
       DialogTitle,
     } from '@/components/ui/dialog'
     ```

     with:

     ```tsx
     import {
       Sheet,
       SheetContent,
       SheetHeader,
       SheetTitle,
     } from '@/components/ui/sheet'
     ```

   - Change (b) - opening wrapper. Replace lines 151-158:

     ```tsx
         <Dialog open={!!talent} onOpenChange={(open) => { if (!open) onClose() }}>
           <DialogContent className="max-w-lg">
             <DialogHeader>
               <DialogTitle>{job ? 'Invite to job' : 'Contact talent'}</DialogTitle>
             </DialogHeader>

             {talent && (
               <div className="space-y-4">
     ```

     with:

     ```tsx
         <Sheet open={!!talent} onOpenChange={(open) => { if (!open) onClose() }}>
           <SheetContent side="right" className="w-[85vw] gap-0 sm:max-w-md">
             <SheetHeader>
               <SheetTitle>{job ? 'Invite to job' : 'Contact talent'}</SheetTitle>
             </SheetHeader>

             {talent && (
               <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
     ```

     Rationale for the class deltas (all values already in the repo):
     - `SheetContent` has no built-in padding (unlike `DialogContent`'s `p-4`); `SheetHeader` carries `p-4`, so the body div takes `px-4 pb-4` to align with it.
     - `gap-0` (per `ThreadView.tsx:316`) because `SheetHeader`'s `p-4` already provides the header/body spacing; the default `gap-4` would double it.
     - `flex-1 overflow-y-auto` on the body: `SheetContent side="right"` is a full-height flex column, so the body must own scrolling when the iOS keyboard or landscape viewport compresses height. Pattern per `PortfolioGallery.tsx:185` (`overflow-y-auto` on the sheet's scrollable region).
     - `w-[85vw]` leaves the result list visibly peeking on mobile (the contract's point); `sm:max-w-md` (28rem) approximates the composer's previous `max-w-lg` comfort for the 5-row textarea on desktop.

   - Change (c) - closing wrapper. Replace lines 236-237:

     ```tsx
           </DialogContent>
         </Dialog>
     ```

     with:

     ```tsx
           </SheetContent>
         </Sheet>
     ```

   - Preserve (everything between the wrapper tags is untouched):
     - Component name and export `OutreachModal`, file path, and the full `OutreachModalProps` contract (`talent`, `job`, `onClose`, `onSent`) - consumers must not need edits.
     - Open semantics `open={!!talent}` and `onOpenChange={(open) => { if (!open) onClose() }}`.
     - The reset effect keyed on `[talent?.id, job?.id]` including both eslint-disable comments (lines 34-43).
     - `refreshDemoModeAndGenerate`, `generateMessage` (demo-mode branch with job/non-job draft copy, `/api/me/settings` tone-context fetch with silent fallback, `/api/outreach` generate call), `sendMessage` (demo short-circuit, `job_id` pass-through, 1200 ms sent-state timeout, `router.push` to the new thread).
     - Body content: talent Avatar header block (lines 160-173), the `job` invite context strip (175-179), the "AI-generated outreach message" label, the three-dot bounce generating indicator (184-196), `Textarea rows={5} className="resize-none rounded-2xl"`, the `text-destructive` error line, the Regenerate ghost button with its inline SVG (icon-library cleanup is a separate audit item; do not touch here), and the Send button's exact classes, label states (`✓ Sent!` / `Sending...` / `Send message`), and disabled logic.
     - Accessible close affordance: `SheetContent` renders the same ghost icon close button with `sr-only` "Close" that `DialogContent` did - do not pass `showCloseButton={false}`.
   - Verify: opening the composer from any trigger slides a panel in from the right edge (translate animation, not center zoom); the result list/table remains visible and scrollable behind the overlay; Escape, the X button, and backdrop click still call `onClose`; generate → edit → send → "✓ Sent!" → auto-close → thread redirect all behave exactly as before.

## Scope

- Inherit: `src/app/(app)/(hirer)/search/page.tsx`, `src/components/saved/ShortlistTable.tsx` (job-invite variant - confirm the "Inviting to {job.title}" strip renders in the sheet), `src/components/talent/BookingCard.tsx`, `src/components/talent/ContactButton.tsx`. No edits in any of them.
- Verify: `e2e/messaging.spec.ts` clicks `getByRole('button', { name: 'Send message' })` - those are the inbox `MessageComposer` (`aria-label="Send message"`, `MessageComposer.tsx:184`), not this component; outreach in e2e goes through the API directly. The label is preserved regardless, so no e2e drift.
- Exclude:
  - Renaming `OutreachModal` → `OutreachSheet` (five-file churn, no behavior value; record as follow-up naming note only).
  - Replacing the Regenerate button's inline SVG with a Lucide icon (separate icon-consistency finding).
  - `AllFiltersSheet.tsx` Dialog-faking-a-Sheet (separate finding F3 in the audit, own plan).
  - Any change to `/api/outreach`, demo-mode logic, or draft copy.

## Validation

- Product: As a hirer on `/search`, run an AI search, open the composer from a result card, and send the AI draft - the panel anchors right, results stay in view, and sending closes the panel and lands in the message thread. Repeat from `ShortlistTable` with a job invite ("Invite to job" title + job strip visible).
- Interface: `/search` (grid, list, and swipe modes), shortlist page, talent profile (BookingCard and ContactButton). States: generating (bounce indicator), generated draft, edit, error (`Could not generate message`), sending, sent. Content extremes: long talent name, long job title in the invite strip, long edited message (body scrolls inside the sheet, header stays pinned). Viewports: iPhone-width iOS Safari first (sheet at `w-[85vw]`, results peeking behind; keyboard open while editing the textarea must not trap the Send button off-screen - body `overflow-y-auto` covers this), then tablet/desktop (`sm:max-w-md`). Check light and dark themes (Sheet uses the same `bg-popover` surface tokens Dialog did).
- System: composer now uses the same `Sheet` primitive as `ThreadView`, `JobFilterSheet`, and `PortfolioGallery` - no new pattern, no Dialog-with-overrides hybrid, no custom widths beyond repo-existing values (`w-[85vw]`, `sm:max-w-md`).
- Repository: `npm run lint && npm run typecheck && npm test` → passes (lint runs `--max-warnings 0`; there are no unit tests for this component, so `npm test` guards against collateral only).

## Stop conditions

- Stop if `SheetContent side="right"` does not accept the controlled `open`/`onOpenChange` flow identically to Dialog (it should - both wrap `@base-ui/react/dialog` - but if focus trapping or close-on-backdrop behaves differently in a way that breaks the send→redirect sequence, stop and report rather than patching with overrides).
- Stop if any consumer turns out to depend on Dialog-specific layout (e.g. a snapshot/e2e asserting centered positioning) - none was found, but widening into consumer edits exceeds this plan.
- Stop if the rehearsed demo flow (search → contact → send in demo mode) visually regresses on iPhone-width Safari; this is an investor-demo surface and must not ship degraded.

## Design documentation

- After acceptance, note in the audit follow-up (or DESIGN.md changelog if one is started) that the outreach composer now conforms to "Configure in place via anchored panel"; the only remaining Dialog-as-panel offender on the search surface is `AllFiltersSheet` (audit F3). Optional follow-up: rename `OutreachModal` → `OutreachSheet` in a dedicated mechanical commit.
