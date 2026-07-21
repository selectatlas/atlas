# UI audit - Hirer AI search surface (2026-07-21)

Audit of the hirer search surface against the governing design contracts, run with a trace → proof-gated audit → adversarial vetting workflow. Read-only on product source; no product files were modified. 19 candidates raised, 18 survived falsification, 1 killed. Duplicates merged across lenses → 16 unique findings.

## Design language

- **Audited surface**: `src/app/(app)/(hirer)/search/page.tsx` (+ `loading.tsx`, shared `(app)/layout.tsx` chrome), `src/components/search/*`, and the result-card family it provably renders (`TalentCard`, `TalentCardMedia`, `SwipeStack`, `ShortlistButton`, `MessageNowButton`, `VerifiedBadge`, `TalentLevelBadge`) plus `OutreachModal` opened from cards.
- **Design sources**: `DESIGN.md` (UX pattern contract, commit 09d7591), `docs/design.md` (visual tokens), `AGENTS.md` (shadcn/base-nova conventions).
- **Documented decisions**: match scores use the `match-score` component token (brand-lime, never a generic badge); semantic status tokens; Lucide icons via components.json; anchored Sheet for filter config / outreach composer / quick view; AI output as an artefact card; no hand-rolled controls where a shadcn equivalent exists.
- **Governing owners and consumers**: `src/components/ui/*` (Button, Badge, Select, Popover, Sheet, Dialog), token layer in `src/app/globals.css`.
- **Explicit exceptions**: None documented.

## Top findings (reported)

### F1 - Parsed search intent is discarded; no AI artefact row renders (HIGH impact)

- **Problem**: `/api/search` returns the LLM-parsed intent (`parsed`: category, skills, location, availability, …) but `runAiSearch` (page.tsx:175-196) reads only `data.error`/`data.results` and discards it. The DESIGN.md-mandated parsed-intent chip row ("Understood: contemporary dancer, London, available now") never exists; the only AI feedback is the plain "{n} AI matches / in {ms}ms" meta text.
- **Contract**: DESIGN.md "AI output as an artefact, not prose" - names the parsed-intent chip row above search results as its first use case.
- **Runtime**: route.ts:192 returns `parsed` → page discards it; grep confirms no consumer.
- **Correction**: Store `data.parsed` and render it in AI mode between SearchHeader and results as an artefact chip row, reusing the existing agent-summary container styling (page.tsx:357-358: `rounded-xl border border-border/80 bg-muted/40` + Sparkles `text-primary`) with each parsed field as a shadcn `Badge variant="secondary"` chip, plus AI label and action per the pattern anatomy.
- **Files**: page.tsx, SearchHeader.tsx (reference), api/search/route.ts (read-only reference).

### F2 - Match score colour splits across view modes of one page (HIGH confidence, trivial fix)

- **Problem**: Swipe view renders the AI match score as `bg-accent` (blue) while grid and list render the identical value as `bg-brand-lime` - the token docs reserve lime to "mean match confidence" and forbid generic-badge treatment.
- **Contract**: docs/design.md:159-160, :196, :216; internal contradiction with TalentCard.tsx:73/:252 on the same route.
- **Runtime**: SwipeStack.tsx:311 (`bg-accent text-accent-foreground`) vs TalentCard.tsx:73/:252 (`bg-brand-lime … text-black`), all fed from one `displayResults` array.
- **Correction**: SwipeStack.tsx:311 → `bg-brand-lime text-black` (other `bg-accent` uses at :174-175/:234 are action affordances; untouched).
- **Files**: SwipeStack.tsx.

### F3 - "All filters" drawer fakes a Sheet with 11 `!important` overrides on Dialog (MEDIUM impact)

