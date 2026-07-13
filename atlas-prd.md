# Atlas — Investor Demo PRD

**Version** 1.0
**Status** Build-ready
**Scope** Investor demo (validation build, not production)
**Prepared by** Laith Wallace, FlowConverts

---

## 1. Purpose and scope

Atlas is an AI-native talent discovery platform for the creative industry. This document specifies a working web application built to demonstrate the product to investors. The build must run live, on a real URL, usable on a phone in the room.

This is a demo, not the production platform. It proves the concept and wins funding. A production team rebuilds on a validated foundation post-investment. Every decision in this document optimises for a convincing live demonstration, not for scale.

**In scope for this build:**

- AI natural language search with real relevance scoring
- Manual filter system
- Swipe card interface plus list/grid view
- Talent profiles with media
- Dual account types (hirer and talent)
- Job posting and application flow
- AI-generated outreach messages
- Activity dashboards for both account types
- Mobile responsive, PWA-installable
- 50 to 100 seeded profiles (generated placeholder data)
- Three categories: Dancers, Actors, Content Creators

**Out of scope (future phases):**

- Payment processing, commissions, in-app messaging
- Native iOS and Android apps
- Reviews, ratings, agency accounts
- Admin moderation panel
- Categories beyond the three above

---

## 2. The problem

Existing platforms fail at the core job: helping hirers find the right talent fast.

| Platform | Founded | Technology | Core failure |
|---|---|---|---|
| Spotlight | 1927 | Legacy | Gatekept, poor UX |
| Mandy | 1999 | Legacy | Filters return irrelevant results |
| Starnow | 2001 | Legacy | 5M users, broken search |
| Atlas | 2025 | AI-native | First of its kind |

Two evidence points drive the build:

- A Mandy search for "food and beverage content creators" returned 609 results. One showed food content.
- Production companies travel across London to find boxers in gyms because no platform surfaces actors by combat skill.

The demo must make the contrast between legacy search and AI search visible in under two seconds.

---

## 3. Users

**Hirer.** Casting directors, producers, content agencies. Needs the right talent fast, by specific skill, location, and availability. Success means a ranked shortlist in seconds and a sent outreach message in one tap.

**Talent.** Dancers, actors, content creators. Needs to be discoverable by genuine skill and to apply to relevant jobs with minimal friction. Success means an accurate profile and a swipe-to-apply flow.

---

## 4. Technical stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) | React base carries to React Native for future mobile; server routes keep AI keys off the client; largest hiring pool for post-funding handover |
| Language | TypeScript | Type safety, shared types across client and server |
| Styling | Tailwind CSS | Fast iteration, consistent design tokens |
| Backend | Supabase | Postgres, auth, storage, and pgvector in one service |
| Vector search | pgvector | Stores embeddings alongside profile data, no separate vector DB |
| Embeddings | OpenAI text-embedding-3-small | Cheap, fast, good enough for demo relevance |
| LLM | OpenAI GPT-4o-mini (or current equivalent) | Query parsing and outreach generation, low cost |
| Hosting | Vercel | Live URL in minutes, native Next.js deploy |

**Constraint.** All AI API calls run server-side through Next.js route handlers or server actions. No API keys reach the browser.

---

## 5. Data model

Core tables in Postgres.

**profiles**
- id, account_type (hirer or talent), full_name, email, avatar_url
- city, country
- bio, rates (text), availability (text)
- showreel_url
- created_at

**talent_skills**
- id, profile_id, category (dancer, actor, content_creator), skill, proficiency

**profile_embeddings**
- profile_id, embedding (vector), source_text
- source_text is the concatenated searchable string: name, category, skills, city, bio. This is what gets embedded.

**jobs**
- id, hirer_id, title, description, category, skills_required, location, budget, status, created_at

**applications**
- id, job_id, talent_id, status (sent, viewed, responded, shortlisted, hired), created_at

**outreach**
- id, hirer_id, talent_id, message, status (draft, sent, viewed, responded), created_at

---

## 6. Features

### 6.1 AI natural language search

The headline feature. The single thing investors must remember.

**Flow:**
1. Hirer types a natural query: "Bollywood dancers in London who speak Hindi, available December".
2. Server parses the query with the LLM into structured intent: category, skills, location, language, availability.
3. Server embeds the query string and runs cosine similarity against profile_embeddings via pgvector.
4. Structured filters from step 2 narrow or boost results.
5. Results return ranked, each with a real match score derived from similarity (surfaced as a percentage, for example 94%).

