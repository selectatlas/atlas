# Marketplace Improvements Plan

Source: `docs/marketplace-mechanics-preview.html` - a 108-pattern teardown of Upwork, Bumble and Fiverr (Mobbin research, desktop web, compiled 17 Jul 2026). Each item below cites the pattern it steals; the source doc's screenshots are the visual reference when building.

Organizing insight from the teardown: **"a confidence signal only works living next to the action it's meant to inform."** Upwork puts the score where the decision is made, Fiverr puts the comparison one click from the price. Every item here follows that rule - trust and status data moves onto the surface where the hirer or talent acts, never into a settings page.

Prioritization rule: Atlas is an investor demo (see `AGENTS.md`), so items are ordered by **demo impact per unit of effort**, not by architectural purity. The pre-next-walkthrough shortlist is items **4, 1, 6** (in that order: cheapest demo insurance first).

Execution conventions (apply to every item):

- One item = one focused PR.
- New domain logic gets a colocated `*.test.ts` in `src/lib/`.
- Schema changes are append-only migrations in `supabase/migrations/` with RLS, covered by pgTAP + integration tests.
- New API routes get happy-path, 401 and 403 tests.
- Validate with `npm run lint && npm run typecheck && npm test` before marking an item done.

---

## Phase 1 - Trust at the point of decision

Upwork's "every surface doubles as a trust ledger" section. Atlas already computes trust data (match scores, completeness, `verifiedAt`) but only match scores reach the decision surfaces.

### 1. [x] Verified badge on search cards and shortlist rows

- **Pattern**: Upwork "Identity verification (IDV) badge" - a recurring cross-role trust signal surfaced where hiring decisions happen.
- **Current state**: `src/components/talent/VerifiedBadge.tsx` exists ("Atlas Verified", driven by `verifiedAt`) but is only mounted on full profile surfaces. Search cards (`src/components/talent/TalentCard.tsx`, both `TalentCard` and `TalentListItem`) and shortlist rows (`src/components/saved/SavedTalentRow.tsx`) show no verification signal.
- **Change**: pass `verifiedAt` through the search and shortlist queries and mount `VerifiedBadge` (compact variant) beside the name on `TalentCard`, `TalentListItem` and `SavedTalentRow`. Seed a majority of demo profiles as verified so result grids read as trustworthy.
- **Demo value**: high, near-zero effort - the badge appears in every search the investor runs.

### 2. [x] Profile completeness meter + checklist modal on talent home

- **Pattern**: Upwork "Profile completeness meter" - persistent bar opens a weighted checklist modal with a "4.5x more likely to get hired" stat; completed items collapse with green checks.
- **Current state**: two overlapping libs - `src/lib/profile-completeness.ts` (weighted 10-item model, powers `ProfileCompletenessCard` inside `src/components/profile/TalentProfileEditor.tsx`) and `src/lib/profile-completion.ts` (simpler 7-check percent, used on `src/app/(app)/home/page.tsx`). No checklist modal anywhere.
- **Change**: consolidate `profile-completion.ts` into `profile-completeness.ts` (one model, one test file), then extend `ProfileCompletenessCard` with a shadcn `Dialog` checklist: per-item weight, done/missing state, a "profiles at 100% get X more outreach" stat line, completed items in a collapsed "Show completed" section. Mount the meter on talent home, opening the modal.
- **Demo value**: makes the talent side of the walkthrough feel alive and coached, and de-duplicates a lib.

### 3. [x] Shortlist comparison table

- **Pattern**: Upwork "Reviewing proposals / shortlisting" - a comparison table of stats, qualifications and bids with inline actions, one click from the decision.
- **Current state**: `src/components/saved/SavedTalentView.tsx` renders two tabs (Shortlisted / Liked) of stacked `SavedTalentRow`s with minimal fields (name, headline, city, skills, saved date). No side-by-side comparison.
- **Change**: add a table view to the Shortlisted tab using the shadcn Data Table pattern (`@/components/ui/data-table` + TanStack, per `AGENTS.md` - no raw `<table>`): columns for verified, category, top skills, rate, availability, and inline Message / Invite-to-job actions. Widen the shortlist query in `/api/shortlist`-backed fetch to include rate and availability fields. Keep the card list as the mobile default (iOS Safari first); table on desktop.
- **Demo value**: the "compare your shortlist" beat is one of the strongest hirer-flow moments in the source doc.

---

## Phase 2 - Discovery momentum

Feeds the headline AI search and makes the two-sided loop legible.