- **Problem**: AllFiltersSheet forces shadcn Dialog into a right-edge panel (`!inset-y-0 !right-0 !h-dvh …`) but Dialog's zoom-in-95/zoom-out-95 animation survives, so the panel centre-zooms at the screen edge instead of sliding in. DESIGN.md assigns filter configuration to shadcn Sheet; `JobFilterSheet` (talent side) already uses Sheet correctly.
- **Contract**: DESIGN.md "Configure in place via anchored panel" (filter configuration enumerated); AGENTS.md:73 no-hand-rolled-controls.
- **Runtime**: page.tsx:317 → SearchHeader.tsx:135 → FilterBar.tsx:79 → AllFiltersSheet.tsx:62.
- **Correction**: Replace Dialog composition with Sheet/SheetContent (`side="right"` is the default) per JobFilterSheet.tsx:13, dropping the positional `!` overrides, keeping width/padding utilities.
- **Files**: AllFiltersSheet.tsx.

## Improve first

**F1.** It is the headline feature's missing proof-of-intelligence: Atlas's differentiator is that an LLM understood the query, and the parsed intent - already computed, already returned by the API - is the only artefact that can show it. Every rehearsed demo query passes through this surface. F2 and F3 are cheaper but lower leverage.

## Backlog (survived vetting, not in the top three)

| # | Finding | Correction | Files |
| --- | --- | --- | --- |
| B1 | Outreach composer is a centered blocking Dialog; DESIGN.md names it verbatim as a Sheet use case | Swap Dialog wrapper → Sheet in OutreachModal (all 4 consumers are outreach contexts) | OutreachModal.tsx |
| B2 | SwipeStack drops `match_reasons` (local type omits the field) while grid/list render why-this-match pills for the same dataset | Widen SwipeStack's TalentResult type; render reason pills per TalentCard.tsx:133-140 | SwipeStack.tsx |
| B3 | Deep-search agent summary lacks artefact anatomy (no AI label/type header, no action) | Add header strip + "AI summary" label + Regenerate wired to existing runDeepSearch, per OutreachModal precedent | page.tsx |
| B4 | List-view score pill says "78%" while grid says "78% match" (colour-independent status rule) | TalentCard.tsx:253 → `{matchScore}% match` | TalentCard.tsx |
| B5 | Browse-mode sort control is a hand-styled native `<select>` | Replace with shadcn Select (used on discover, JobFilterSheet, admin) | SearchHeader.tsx:148-156 |
| B6 | FilterSection kind `single` hand-rolls a native `<select>` | Replace with shadcn Select per JobFilterSheet SheetSelect pattern | FilterSection.tsx:72-81 |
| B7 | FilterPill dropdown is a hand-rolled `<details>/<summary>` with absolute panel (already consumes popover tokens) | Rebuild on Popover/PopoverTrigger/PopoverContent | FilterPill.tsx |
| B8 | Availability status uses raw emerald palette instead of the themed `success` token | `text-emerald-600 dark:text-emerald-400` → `text-success`; `bg-emerald-500` → `bg-success` | TalentCard.tsx:191-192, :295 |
| B9 | Match-reason chips are hand-rolled spans imitating Badge on a card that uses Badge for sibling chips | Replace with `Badge variant="secondary"` + className overrides | TalentCard.tsx:133-140, :265-272 |
| B10 | MessageNowButton is a raw `<button>` beside a shadcn-Button ShortlistButton in the same overlay | Rebuild on Button `variant="ghost" size="icon"` (size identical) | MessageNowButton.tsx |
| B11 | TalentCardMedia carousel arrows are raw `<button>` elements | Rebuild on Button ghost/icon; keep lazy-mount carousel structure (documented perf choice) | TalentCardMedia.tsx:48-63 |
| B12 | ShortlistButton bookmark is a hand-written Heroicons SVG (stroke 1.8) among 8 Lucide siblings (stroke 2) | Replace with Lucide `Bookmark`, keep fill-on-active | ShortlistButton.tsx:77-89 |
| B13 | SwipeStack uses text glyphs (✕ ✓) and inline SVGs instead of Lucide | Replace with Lucide X, Check, Undo2, Eye, MapPin | SwipeStack.tsx |

## Killed in vetting

- Saved-search dialog has no scope (personal vs shared) control: contract and runtime were accurate, but DESIGN.md says "sets scope (personal vs shared with the team/agency)" and Atlas has no team/agency model on this surface - the correction would invent product intent, so the finding fails gate 3.