**Requirements:**
- Results in under two seconds.
- Match scores are real, computed from cosine similarity, never hardcoded.
- Minimum eight ranked results for the demo queries.
- Empty or weak queries degrade gracefully to category browse.

**Demo-critical:** seed data must guarantee strong matches for the rehearsed queries. See section 9.

### 6.2 Manual filters

Traditional dropdown filters for category, skill, location, availability. Runs against structured columns, no AI. Exists so the demo shows both the new way and the familiar way side by side.

### 6.3 Swipe interface

- Card stack, one talent per card.
- Swipe right to contact, left to pass.
- Card shows photo, name, top skills, location, rate, availability, match score.
- Works on touch and mouse drag.
- Toggle to list/grid view (LinkedIn-style) showing all matches at once.

### 6.4 Talent profiles

Photo, showreel embed or placeholder, skills with proficiency, experience, rates, availability, location, bio. Reachable from a card tap or list row.

### 6.5 AI outreach messages

On swipe right or a contact tap, the LLM generates a personalised message referencing the talent's specific skills and the hirer's context. Example: "Hi Priya, I'm casting a music video and your Bollywood background is exactly what we need." Hirer can edit before sending. Sending updates the outreach and activity records.

### 6.6 Job posting and application

- Hirer posts a job: title, description, category, required skills, location, budget.
- Talent sees matched jobs as cards, swipes right to apply.
- Application creates a record visible to both sides.

### 6.7 Dual account types

Separate experiences sharing one auth system. Hirers search, post jobs, send outreach. Talent build profiles, receive matches, apply. Account type set at signup and stored on the profile.

### 6.8 Activity dashboards

- **Hirer:** contacted talent, message status (sent, viewed, responded), posted jobs, applicants.
- **Talent:** applications and status, profile views, jobs matched.

Status can advance via simple demo controls so the rehearsed walkthrough shows movement.

### 6.9 Mobile and PWA

Mobile-first responsive. Swipe optimised for touch. PWA manifest and service worker so it installs to a home screen and presents like a native app.

---

## 7. The demo walkthrough

The build must support this exact sequence end to end.

1. **The problem.** Show a legacy-style search returning a wall of irrelevant results.
2. **Atlas search.** Type the Bollywood query. Eight ranked matches appear in under two seconds with visible scores.
3. **The experience.** Swipe right on a dancer. AI generates a personalised message. Send it.
4. **The other side.** Switch to the talent view. Show the match arriving and a swipe-to-accept.
5. **Scale.** Reference the comparison: swipe-model job apps already drive millions of interactions daily. Same model, creative talent, large addressable market.

Every step above must work live without a fallback to slides.

---

## 8. Non-functional requirements

- **Performance.** Search returns in under two seconds. First page load under three seconds on 4G.
- **Reliability.** The five demo steps must not fail. Rehearsed queries return strong results every time.
- **Responsive.** Works on phone, tablet, desktop. Swipe works on touch.
- **Security.** AI keys server-side only. Supabase row-level security on user data.
- **Browser support.** Latest Chrome, Safari, Edge. iOS Safari is the priority since investors will likely use phones.

---

## 9. Seed data

50 to 100 generated placeholder profiles across the three categories.

- Realistic names, cities, skills, proficiencies, rates, availability.
- Stock or AI-generated headshots, placeholder showreels.
- Skill distribution engineered so every rehearsed demo query returns strong, believable matches. This is the highest-risk item for the live demo. Build the seed set against the rehearsed queries, not at random.
- All embeddings generated and stored at seed time so search is instant in the room.

Label clearly in handover docs that this data is placeholder, replaceable with Xavier's real network at production.

---

## 10. Deliverables

- Live web application deployed to Atlas
- Full source code, ownership transferred
- Seeded Postgres database
- Setup and handover documentation
- Demo script aligned to section 7

---

## 11. Build sequence

| Week | Focus |
|---|---|
| 1 | Project setup, Supabase schema, auth, dual account types, navigation shell |
| 2 | Profile creation and display, skill taxonomy, manual filters, seed data generation |
| 3 | Embeddings pipeline, AI search with pgvector, match scoring, swipe interface, AI outreach |
| 4 | Job posting and applications, both dashboards, mobile and PWA polish, deploy, rehearse demo |

---

## 12. Open decisions for the production phase

These do not block the demo. They will matter when Xavier raises and rebuilds.

- Whether to keep Supabase or move to a dedicated backend at scale.
- Native mobile via React Native or Expo, reusing demo component logic.
- Real talent onboarding and verification.
- Embedding model and re-ranking strategy at volume.
- Whether match scoring needs a learning loop trained on swipe behaviour.
