# Atlas - UX Design Patterns

Reusable interaction and layout patterns for Atlas. Check this file before designing a new surface - if a pattern exists, adapt it rather than inventing a new one. Visual tokens (colours, typography, spacing) live in `docs/design.md`; component conventions (shadcn/ui, `base-nova`) live in `AGENTS.md`.

Each pattern states the problem it solves, the solution, and when NOT to use it. When a new pattern proves itself in the product, append it here in the same format.

---

## Layout

### Spacing scale by role

**Problem.** `docs/design.md` defines the spacing tiers in prose ("16px card inset, 24px to separate related groups, 32-48px to separate sections") but never says which Tailwind class each maps to. Three different values ended up doing similar jobs across pages, and a page-by-page audit could not tell drift from intent.

**Solution.** Pick the class by the *role* the gap plays, not by eye. The role, not the visual size, is what makes it consistent.

| Role | Class | Value |
|---|---|---|
| Card inset (padding inside any card) | `p-4` | 16px |
| Icon-to-text inside a card row | `gap-3` | 12px |
| Heading to the content it labels | `mb-3` | 12px |
| Cards in a grid (stat tiles, quick actions, result cards) | `gap-4` | 16px |
| Stacked list rows in one column (conversations, jobs, shortlists) | `flex flex-col gap-4` | 16px |
| Related groups within one flow | `space-y-6` | 24px |
| Independent sections on a page | `flex flex-col gap-6` | 24px |

Grid gap matches the card's own inset (both 16px), so a grid of cards reads as evenly spaced inside and out.

Use `flex flex-col gap-4` (not `space-y-4`) for stacked card lists: rows are usually wrapped in `<Link>`, which renders as an inline `<a>` and ignores vertical margin from `space-y`.

Use `flex flex-col gap-6` (not `space-y-6` / `space-y-8`) for page-level section stacks for the same reason when any section is a bare `<Link>`.

**Related groups vs sections.** These are the two most confused tiers. A *related group* is a continuous flow the user reads as one thing - on `/search`, the query header, parsed-intent chips and results are one group at `gap-6`. A *section* is an independent block that would still make sense on its own - on `/home`, the stat grid and the conversations list are separate sections at `gap-6`. When in doubt, ask whether a heading between the two blocks would feel natural; if yes, it is a section.

**When NOT to use it.** These rules govern layout containers only. Spacing *inside* a skeleton placeholder mirrors the real content it stands in for, so a `space-y-3` between skeleton lines inside a card is correct and is not list-row spacing. Do not normalise skeletons to this table.

---

## Data display

### Metric cards with context

- **Problem**: Raw numbers without context are meaningless to decision-makers (hirers scanning a dashboard, admins reviewing platform health).
- **Solution**: Always pair a metric value with (1) a label explaining what it is, (2) a comparison (vs last period, vs platform average), and (3) a directional indicator with semantic colour. Group related metrics in a 3 or 4-column grid.
- **Use for**: Hirer dashboard (applications received, response rate), admin dashboard (signups, searches run, outreach sent).
- **Do NOT use** when comparison data isn't available or would mislead - a bare number is better than a fake trend.

### Inline status badges for workflow states

- **Problem**: Users need to scan state across many items at a glance (applications, job postings, outreach threads).
- **Solution**: Coloured pill badges using the semantic tokens (success, warning, error) with 1-2 word labels, always in the same column position in tables and lists.
- **Use for**: Application status (Applied, Shortlisted, Declined), job status (Draft, Live, Closed), outreach status (Sent, Replied).
- **Do NOT use** when there are more than 5 distinct states - simplify the state model first, don't add more colours.

### Colour-independent status

- **Problem**: Colour alone fails for colour-blind users and washes out on phones in daylight (investors demo on phones - this matters).
- **Solution**: Every status pairs a word with a number and/or directional glyph: "92% match ↑", "3 of 5 skills matched". Colour reinforces; it never carries the meaning alone.
- **Use for**: Match scores, availability indicators, admin health metrics.

### Believable numbers need provenance

