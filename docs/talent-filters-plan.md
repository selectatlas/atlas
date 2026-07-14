# Talent Search Filters - Implementation Plan

Source: `docs/3 Categories filters.pdf` (Actor/Model, Dancer, Photographer/Videographer filter specs).
Goal: LinkedIn-style filtering on the hirer talent search page (`/search`) - a top pill bar for high-value filters, an "All filters" side panel for everything else, live result counts, and shareable filter state.

## Starting point

- **Search page** (`src/app/(hirer)/search/page.tsx`): loads all talent profiles client-side, filters in-memory on 4 things only - category, location text, "available now", "has showreel". AI semantic search runs through `POST /api/search` (pgvector + LLM query parse).
- **Filter UI** (`src/components/search/FilterPanel.tsx` / `SearchHeader.tsx`): a single collapsible row of pills. No sections, no multi-select, no URL state.
- **Data model**: `profiles` has only name, headline, city, country, bio, rates (free text), availability (free text), showreel_url. `talent_skills` has category + skill + proficiency. **None of the PDF's filterable attributes exist in the schema** (age, gender, height, hair/eye/skin, languages, nationality, prices as numbers, transport, passport, SPACT, stunt register, camera equipment, dance styles/levels, delivery time, etc.).
- **Categories mismatch**: code has `dancer | actor | content_creator`; the PDF's third category is **Photographer/Videographer**.

So the work splits into four layers: **taxonomy (config) → schema (data) → filtering (server) → UI (LinkedIn-style panel)**, plus a follow-on layer for talent to actually populate the new fields.

## Decisions and guardrails

