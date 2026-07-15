# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the Atlas AI talent discovery platform. PostHog is initialised client-side via `instrumentation-client.ts` (Next.js 15.3+ pattern) with a reverse proxy through `/ingest` to avoid ad blockers. A singleton server-side client lives in `src/lib/posthog-server.ts` and is used by selected mutation API routes. Users are identified on login and signup using their Supabase UUID as the distinct ID. Twelve events are captured across both the hirer and talent journeys.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | New user completes account creation with chosen role | `src/app/(auth)/signup/page.tsx` |
| `user_signed_in` | Returning user successfully signs in | `src/app/(auth)/login/page.tsx` |
| `job_created` | Hirer posts a new job brief | `src/app/api/jobs/route.ts` |
| `talent_shortlisted` | Hirer adds a talent profile to their shortlist | `src/app/api/shortlist/route.ts` |
| `talent_unshortlisted` | Hirer removes a talent from their shortlist | `src/app/api/shortlist/route.ts` |
| `outreach_message_generated` | Hirer uses AI to draft a personalised outreach message | `src/app/api/outreach/route.ts` |
| `outreach_message_sent` | Hirer sends an outreach message to a talent profile | `src/app/api/outreach/route.ts` |
| `ai_search_performed` | Hirer submits a natural-language AI search and receives results | `src/app/(hirer)/search/page.tsx` |
| `job_application_submitted` | Talent applies to an open job posting | `src/app/api/applications/route.ts` |
| `talent_liked` | User likes a talent profile | `src/app/api/talent/[id]/like/route.ts` |
| `talent_unliked` | User removes their like from a talent profile | `src/app/api/talent/[id]/like/route.ts` |
| `job_passed` | Talent passes on a job in the Discover feed | `src/app/(talent)/discover/page.tsx` |

## Next steps

We have built insights and a dashboard based on the events just instrumented:

- [Analytics basics (wizard) - Dashboard](https://us.posthog.com/project/512382/dashboard/1848109)
- [Hirer activation funnel (wizard)](https://us.posthog.com/project/512382/insights/PQqAy1gS) - signup → job created → outreach sent
- [Signups by account type (wizard)](https://us.posthog.com/project/512382/insights/drzUSe4M) - daily signups broken down by hirer/talent
- [Talent application funnel (wizard)](https://us.posthog.com/project/512382/insights/rgbnJ5so) - signup → first application submitted
- [Outreach funnel (wizard)](https://us.posthog.com/project/512382/insights/F48E0Pv2) - message generated → message sent conversion
- [AI search usage over time (wizard)](https://us.posthog.com/project/512382/insights/nVP4CDr3) - daily AI search volume

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite - call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [x] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`, and `NEXT_PUBLIC_POSTHOG_UI_HOST` to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [x] Confirm the returning-visitor path also calls `identify` - `PostHogAuthSync` re-identifies from the Supabase session on boot and on auth state changes.

### Agent skill

We have left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