- **Problem**: A bare score or percentage ("87% match") reads as made up, especially to a sceptical audience.
- **Solution**: Two techniques, used together where space allows:
  1. **Cohort provenance** - describe what the number was computed against: "ranked against 214 dancers in London available this month" beats a bare confidence percentage.
  2. **Labelled range** - when showing where a value sits (e.g. day rate vs typical range), print the low/typical/high values at the ends of a linear bar with the talent's value as a labelled marker and a signed delta.
  3. **Freshness** - roster size and recency are provenance too: "from 2,400 profiles · 34 added this week" beside a result count signals a live dataset, which is itself a trust signal. Freshness numbers must be computed from real rows, never hardcoded.
- **Use for**: Match scores in search results, rate expectations on profiles, any AI-derived ranking.
- **Do NOT** hardcode or fabricate the provenance - Atlas match scores are real (pgvector similarity + structured boosts); describe the actual computation inputs.

### Calm, dense evidence cards

- **Problem**: A card carrying a verdict, a score, a delta, and supporting detail becomes a pile of competing chips, borders, and colours.
- **Solution**:
  - Merge verdict + delta into ONE sentence under the headline value ("Strong match - 4 of 5 required skills, available from August").
  - Line-item detail as plain numbers, not badges: "Contemporary: 8 yrs (required: 5+)".
  - Borders only on the outermost container - never card-in-card.
  - One accent colour per view; words carry above/at/below distinctions.
  - Methodology behind a plain text disclosure ("How is this scored?"), not a boxed expander.
- **Use for**: Talent match cards, profile detail panels, outreach preview cards.

### AI output as an artefact, not prose

- **Problem**: AI-generated content (parsed search intent, generated outreach drafts) blended into ordinary UI text is neither trusted nor editable.
- **Solution**: Wrap AI-produced output in a distinct artefact card: a header strip (icon + type + timestamp) separating it from surrounding prose, a subtle tinted background, an "AI" label, and an explicit action (Edit, Regenerate, Explain).
- **Use for**: The parsed-intent chip row above search results ("Understood: contemporary dancer, London, available now"), outreach message drafts, admin AI summaries.
- **Do NOT use** for insight that would interrupt the user's current flow - defer it instead.

### Contextual AI insights, not isolated widgets

- **Problem**: AI insights in separate widgets get ignored; users don't connect them to the task in front of them.
- **Solution**: Surface AI insight inline, adjacent to the data it explains, with a subtle highlight and an "Explain" action. The match-score explanation belongs on the talent card, not in a sidebar.
- **Use for**: Why-this-match explanations, search refinement suggestions ("3 more matches if you widen to Greater London").

---

## Search, lists, and views

### One grammar reused across every view

- **Problem**: Different views of the same dataset (grid of talent cards, table view, shortlist) drift into subtly different header/grouping components, so users relearn each one and maintenance triples.
- **Solution**: One grouped-header component (icon or colour dot + name + count + primary action + overflow menu), reused verbatim across list groups, grid sections, and saved-view headers. Grid vs table is a render toggle over one dataset, not a separate feature.
- **Use for**: Search results, shortlists, applicant lists on a job.
- **Adapt, don't force**: views with genuinely different information needs (e.g. a calendar of availability) get an adapted anatomy, not the same one jammed in.

### Saved searches as named, scoped objects

- **Problem**: Hirers rebuild the same filter combination every session because it has nowhere to live.
- **Solution**: The moment filters are applied, surface a "Save search" action that names the view, optionally describes it, and sets scope (personal vs shared with the team/agency). Treat the saved search as a first-class object with its own name, not a disposable query string.
- **Use for**: Talent search filters, admin user/report filters.
- **Skip** for genuinely one-off filtering with no recurrence.

### Filter / Sort / Group as separate controls

- **Problem**: Merging "which subset" and "how it's arranged" into one mega-menu makes filtering feel like configuring a database.
- **Solution**: Independent entry points for Filter, Sort, and Group, each collapsing to a rule-count pill once active ("Filters · 3"). Nested AND/OR logic lives only inside Filter.
- **Use for**: Talent search, applicant tables, admin data tables (pairs with the shadcn Data Table pattern mandated in `AGENTS.md`).
- **Skip** for short lists (<20 items) where a single sort dropdown suffices.

---

## Interaction and forms

### Progressive disclosure for complex forms