1. **Third category**: `photographer_videographer` is added as a 4th database category. Existing `content_creator` data is preserved until it can be audited rather than being semantically rewritten.
2. **Model/Actor**: PDF treats "Model/Actor" as one category. The existing `actor` key is retained and labelled "Actor / Model" to avoid a destructive migration.
3. **Deferred filters** (depend on features that don't exist yet - excluded from initial build, listed in Phase 6):
   - Reviews (1-5 star) - no reviews system exists.
   - "Responds within 8 hours" - needs message response-time tracking.
   - Distance radius from postcode - needs geocoding + lat/lng on profiles. Initial build ships city/country matching; radius comes later.
   - Electronic provisional booking calendar - profile feature, not a filter.

## Filter taxonomy (from the PDF, normalised)

### Shared across all 3 categories
| Filter | Type | Notes |
|---|---|---|
| Category | single-select pill | Actor/Model, Dancer, Photographer/Videographer |
| Location + distance | text + radius select | radius deferred to Phase 6, city/country match first |
| Age | range (min-max) | store `date_of_birth`, filter on derived age |
| Gender | multi | Male, Female, Non-binary |
| Languages | multi w/ search | primary + additional, filter matches any |
| Nationality / background | multi w/ search | |
| Price | range £0-£20,000 | store numeric `rate_min`/`rate_max`, replaces free-text `rates` for filtering |
| Overseas hire | toggle | |
| Own transport | multi | Car, Motorbike, None (PDF also has own car/motorbike colour - profile content, not filters) |
| Passport | multi | UK, EU |
| Keywords | text inputs | name, title - maps onto existing AI search box |

### Physical attributes (Actor + Dancer only)
Height (range, store cm), skin tone (9 options), hair colour, hair type (1A-5 scale, 13 options), eye colour, hair colour change (Y/N), hair cut/style change (Y/N).

### Actor/Model-specific
Primary medium (screen/stage/voice/musical theatre/improv), acting technique (Stanislavski, Method, Meisner, Practical Aesthetics, Classical), actor type (personality/character/chameleon), qualifications (BA Hons Acting … RADA, LAMBDA, RWCMD, etc.), accents, "double for" (text search), SPACT yes/no + SPACT type (~24 options), stunt register yes/no + register number (keyword) + disciplines (grouped: bikes, cars, falling, fire, martial arts, weapons, wires, …), scene comfort: kissing / smoking / nudity / implied nudity / partial clothing (all talent-declared Y/N).

### Dancer-specific
Skill level (beginner/intermediate/advanced-professional), primary + secondary dance style with per-style level, dance styles (~35 options - merge with existing `SKILLS_BY_CATEGORY.dancer`), experienced choreographer (Y/N), qualifications (Dance BA Hons, Level 4 DDE … ISTD), experience types (TV, tour, stage, music videos, film, choreography, live, teaching, musical theatre).

### Photographer/Videographer-specific
Photography camera format (full frame/medium format/MFT), photography equipment brands, videography equipment brands (ARRI, RED, Black Magic…), Netflix-approved camera (Y/N, videographer only), primary + secondary photography type, photography types (~60 options), primary + secondary videography type, videography types (~25 options), delivery time (7/14/21 days).

## Architecture

### 1. Taxonomy as a single config file - `src/lib/filter-taxonomy.ts`
Every filter is a config object; the UI, the profile editor, and the server-side filtering all render/validate from it. Adding a filter later = adding one entry.

```ts
type FilterDef = {
  key: string                    // 'hair_type'
  label: string                  // 'Hair type'
  section: string                // 'Physical attributes'
  categories: Category[] | 'all' // which talent categories it applies to
  kind: 'multi' | 'boolean' | 'range' | 'text' | 'single'
  options?: readonly { value: string; label: string }[]
  topOptions?: number            // how many to show before "Show more" (LinkedIn pattern)
  pill?: boolean                 // promoted to the top pill bar for its category
  unit?: 'cm' | 'gbp' | 'years'
  storage: 'profile' | 'talent_profile' | 'public_attributes' | 'sensitive_preferences' | 'skills'
  operator: 'equals' | 'contains' | 'overlaps' | 'range'
  restricted?: boolean
  dependsOn?: { key: string; value: string | boolean }
}
```

### 2. Schema - migration `009_talent_filters.sql`
Hybrid model:
- **Typed columns** in a server-owned 1:1 `talent_profiles` table for range/high-traffic filters: `birth_year`, `gender`, `height_cm`, numeric GBP day-rate range, `languages`, `nationalities`, and `available_now`.
- **Public JSONB** `public_attributes` for the long tail (hair type, SPACT, equipment, dance attributes, transport, passport, etc.) with a GIN index.
- **Restricted JSONB** in a separate `talent_sensitive_preferences` table for scene-comfort fields. It is never part of the general profile projection and is only accessed through role-checked server routes.
- Category constraints accept both the new `photographer_videographer` value and legacy `content_creator`; no existing data is rewritten automatically.
- Exact date of birth is not collected or returned. Age is derived from the less precise birth year on the server.

### 3. Server-side filtering - extend the search API
Browse currently filters client-side over all profiles. That breaks with 20+ filters and real data volume.
- New `GET /api/talent?` (or extend `POST /api/search` with a `filters` object): builds a Supabase query - typed columns as SQL predicates, JSONB via `attributes @> / ?|` containment, validated against the taxonomy (reject unknown keys - never interpolate raw input).
- Browse and AI mode use the same validated filter object. Structured predicates are applied in SQL **before** vector ordering and `LIMIT`, preserving filtered-search recall.
- Browse responses are paginated and return a total count with a stable order.
- Auth/rate-limit identical to the existing search route (401 unauthenticated, 403 non-hirer). Tests per project testing rules: happy path, 401, 403.

### 4. Filter state in the URL
Serialize active filters with repeated and explicit range params (`/search?category=actor&gender=female&gender=non_binary&height_min=160&height_max=180`). Back button, refresh, and shareable searches all work. The side sheet keeps draft state; its debounced count preview does not update the URL until “Show results” is selected.

## UI design (LinkedIn pattern, mapped to our components)

**Top pill bar** (always visible, under the AI search box):
- Category pills: `All | Actors & Models | Dancers | Photo & Video | Content creators` (legacy content-creator records stay discoverable until their category is audited).
- 2-3 **contextual dropdown pills** that change with category - Actors: `Medium`, `SPACT`, `Height`; Dancers: `Dance style`, `Skill level`; Photo/Video: `Photography type`, `Delivery time`; All: `Location`, `Price`.
- **"All filters"** button with active-count badge, plus `Reset`.
- Pill dropdowns are small popovers with checkboxes + "Show results" - not the full panel.

**"All filters" side sheet** (right-hand slide-over, like the screenshot):
- Rendered entirely from the taxonomy config, filtered to the selected category (shared sections + category sections).
- Sections in order: Category → Location → Price → Availability → Demographics (age/gender/languages/nationality) → Physical attributes → [category-specific sections] → Scene comfort (actors) → Keywords.
- Each multi-select section shows `topOptions` (5-6) as a 2-column checkbox grid + "Show more" / type-ahead "Add a …" for long lists (60 photography types are never shown all at once).
- Booleans as toggles, ranges as dual inputs/slider.
- Sticky footer: `Reset` + `Show results (N)` with live count.
- Active filters render as removable chips under the pill bar.
- Build on existing `Sheet`/`Popover`/`Checkbox` from `src/components/ui` (add via shadcn if missing); reuse pill styling from `FilterPanel.tsx`.

**New components** (in `src/components/search/`):
- `FilterBar.tsx` - pill bar + contextual pills (replaces most of `FilterPanel.tsx`)
- `FilterPill.tsx` - dropdown popover pill
- `AllFiltersSheet.tsx` - the side panel, config-driven
- `FilterSection.tsx` - one taxonomy section (checkbox grid / toggle / range)
- `ActiveFilterChips.tsx`
- `useSearchFilters.ts` - URL ⇄ state hook

## Build progress

- [x] **Phase 1 - Taxonomy + schema (foundation)**
`filter-taxonomy.ts` with the full PDF option lists; migration 009; types and attribute validation; category labels; demo data and seed updated so the UI is testable immediately.

- [x] **Phase 2 - Talent entry and profile display**
Role-checked attribute API, config-driven talent editor, demo data, and hirer-only profile detail rendering.

- [x] **Phase 3 - Server-side filtering**
Filter-aware paginated talent API, pre-limit vector filtering, input validation, and route/unit tests.

- [x] **Phase 4 - Filter UI on `/search`**
FilterBar, AllFiltersSheet, contextual pills, chips, URL state, live draft counts, server browse integration, and demo parity.

- [x] **Phase 5 - Embedding + matching alignment**
Include new attributes in `profile_embeddings` source text and the LLM query parser (`parseSearchQuery`) so "female stunt performer in London who rides horses" auto-applies structured filters from natural language - the differentiator over LinkedIn.

- [ ] **Phase 6 - Deferred**
Distance radius (geocode postcode → lat/lng, haversine/PostGIS), reviews filter (needs reviews feature), "responds within 8h" badge + filter (needs response tracking), saved searches, per-option result counts.

## Verification

- Production build and TypeScript compilation pass.
- 133 automated tests pass across 22 test files.
- ESLint reports no errors; five existing warnings remain outside this feature.
- Migration 009 must be applied to the target Supabase project before non-demo filtering is exercised.

## Sensitivity notes
All values are **talent self-declared and optional**. Restricted scene preferences are stored outside the public attribute record and accessed only through role-checked server code. “Background” may contain racial or ethnic-origin data and therefore requires documented privacy/legal review before production launch. A profile with a missing value remains visible until a hirer actively applies a filter that requires that value.
