# Dots UI Reference Analysis for Atlas

## Recommendation

The images should be used as a reference library, not as a screen-by-screen cloning brief. They are strongest as evidence of how a creative network can connect discovery, proof of work, community, jobs, companies, events, follows, connections, and messaging into one product. They are weaker as a definition of Atlas's scope: they contain a broad professional-network model and several dense states that would be expensive to reproduce before the core matching loop is excellent.

The right sequence is:

1. Preserve the images as a visual reference set.
2. Analyse the product patterns and group them by user journey.
3. Decide which patterns improve Atlas's core promise: finding and hiring the right creative talent quickly.
4. Update the PRD with explicit priorities, data requirements, states, and success criteria.
5. Convert the selected patterns into Atlas-specific wireflows and an updated design system before implementation.

This document is the analysis step. `docs/prd.md` turns the selected patterns into the product and technical plan.

## Reference inventory

| Reference | Primary lesson | Atlas implication |
|---|---|---|
| `home page.png` | Clear promise, multiple entry points, social proof, and a strong public-to-product transition | Make AI talent search the primary promise; use community, jobs, and learning as supporting entry points |
| `feed-page-when user login.png` | A three-column home workspace with profile completion, composer, recommendations, jobs, companies, and events | Build a useful authenticated home, but keep it focused on next best actions rather than a generic content wall |
| `top navigation mega menu.png` | Explore navigation groups people, events, jobs, companies, projects, and posts | Use a role-aware global navigation with a small number of understandable destinations |
| `ui-design-menu.png` | A right-side command menu exposes role-specific actions without changing the whole page | Use a command menu for high-value actions such as search, post, job, message, profile, and settings |
| `user-search-list-page.png` | Search results are portfolio-led, visually scannable, and support connect actions | Atlas search results must show evidence of fit, not only names and job titles |
| `jire talent page.png` | Employer-facing value is expressed through packages, tailored lists, quality candidates, and mobile workflows | Atlas should make shortlist building and collaboration the employer workflow; monetisation can wait |
| `jobs-search-list-page.png` | Jobs are browsable in a dense list with filters, save/follow actions, pagination, and related opportunities | Add saved searches and alerts, while keeping job fit and application state visible |
| `jobs-search-detail-page.png` | Job detail combines company context, a long description, related people, and related jobs | Make job detail actionable, structured, and easy to evaluate without losing the Apply action |
| `jobs-filters.png` | Filters are explicit, grouped, and easy to clear | Keep manual filters as a transparent complement to natural-language search |
| `message-center.png` | Conversation list, search, compose, chronological thread, and message actions are all in one workspace | Add context-aware messaging tied to a profile, job, shortlist, or application |
| `follow-page-card designs.png` | Following companies is presented as a lightweight, swipeable decision | Use follow/save for low-commitment interest and connection/contact for a stronger relationship |
| `user-profile-page.png` | Profiles lead with identity, proof, projects, experience, skills, and a clear Connect action | Rework Atlas profiles around proof of work, availability, and fit explanation |
| `account-connections.png` | Connections are grouped by intent: mentors, teammates, new members, role, and companies | Add connection discovery and company following after the hiring loop is reliable |
| `ask-the-community.png` | Community posts have categories, lightweight interactions, and a clear Connect action | Add a structured community layer for advice, collaboration, availability, and opportunities |

## What the images consistently do well

- Establish a calm, editorial workspace: white cards on a pale grey canvas, restrained borders, compact metadata, and high image density where portfolio evidence matters.
- Keep identity close to action: avatars, names, role context, and Connect/Follow actions are consistently adjacent.
- Create multiple discovery paths: search, browsing, recommendations, follows, jobs, events, and community posts all lead back to people and opportunities.
- Make profiles more than resumes: projects, credits, media, skills, and experience provide evidence that supports a decision.
- Use a persistent shell: global navigation, role context, messages, profile, and menu remain available while users move through the product.
- Treat connection as a spectrum: follow, save, connect, ask, message, apply, and hire are different levels of commitment.

## Where the reference experience can be improved for Atlas

