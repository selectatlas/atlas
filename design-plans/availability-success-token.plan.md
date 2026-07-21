# Availability status uses the semantic success token, self-theming in dark mode

Written against: 77a27a0 (main). The governing DESIGN.md contract landed at 09d7591; the target file `src/components/talent/TalentCard.tsx` is identical at both commits - all line numbers below were re-verified at 77a27a0.

## Evidence chain

- Surface: Hirer AI search results (`src/app/(app)/(hirer)/search/page.tsx`, grid view via `TalentCard` and list view via `TalentListItem`) plus the "Similar talent" strip on talent profile pages (`src/components/talent/SimilarTalent.tsx`, which renders `TalentCard`).
- Problem: The availability status in both card variants is coloured with raw Tailwind emerald palette classes instead of the project's semantic `success` token:
  - `src/components/talent/TalentCard.tsx:191-192` (grid card footer): `text-emerald-600 dark:text-emerald-400` on the label span and `bg-emerald-500` on the status dot. The dot has no dark variant at all - it renders the same fixed `#10b981`-family green in both themes rather than the themed success colour.
  - `src/components/talent/TalentCard.tsx:295` (list item availability column): `text-emerald-600 dark:text-emerald-400`.
  Raw palette classes bypass the token layer, require a hand-written `dark:` override to approximate theming (and the dot omits even that), and drift from the documented success colour (`#167a52` light / `#65c89d` dark) - emerald-600 is `#059669`, a different green.
- Design evidence:
  - `src/app/globals.css:120-121` (light): `--success: #167a52; --success-foreground: #ffffff;` and `:194-195` (inside `.dark` starting at line 174): `--success: #65c89d; --success-foreground: #17251f;`. Exposed as Tailwind utilities via `:15-16`: `--color-success: var(--success); --color-success-foreground: var(--success-foreground);` - so `text-success` and `bg-success` exist today and self-theme through the `.dark` class (`@custom-variant dark` at globals.css:5), no `dark:` override needed.
  - `DESIGN.md:21` ("Inline status badges for workflow states"): "Coloured pill badges using the semantic tokens (success, warning, error) with 1-2 word labels, always in the same column position in tables and lists."
  - `docs/design.md:19-20` token table: `success: "#167A52"` / `on-success: "#FFFFFF"`, and `:220` ("Do's and Don'ts"): "Do use semantic tokens such as `bg-primary` and `text-muted-foreground`."
  - Audit source: `design-plans/2026-07-21-search-surface-audit.md`, backlog finding B8.
- Owner: `src/components/talent/TalentCard.tsx` (both the `TalentCard` and `TalentListItem` exports live here).
- Scope and affected surfaces: `src/components/talent/TalentCard.tsx` only. Rendered by `src/app/(app)/(hirer)/search/page.tsx` (line 435 `TalentCard`, line 455 `TalentListItem`) and `src/components/talent/SimilarTalent.tsx` (line 17 `TalentCard`).
- Uncertainty: none. Line numbers, class strings, token definitions, and consumers were all re-verified at 77a27a0.

## Design decision

Replace the raw emerald classes with the semantic `success` token utilities that already exist in the token layer. This is a class-string-only change: `text-success` replaces the `text-emerald-600 dark:text-emerald-400` pair (the token self-themes via `.dark`, so the `dark:` override is deleted, not translated), and `bg-success` replaces `bg-emerald-500` on the status dot - which also fixes the dot's missing dark-mode treatment as a side effect. This resolves the root problem (a status colour hard-wired to a palette instead of the semantic layer) rather than patching it, keeps the availability green consistent with every other success-token usage in the app, and means future theme changes to `--success` propagate automatically.

## Reuse

- Tokens: `text-success` and `bg-success` (from `--color-success` in `src/app/globals.css:15`, values at :120/:194). No new tokens, components, or variants.
- Exemplar: `src/app/design-system/page.tsx:253` (`bg-success text-success-foreground` badge) and `:333` (`text-success` heading) - the design-system reference page already consumes these exact utilities.

## Changes