### 4. [x] Empty-search suggestion chips (demo insurance)

- **Pattern**: Upwork "Global search / autocomplete" (personalized "Try searching for" chips on empty focus) + Fiverr "Popular Right Now" trending pills.
- **Current state**: `src/components/search/SearchHeader.tsx` has only a static placeholder example; the empty state is copy-only. Seed scenarios in `src/lib/seed/data.ts` are engineered for specific queries (e.g. the Bollywood-dancers-in-London flagship query) but nothing surfaces them.
- **Change**: when the search input is focused and empty (and in the no-results state), render 4-6 clickable suggestion chips sourced from a constant colocated with the seed scenarios, so every chip is a query the demo world answers strongly. Clicking a chip runs the search.
- **Demo value**: highest insurance per line of code - the investor taps a chip and the flagship AI search fires perfectly. Do this first.

### 5. [x] Saved searches + new-match alerts for hirers

- **Pattern**: Upwork "Saved searches & job alerts" - name and store a filter set, get a live alerts feed with per-item dismiss.
- **Current state**: no saved-search concept anywhere; filter state lives only in the URL via `src/components/search/useSearchFilters.ts`. Notifications are synthesized live from messages/applications/outreach in `src/lib/inbox-server.ts` (no notifications table).
- **Change**: new `saved_searches` table (new numbered migration, RLS: owner-only, pgTAP + integration tests) storing name + query + filter JSON. "Save search" button in the search header; saved searches listed on the hirer home. Extend the inbox synthesis in `inbox-server.ts` with a `saved_search` notification kind that reports new matching talent since last view (count query at read time - no cron needed for demo scale).
- **Demo value**: shows the AI search compounding over time - "Atlas keeps scouting for you."

### 6. [x] Job pipeline stepper + stage tabs on job detail

- **Pattern**: Upwork "Invite-to-job & invited-freelancer tracking" (persistent job-status stepper above every job screen) + "Reviewing proposals" tabbed inbox.
- **Current state**: `src/app/(app)/(hirer)/jobs/[id]/page.tsx` shows a job card plus a flat applicant list where status is changed via a bare `<select>`. `ApplicationStatus = 'sent' | 'viewed' | 'responded' | 'shortlisted' | 'hired'` already exists (`src/types/index.ts`), and `src/lib/seed/demo-world.ts` seeds ~22 applications spanning every status.
- **Change**: add a persistent stepper (Post → Review applicants → Shortlist → Hire) above the job detail, and replace the flat list with shadcn `Tabs` (All / Viewed / Responded / Shortlisted / Hired) with counts per tab. Status changes move to explicit actions (Shortlist / Hire buttons) instead of the dropdown. No schema change - purely presentational over the existing status enum.
- **Demo value**: instantly demoable with existing seed data; makes the hirer loop legible in one glance.

---

## Phase 3 - Chat as workspace

The teardown's shared finding: in all three products, chat carries structured objects (milestones, offers, clocks), not just text.

### 7. [x] Structured system cards in message threads

- **Pattern**: Upwork "Messaging center UX" (milestone/payment/meeting system cards inline in the thread) + Fiverr custom-offer cards.
- **Current state**: `src/components/messages/MessageBubble.tsx` renders text + timestamp + "Seen" only. Thread events (application received, outreach sent, shortlisted, hired) never appear in-thread.
- **Change**: add a `kind` column to messages (new migration; default `'text'`), emit system messages when an application is created, outreach is sent, or an application status changes to shortlisted/hired, and render `kind !== 'text'` as distinct inline cards in `MessageBubble`/`ThreadView` (icon, title, contextual link to the job/application). Emission points: `POST /api/applications`, `POST /api/outreach` (send action), `PATCH /api/applications/[id]`.
- **Demo value**: threads stop looking like SMS and start looking like a workspace - the single biggest perceived-maturity jump in messaging.

### 8. [x] "Your move" pill + pre-hire timeline in the context rail

- **Pattern**: Bumble "Conversation list" (colored "Your Move" pill legible without opening the thread) + Upwork "pre-hire activity timeline" stepper.
- **Current state**: unread logic (`isThreadUnread`, "Seen") exists in `src/lib/inbox.ts`; `src/components/messages/ContextRail.tsx` has a "How it started" section linking to the originating job or outreach, but no stage view. No whose-turn indicator.
- **Change**: derive "Your move" from last-sender + unread state in `inbox.ts` (pure function + test) and render it as a pill on `ConversationListItem`. Extend ContextRail's "How it started" into a vertical stage timeline (Outreach sent / Applied → Replied → Shortlisted → Hired) driven by the linked application/outreach status.
- **Demo value**: urgency and progress visible at the inbox level - borrowed from Bumble's best mechanic without the 24-hour gimmick.