- The reference product exposes many destinations before the user has a clear next action. Atlas should lead with a single intent: find, evaluate, and contact the right person or opportunity.
- The reference search is visually rich but does not visibly explain why a result is relevant. Atlas must show match reasons such as skill, location, availability, language, credits, or work evidence.
- Dense feeds and long job pages make scanning difficult. Atlas should use progressive disclosure, summary blocks, sticky actions, and jump links.
- “Connect” is used broadly. Atlas should define the relationship outcome for every action: save for later, request a connection, start a conversation, express interest, or apply.
- Profile completion is treated as a percentage, but the product should explain which missing evidence will improve discoverability and why.
- The reference visual language is mostly neutral. Atlas can preserve the calm base while using its lime match token only for meaningful fit signals and its indigo primary for action.

## Product patterns to adopt

### 1. A role-aware command centre

After sign-in, users should land on a home workspace that answers “what can I do next?” rather than a generic dashboard.

- Hirer: continue a search, review shortlist changes, reply to candidates, manage active jobs, and see recommended talent.
- Talent: complete the highest-value profile gap, review matched jobs, respond to messages, and discover relevant people or companies.
- Both: show saved searches, notifications, and recent activity without requiring a separate hunt through navigation.

### 2. Evidence-first discovery

Every talent result should show enough evidence to justify a click: match score, match reasons, top skills, location, availability, rate context, and a work preview. Search results need list, grid, and swipe modes, but all modes should expose the same actions and evidence.

### 3. A proof-of-work profile

The profile is the product's trust surface. It should make the following scannable in under 20 seconds: who the person is and what they do; what they are available for and where; their best work, credits, and skills; why they match the current search or job; and how to contact or save them.

### 4. Context-preserving messaging

Messages should retain the context that created the conversation. A thread started from a job should show the job; a thread started from a shortlist should show the selected talent and match reasons. AI may draft or summarise, but the user remains in control of sending.

### 5. Low-friction relationship building

Following a company or saving a job is a lower-friction action than applying or contacting. This creates a useful retention loop without forcing users to make a commitment before they are ready.

### 6. Structured community participation

Community posts should not become an unbounded social feed. Start with explicit post types—question, collaboration, availability, project, and opportunity—so the feed can be filtered, searched, and connected to people, jobs, and profiles.

## Patterns to defer or constrain

- Employer packages and paid recruiter plans: useful later, but not needed to validate matching and conversion.
- Large event and learning catalogues: add only when there is a real content source and a clear reason they improve talent outcomes.
- Company pages as a complete enterprise product: begin with a lightweight page that explains a company, its jobs, and its followed status.
- Infinite community feed: start with pagination or an intentional load-more model and strong post types.
- Complex team, agency, and recruiter permissions: design the data model for them, but ship single-user hirer accounts first.
- Swipe as the only navigation: keep swipe as an optional fast mode; list and profile views are essential for careful professional decisions.

## Atlas experience principles derived from the references

1. **Signal before scale.** A smaller set of clearly relevant results is better than a large wall of profiles.
2. **Evidence before assertion.** Match claims must point to visible skills, work, availability, or experience.
3. **One next action.** Each screen should have a primary action appropriate to the user's role and current intent.
4. **Progressive commitment.** Browse, save, follow, connect, message, apply, and hire should feel distinct.
5. **Context travels.** Search intent, match reasons, job context, and relationship state should persist across screens.
6. **The human stays in control.** AI should explain, suggest, draft, and rank; it should not silently send, reject, or misrepresent someone.
7. **Calm density.** Use compact layouts for scanning, but give important decisions enough space and hierarchy.

## Recommended next artefacts

After the PRD is accepted, the next practical artefacts should be:

- an annotated Atlas sitemap and role-based journey map;
- wireflows for hirer search-to-contact, talent onboarding-to-apply, and community post-to-connection;
- an updated `docs/design.md` that keeps the current Atlas token foundation but adds reference-informed patterns for cards, result rows, profile sections, status pills, navigation, and empty/loading/error states;
- a small set of usability tests using realistic casting tasks before implementing every P1 surface.