1. `src/components/talent/TalentCard.tsx`
   - Change (grid card footer, lines 190-195). Current code:

     ```tsx
     {profile.availability && (
       <span className="inline-flex max-w-[50%] items-center gap-1 truncate text-emerald-600 dark:text-emerald-400">
         <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
         <span className="truncate">{profile.availability}</span>
       </span>
     )}
     ```

     Replace with:

     ```tsx
     {profile.availability && (
       <span className="inline-flex max-w-[50%] items-center gap-1 truncate text-success">
         <span className="size-1.5 shrink-0 rounded-full bg-success" />
         <span className="truncate">{profile.availability}</span>
       </span>
     )}
     ```

   - Change (list item availability column, lines 295-297). Current code:

     ```tsx
     <div className="hidden w-24 shrink-0 text-right text-[11px] text-emerald-600 dark:text-emerald-400 sm:block">
       {profile.availability || "—"}
     </div>
     ```

     Replace with:

     ```tsx
     <div className="hidden w-24 shrink-0 text-right text-[11px] text-success sm:block">
       {profile.availability || "—"}
     </div>
     ```

   - Preserve: everything else in both blocks - the `profile.availability &&` conditional render, the `"—"` fallback in the list column, the `max-w-[50%]` + `truncate` overflow guards, `size-1.5 shrink-0 rounded-full` dot geometry, `hidden … sm:block` responsive gating and `w-24 text-right text-[11px]` column sizing, and the surrounding footer/border/layout structure. No props, handlers, or aria attributes are involved in these spans. Do not touch the emerald usages elsewhere in the repo (see Exclude).
   - Verify: on `/search` (grid and list views) and on a talent profile's "Similar talent" strip, availability text and dot render in `#167a52` in light mode and `#65c89d` in dark mode (toggle the `.dark` class); no `emerald` class remains in `TalentCard.tsx` (`grep -n emerald src/components/talent/TalentCard.tsx` returns nothing).

## Scope

- Inherit: `src/app/(app)/(hirer)/search/page.tsx` (grid via `TalentCard`, list via `TalentListItem`) and `src/components/talent/SimilarTalent.tsx` - both receive the change automatically with no edits.
- Verify: those two consumers render availability correctly in both themes; the list-view availability column keeps its width/alignment (class-string colour swap only, so layout is unchanged by construction - a visual glance suffices).
- Exclude: other raw-emerald availability/success usages found in the repo but outside this finding's audited surface and scope - `ShortlistTable.tsx:172-173`, `FilterPanel.tsx:120`, `BookingCard.tsx:49`, `ContactButton.tsx:27`, `TalentLevelPanel.tsx:95`, `ProfileCompletenessCard.tsx`, `ApplicationPreviewDialog.tsx:70`, `DemoActivity.tsx`, discover pages, guides page, and `JobCover.tsx:13` (decorative gradient, not a status colour). They are candidates for a follow-up token-migration pass; do not fold them into this change.

## Validation

- Product: run a rehearsed demo search as a hirer; result cards still show the availability line (e.g. "Available now") with a green dot in grid view and a green right-aligned column in list view. The signal reads identically to before in light mode (slightly deeper green) and correctly themed in dark mode.
- Interface: `/search` in grid and list modes, and `/talent/[id]` "Similar talent" section. States: profile with availability set, profile without (grid footer span absent; list column shows "—" in success colour - acceptable, unchanged behaviour). Content extreme: long availability string still truncates at `max-w-[50%]` in grid. Viewports: iPhone-width iOS Safari first (grid card footer is the mobile-visible case; the list availability column is `sm:block` so desktop-only), then desktop both themes.
- System: confirms reuse of the existing `success` token; introduces no new class patterns, no new `dark:` overrides, no parallel green. TalentCard.tsx becomes emerald-free.
- Repository: `npm run lint && npm run typecheck && npm test` → passes (no TS surface changes; lint runs `--max-warnings 0`).

## Stop conditions

- Stop if `text-success` / `bg-success` fail to compile to CSS (would indicate the `@theme inline` mapping at globals.css:15-16 is not being picked up by Tailwind v4) - do not fall back to re-adding raw palette classes; report instead.
- Stop if the current code at TalentCard.tsx:191-192 or :295 no longer matches the snippets above (file drifted past 77a27a0) - re-verify before editing.
- Stop if asked to also migrate the excluded emerald usages - that is a scope widening requiring its own plan.

## Design documentation

- None required - this change brings the code into line with contracts that already exist (`DESIGN.md:21`, `docs/design.md:220`). Optionally, a follow-up audit note could list the remaining raw-emerald usages (see Exclude) as a candidate migration.