### 9. [x] In-app review authoring (two-stage)

- **Pattern**: Upwork "Reviews & feedback" and Fiverr "Leaving a review" - both split a private score from a public review with sub-ratings.
- **Current state**: display-only. `src/lib/reviews.ts` summarizes `talent_reviews` (single 1-5 rating + body), rendered by `ReviewsSection`/`ReviewHighlights`/`RatingStars` on talent profiles. Reviews are created only by seed (`src/lib/seed/demo-world.ts`); there is no `POST /api/reviews`.
- **Change**: migration adding sub-ratings (Communication, Reliability, Craft) and a private 0-10 recommend score to `talent_reviews` (nullable, so existing rows and display keep working). New `POST /api/reviews` route - auth required, hirer must have a hired application with that talent (ownership check), 401/403/happy-path tests. Two-step dialog on the talent profile / job page for eligible hirers, reusing `RatingStars`. Extend `reviews.ts` summaries to include sub-rating averages.
- **Demo value**: closes the loop the seed data already implies; sub-ratings make profile trust data look earned.

---

## Phase 4 - Status ladder + monetization story

Investor narrative, visual-first. The teardown's contrast: Bumble's status resets every swipe; Fiverr's compounds. Atlas should compound.

### 10. [x] Talent level track

- **Pattern**: Fiverr "Seller level & badge progression" - New → Level 1 → Level 2 → Top Rated as connected nodes, each metric a progress bar against a numeric threshold.
- **Current state**: no level/tier concept anywhere in the codebase (grep-verified). Real inputs already exist: reviews (`reviews.ts`), application/outreach response behavior, completed (hired) bookings.
- **Change**: new `src/lib/talent-level.ts` + colocated test - pure function computing New / Rising / Established / Top Rated from review average, review count, hired count and response rate, with per-metric thresholds. Render a compact level badge on `TalentCard` and a full progress-vs-thresholds panel on the talent's own profile editor. No new tables initially; compute at read time.
- **Demo value**: answers "what keeps talent on the platform" - status that compounds.

### 11. [x] Monetization surfaces (mockup-grade)

- **Pattern**: Bumble "Spotlight" / persistent upsell stack (perishable, duration-priced boosts) + Fiverr "Fiverr Pro" (business-buyer tier with vetting and perks).
- **Current state**: zero monetization primitives (grep-verified: no boost/premium/tier/billing anywhere). Greenfield.
- **Change**: two polished static surfaces, no billing: a talent "Spotlight" upsell card (get seen first in search for 7 days, with a mock countdown state) and a hirer "Atlas Pro" pricing page (vetted-talent access, saved-search alerts, priority support - tie perks to items 5 and 10). Routes behind the existing auth, plain server components, clearly non-functional purchase buttons (toast "coming soon").
- **Demo value**: one screen answers the "how does this make money" question in every investor meeting. Keep it visual-only; do not build entitlements.

### 12. [x] Notifications bell dropdown

- **Pattern**: Upwork "Notifications" - header bell opens a compact dropdown (latest 3 + "See All") with per-item icons and inline actions.
- **Current state**: the bell in `src/components/layout/AppTopBar.tsx` is a plain `<Link>` to `/notifications` with a `NavCountBadge`; the full page (`src/components/notifications/NotificationsPage.tsx`) lists synthesized notifications (`message | application | outreach` kinds from `inbox-server.ts`).
- **Change**: wrap the bell in a shadcn `Popover`/`DropdownMenu` showing the latest 3 notifications (reusing the existing fetch + row rendering) with a "See all" link to the page. Keep the direct link behavior on mobile.
- **Demo value**: small polish item; makes the top bar feel like a real product during idle moments in the walkthrough.

---

## How to execute

1. Work top to bottom within a phase; phases 1-2 before 3-4. If time-boxed before a walkthrough, ship items 4, 1, 6 first.
2. One item per PR, validated with `npm run lint && npm run typecheck && npm test`. Items 5, 7 and 9 touch schema/RLS: also run `supabase test db` and `npm run test:integration` against local Supabase.
3. Items 1, 4, 6, 10 may need small seed adjustments (`npm run seed`) so the demo world exercises the new surface - keep seed changes inside the same PR.
4. When building any item, open `docs/marketplace-mechanics-preview.html` to the named pattern - the captured screens are the visual spec.