- **Problem**: Long forms overwhelm users and kill completion (talent onboarding, job posting).
- **Solution**: Essential fields first; advanced/optional fields behind "Show more" or accordion sections. Group related fields. Smart defaults everywhere a sensible default exists.
- **Use for**: Job posting form, talent profile setup, outreach composer settings.
- **Skip** for forms under ~6 fields, or where every field is genuinely required and equally important.

### Configure in place via anchored panel, not a route change

- **Problem**: Opening a full page or new route for a frequent, repeatable task (quick-viewing a profile, editing a shortlist, composing outreach) loses the user's place in the list they were scanning.
- **Solution**: Anchor a slide-over/drawer (shadcn `Sheet`) to the trigger, keeping the underlying results visible and scrollable behind it. Reserve full routes for destinations users link to and share (a talent's full profile page); reserve modals for one-off, all-or-nothing decisions.
- **Use for**: Talent quick-view from search results, outreach composer, filter configuration, admin record editing.

### Save placement: card header vs dialog footer

- **Problem**: Settings surfaces accumulate several "where does Save live" conventions (top of card, bottom of form, silent autosave, dialog footer), and users can't predict which applies.
- **Solution**: Two contexts, two fixed placements:
  1. **Card on a scrolling page** (settings, profile sections) - Save lives in the card's header actions, top-right, disabled until the form is dirty. No Cancel needed.
  2. **Modal/dialog** - Save + Cancel in the dialog footer, bottom-right, Cancel immediately left of Save.
  - Never place Save at the foot of a form inside a card on a multi-card page. Never mix silent autosave and explicit Save within one settings area - pick one behaviour per area.
- **Use for**: Account settings, talent profile editing, admin configuration.
- **Exception**: a dedicated full-page edit route with no separate read view can use a single top-right "Done" with autosave underneath.

### Show the ceiling, gate it visibly

- **Problem**: Hiding unavailable or role-gated features makes the product look thinner than it is and turns "does this exist?" into a support question.
- **Solution**: Render the gated control fully, then disable it with a small badge or padlock directly on the label - never remove it from view.
- **Use for**: Role-gated surfaces (talent seeing hirer-only tools, features flagged "coming soon" in the demo).
- **Skip** where seeing the control could mislead about security/compliance guarantees.

---

## Navigation

### Fixed pages vs record collections in the sidebar

- **Problem**: A flat sidebar that mixes stable product surfaces (Dashboard, Inbox, Settings) with growing data-driven collections (Jobs, Shortlists, Saved searches) either keeps growing or gets crammed into arbitrary groups.
- **Solution**: Keep fixed pages as a small stable list; render data-driven collections as their own section, each item expandable to show 1-2 recently-viewed records inline. Optionally a cross-type "Pinned" section above both.
- **Current guidance**: Atlas's nav is small enough that a flat list is correct today. Adopt this split only if the per-role nav grows past ~10 items - don't add the grouping ceremony before it's earned.

---

## Charts and dashboards (demo context)

### Hand-rolled charts over a charting library

- **Problem**: Charting libraries fight the design system's theming, add bundle weight, and are overkill for a small number of known charts in an investor demo.
- **Solution**: Build the few charts we need by hand:
  - Area/line chart: SVG path with `preserveAspectRatio="none"` and `vectorEffect="non-scaling-stroke"`; markers and tooltips as HTML overlays positioned by percentage.
  - Donut: stacked `<circle>` elements with `stroke-dasharray` segments and a gap percentage.
  - Bar chart: flex columns with percentage heights.
  - Avatar/logo placeholders: coloured initial chips with inline backgrounds - no remote assets that can fail to load mid-demo.
- **Use for**: Admin and hirer dashboard charts.
- **Revisit** if chart count or interactivity requirements grow past what a hand-rolled approach can maintain.

---

## Communicating design changes

### Before/After comparison cards

- **Problem**: A text list of UX issues doesn't land with stakeholders; building every issue as a full mockup burns time on low-value items.
- **Solution**: Pick 3-5 issues that are pure interface fixes, render each as a two-column mini mockup - "Before" (error-tinted label) beside "After" (success-tinted label) - using real Atlas components at reduced scale, plus a one-line "why this works" note. Reuse existing components as the fix wherever possible; that doubles as evidence the fix is cheap.
- **Use for**: Presenting prioritised UX findings to stakeholders.
- **Skip** for backend/data bugs with no visual surface.
