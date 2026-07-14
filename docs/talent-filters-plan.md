# Talent Search Filters - Implementation Plan

Source: `docs/3 Categories filters.pdf` (Actor/Model, Dancer, Photographer/Videographer filter specs).
Goal: LinkedIn-style filtering on the hirer talent search page (`/search`) - a top pill bar for high-value filters, an "All filters" side panel for everything else, live result counts, and shareable filter state.

## Where we are today

- **Search page** (`src/app/(hirer)/search/page.tsx`): loads all talent profiles client-side, filters in-memory on 4 things only - category, location text, "available now", "has showreel". AI semantic search runs through `POST /api/search` (pgvector + LLM query parse).
- **Filter UI** (`src/components/search/FilterPanel.tsx` / `SearchHeader.tsx`): a single collapsible row of pills. No sections, no multi-select, no URL state.
- **Data model**: `profiles` has only name, headline, city, country, bio, rates (free text), availability (free text), showreel_url. `talent_skills` has category + skill + proficiency. **None of the PDF's filterable attributes exist in the schema** (age, gender, height, hair/eye/skin, languages, nationality, prices as numbers, transport, passport, SPACT, stunt register, camera equipment, dance styles/levels, delivery time, etc.).
- **Categories mismatch**: code has `dancer | actor | content_creator`; the PDF's third category is **Photographer/Videographer**.

So the work splits into four layers: **taxonomy (config) → schema (data) → filtering (server) → UI (LinkedIn-style panel)**, plus a follow-on layer for talent to actually populate the new fields.

## Open decisions (need product sign-off)

1. **Third category**: does `photographer_videographer` replace `content_creator`, or become a 4th category? Plan assumes it replaces it (PDF says "3 Categories"), with a data migration for existing content_creator rows.
2. **Model/Actor**: PDF treats "Model/Actor" as one category. Plan assumes one category `actor` labelled "Actors & Models".
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
}
```

### 2. Schema - migration `009_talent_attributes.sql`
Hybrid model:
- **Typed columns** on `profiles` for range/high-traffic filters (indexable): `date_of_birth`, `gender`, `height_cm`, `rate_min int`, `rate_max int`, `languages text[]`, `nationality text[]`.
- **One JSONB column** `attributes jsonb default '{}'` for the long tail (hair type, SPACT, equipment, dance styles, scene comfort, transport, passport, …) with a GIN index. Keys match taxonomy keys exactly.
- Category check constraints updated: `content_creator` → `photographer_videographer` (with data migration), applied to `talent_skills` and `jobs`.
- Update column-level grants following the migration `005` pattern; scene-comfort fields visible to signed-in hirers only.
- `PUBLIC_PROFILE_FIELDS` / `PUBLIC_PROFILE_WITH_SKILLS` in `src/lib/profile-fields.ts` extended to match.

### 3. Server-side filtering - extend the search API
Browse currently filters client-side over all profiles. That breaks with 20+ filters and real data volume.
- New `GET /api/talent?` (or extend `POST /api/search` with a `filters` object): builds a Supabase query - typed columns as SQL predicates, JSONB via `attributes @> / ?|` containment, validated against the taxonomy (reject unknown keys - never interpolate raw input).
- AI mode: same filter object applied **after** the pgvector match (filter the 20 candidates), so semantic search and structured filters compose, mirroring how `parsed.category`/`parsed.location` already work in `src/app/api/search/route.ts`.
- Auth/rate-limit identical to the existing search route (401 unauthenticated, 403 non-hirer). Tests per project testing rules: happy path, 401, 403.

### 4. Filter state in the URL
Serialize active filters to query params (`/search?category=actor&gender=female,non_binary&height=160-180`). Back button, refresh, and shareable searches all work - like LinkedIn. Debounced fetch on change.

## UI design (LinkedIn pattern, mapped to our components)

**Top pill bar** (always visible, under the AI search box):
- Category pills: `All | Actors & Models | Dancers | Photo & Video` (like LinkedIn's 1st/2nd/3rd+).
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

## Phases

**Phase 1 - Taxonomy + schema (foundation)**
`filter-taxonomy.ts` with the full PDF option lists; migration 009; types in `src/types/index.ts`; `profile-fields.ts`; update `skills.ts` category labels; demo-data + seed updated so the UI is testable immediately. Resolve open decisions 1-2 first.

**Phase 2 - Filter UI on /search**
FilterBar + AllFiltersSheet + chips + URL state. Filtering still client-side against demo/loaded data so UI ships without waiting on the API. Live result counts.

**Phase 3 - Server-side filtering**
Filter-aware talent query API + integration with AI search route. Route tests (happy/401/403). Switch the page from client filtering to the API.

**Phase 4 - Talent profile editor + profile display**
Talent can't be filtered on data they can't enter. Extend profile editing (`(talent)/profile`) with config-driven sections per category (same taxonomy file), and show the attributes on the public profile page. Update profile completeness scoring to nudge fill-in.

**Phase 5 - Embedding + matching alignment**
Include new attributes in `profile_embeddings` source text and the LLM query parser (`parseSearchQuery`) so "female stunt performer in London who rides horses" auto-applies structured filters from natural language - the differentiator over LinkedIn.

**Phase 6 - Deferred**
Distance radius (geocode postcode → lat/lng, haversine/PostGIS), reviews filter (needs reviews feature), "responds within 8h" badge + filter (needs response tracking), saved searches, per-option result counts.

## Sensitivity notes
Gender, skin tone, age, and scene-comfort (nudity/kissing/smoking) filters are standard casting metadata, but: all values are **talent self-declared and optional**; scene-comfort fields are only exposed to authenticated hirers (column grants); skin tone / hair type use the industry-standard scales from the PDF verbatim. No filter defaults to excluding profiles with missing data except where the talent explicitly opted out.
