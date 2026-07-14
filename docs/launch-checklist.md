# Atlas launch checklist

**Product:** A Next.js 16 web app/PWA for creative-talent discovery, using Supabase for authentication, PostgreSQL, row-level security, and file storage, plus OpenAI for semantic search and generated outreach.

**Recommended production route:** Vercel Pro + Supabase Pro, with Resend for authentication email, Sentry for errors, and PostHog for product analytics.

**Estimated work:** 8–12 engineering days plus 6–10 founder hours, normally spread across 2–3 weeks so implementation, legal review, email, DNS, and account verification can settle.

**Expected launch cost:** about **$45/month fixed** ($20 Vercel Pro + $25 Supabase Pro), plus low usage-based OpenAI spend, a domain (typically £10–£25/year), and optional paid tiers if email or monitoring outgrows its free allowance. Current reference prices: [Vercel](https://vercel.com/pricing), [Supabase](https://supabase.com/pricing), [OpenAI](https://developers.openai.com/api/docs/models/gpt-4o-mini), [Resend](https://resend.com/pricing), and [PostHog](https://posthog.com/pricing).

**No payment provider was detected.** This checklist does not include customer checkout. If Atlas will charge customers at launch, payments, webhook handling, refunds, invoices, and tax treatment become a separate launch-blocking phase.

## Legend

- 🧑 **You** — needs your identity, accounts, payment details, or a business decision.
- 🤖 **Agent** — a coding agent can do this in the repository or command line.
- 🤝 **Together** — the agent prepares it; you provide a value, review the result, or click the final production control.

## Audit snapshot — 14 July 2026

- `npm test`: **passed**, 6 files and 25 tests.
- `npm run lint`: **passed with 5 warnings**; two unoptimised `<img>` usages and three unused exports.
- `npm run build`: **passed** with Next.js 16.2.7.
- `npm audit --omit=dev`: **1 high and 2 moderate findings**. The high finding comes through the `shadcn` CLI being installed as a production dependency; Next.js currently brings an affected PostCSS version.
- Production environment variables used by the app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`. The last two are missing from `.env.example`.
- No deployment configuration, CI workflow, error tracking, analytics, legal pages, account deletion, abuse reporting, rate limiter, CAPTCHA, or production runbook was found.

## Execution playbook — follow these gates in order

The safest first release is an **invite-only beta**, not an unrestricted public launch. Finish each gate before beginning the next one. Do not put real customer data into Atlas until Gate 1 passes, and do not invite customers until Gate 8 passes.

### [ ] Gate 1 — Make customer data safe — 🤖 Agent — 2–3 days

Complete detailed steps **1–3** below as one workstream: create a reproducible Supabase migration history, repair messaging/RLS, stop exposing private profile fields, and remove authenticated-page caching from the service worker.

**You'll know it worked when:** a fresh database can be built entirely from migrations; two-role RLS tests pass; direct Supabase and browser queries cannot read another user's private fields; and logout/account switching can never reveal cached authenticated pages.

### [x] Gate 2 — Harden every server-side boundary — 🤖 Agent — 1–2 days

Complete steps **4–6**: add runtime input validation, ownership and role checks, rate limits and AI quotas, reliable embedding work, and server-enforced upload controls. Treat browser validation as convenience only; the server and database must enforce the rules.

**You'll know it worked when:** malformed, oversized, repeated, cross-role, and unauthenticated requests fail safely before spending money or changing data; failed embeddings can be retried; and one user cannot read, replace, or delete another user's uploads.

### [x] Gate 3 — Establish a repeatable engineering release gate — 🤖 Agent — 1–2 days

Complete steps **7–8**: resolve or narrowly document dependency advisories, add CI for clean install/lint/test/build/audit, and add real Supabase integration plus Playwright end-to-end tests. Keep the existing unit tests, but do not use mocked route tests as proof that RLS or authentication works.

**You'll know it worked when:** every pull request runs the full gate from a clean checkout; no unexplained high-severity production advisory remains; and isolated hirer and talent journeys pass against a real test database.

### [ ] Gate 4 — Create and secure production services — 🧑 You — 2–3 hours plus account verification

Complete steps **9–12**: create Vercel, Supabase, OpenAI, Resend, Sentry, and PostHog production projects; enable MFA; set billing/spend alerts; and confirm the launch domain. Put credentials directly into the services' settings or your password manager. Never paste secrets into chat or commit them.

**You'll know it worked when:** every service has a production-specific project, MFA and recovery access are configured, spending has a limit or alert, and you control the final domain.

### [ ] Gate 5 — Configure a production-shaped staging environment — 🤝 Together — 1–2 days

Complete steps **13–17** first in staging: typed environment validation, Vercel variables, a fresh migrated Supabase project, real authentication email, monitoring, privacy-safe analytics, structured logs, and a non-sensitive health endpoint. Staging should use separate credentials and data from production.

**You'll know it worked when:** missing configuration fails clearly; secrets are absent from browser bundles and logs; confirmation/reset email works on the intended domain; a deliberate exception reaches Sentry without PII; and health/analytics signals appear as expected.

### [ ] Gate 6 — Put trust, legal, and marketplace safety in place — 🤝 Together — 2–3 days plus legal review

Complete steps **18–20**: publish privacy, terms, acceptable-use and cookie information; record acceptance; add account export/deletion, reporting and blocking; establish a monitored support address; and name the human responsible for moderation and incidents.

**You'll know it worked when:** a user can understand and exercise their data rights, abusive users/content can be reported and blocked, policy acceptance is recorded, and one named person owns every report and escalation.

### [ ] Gate 7 — Deploy behind a controlled beta boundary — 🤝 Together — 1 day plus DNS propagation

Complete steps **21–23**: connect the repository to Vercel, require the green CI gate, configure the domain and HTTPS, protect previews/internal routes, add security headers and SEO controls, and provide usable error/not-found/loading states. Keep signup invite-only or capped initially.

**You'll know it worked when:** only a green commit can deploy; HTTPS and canonical redirects work; authenticated/internal pages are not indexed; production responses contain the intended security headers; and rollback to the previous deployment is proven.

### [ ] Gate 8 — Prove the live product as real users — 🤝 Together — 1 day

Complete steps **24–25** on the production domain with two new accounts, two browsers, and a real phone. Exercise the complete talent and hirer journeys, authentication email/reset, file uploads, messaging, role isolation, accessibility, performance, and bounded abuse/load checks. Inspect network responses, Sentry, application logs, Supabase logs, and OpenAI usage while testing.

**You'll know it worked when:** every critical journey succeeds without manual database repair; no private cross-user data appears; no unresolved P0/P1 error remains; accessibility has no critical finding; and abusive bursts degrade to controlled 429 responses rather than excess spend or 500 errors.

### [ ] Gate 9 — Make an explicit go/no-go decision — 🧑 You — 30 minutes

Complete step **26**. Launch only if Gates 1–8 have evidence, all critical/high findings are closed or explicitly accepted by a named owner, support coverage is available, and rollback is ready. Record the beta audience size and success/stop thresholds.

**You'll know it worked when:** there is a dated go/no-go note naming the launch owner, incident owner, support/moderation owner, rollback decision-maker, launch cap, and stop conditions.

### [ ] Gate 10 — Operate the launch, then widen access — 🤝 Together — first 72 hours, then weekly

Complete steps **27–29**: check errors, logs, database/storage/auth usage, email delivery, OpenAI spend, funnel drop-off and support twice daily; prove a backup restore; finish the incident runbook; and review the first week's metrics before opening the beta further.

**You'll know it worked when:** alerts reach a human, a recent backup has been restored successfully into isolation, the team can follow rollback/key-rotation/outage procedures, and widening access is based on measured reliability rather than the absence of complaints.

## Phase 0 — Fix before any public launch

### [x] 🤖 1. Replace the broken database migration path and prove it from an empty database — 1–2 days

The database source of truth is split between `supabase/schema.sql` and three incremental migrations. The migration directory has no initial migration that creates the core tables, while migrations 001 and 002 assume those tables already exist; a clean migration-only deployment therefore cannot reproduce the app. Messaging also cannot work as written: the API tries to create a thread before RLS permits the insert, tries to insert the other participant despite a policy that only permits inserting yourself, and cannot read the other participant under the current select policy. Consolidate the schema into ordered, idempotent migrations and add database-level tests for every role.

> Implement a production-safe Supabase migration baseline for Atlas. Turn the current schema plus incremental changes into one reproducible ordered migration history, and make direct messaging work without weakening tenant isolation. Add tests that create hirer and talent users and verify profiles, jobs, applications, outreach, shortlists, likes, views, message threads, participants, and messages under RLS. Include a documented clean-database apply command and a rollback/backup procedure. Do not use the service-role key in browser code.

**You’ll know it worked when:** all migrations apply in order to a new Supabase project, apply cleanly to a copy of the current database, and the two-role messaging test passes while unrelated users receive permission errors.

### [x] 🤖 2. Stop exposing private profile fields — 3–5 hours

The current `profiles_select_all` policy permits broad reads and several browser/API queries use `select('*')`. That includes `profiles.email`, so authenticated clients—and potentially anonymous Supabase API callers—can retrieve email addresses that the UI does not display. Split private account data from public talent data, or expose an explicit safe view. Replace every wildcard profile select with a named field list. Make profile role and account email server-controlled.

> Perform a privacy-focused data-access refactor. Ensure no public or cross-user query can return profile email or other private account fields. Prefer a public_talent_profiles view or separate private account table, explicit select lists, authenticated-only policies where appropriate, and immutable server-controlled account_type/email fields. Add regression tests that query through both the app and the Supabase anon/authenticated clients and assert private fields are absent.

**You’ll know it worked when:** searching, browsing, similar-talent results, profile pages, and outreach still work, while browser network responses and direct Supabase queries never expose another user’s email.

### [x] 🤖 3. Remove authenticated-page caching from the service worker — 2–3 hours

`public/sw.js` currently caches almost every successful same-origin page with a cache-first strategy. That can preserve authenticated HTML after logout and show stale or cross-account data on a shared browser. For launch, remove the service worker and PWA registration; reintroduce offline support later with an explicit static-asset-only strategy.

> Remove the current service worker registration and authenticated page cache safely. Unregister old workers and clear the atlas-v1 cache once, keep the web manifest if useful, and add a regression check proving /profile, /search, /messages, /activity, and other authenticated pages are never stored in Cache Storage.

**You’ll know it worked when:** after logging out, going offline or switching accounts cannot display the previous user’s authenticated pages or data.

### [x] 🤖 4. Add authorization, validation, and spend controls to every mutation/AI route — 1 day

Authentication exists, but role checks are inconsistent. `/api/outreach`, `/api/shortlist`, and message creation do not consistently enforce hirer/talent roles. `/api/search`, `/api/outreach`, and `/api/embed` can spend OpenAI credits without an app-level quota. Request bodies mostly rely on TypeScript casts rather than runtime validation, and several text fields have no maximum length.

> Harden all route handlers. Add shared runtime schemas, body-size and string-length limits, UUID validation, consistent role/ownership checks, per-user and per-IP rate limits, daily AI quotas, 429 responses with retry hints, OpenAI timeouts/retries, safe error messages, and structured server logs. Prevent a hirer from regenerating arbitrary talent embeddings. Add abuse tests for malformed JSON, oversized payloads, cross-role calls, repeated calls, and unauthenticated access. Use a production-compatible rate-limit store, not process memory.

**You’ll know it worked when:** all abuse tests pass, invalid/cross-role requests are rejected before any OpenAI call, and a deliberately exceeded quota returns 429 without increasing OpenAI usage.

### [x] 🤖 5. Make background work reliable — 2–4 hours

Job embedding is started with an unawaited promise after job creation. A serverless function can stop after sending the response, so production jobs may never receive embeddings. Move this to a durable job, Vercel-supported post-response work, or await it with an honest loading state. Add a retry path and visibility for failed embeddings.

> Replace the fire-and-forget job embedding in POST /api/jobs with a reliable production mechanism. Track embedding status and last error, retry safely and idempotently, and expose an operational way to find and reprocess missing embeddings. Add a test that proves a created job eventually has exactly one current embedding.

**You’ll know it worked when:** terminating the request worker immediately after the response cannot permanently leave a job unembedded, and failed work is visible and retryable.

### [x] 🤖 6. Harden uploads and public media — 4–6 hours

The UI checks image type and a 5 MB limit, but browser checks are bypassable. Storage setup is partly left as commented manual SQL. Enforce bucket limits and allowed MIME types in Supabase, use non-guessable safe extensions, strip metadata or re-encode images, clean up replaced files, and decide whether portfolios/covers are deliberately public.

> Add production-safe Supabase storage migrations for avatars and covers. Enforce ownership, MIME allowlists, size limits, safe filenames, replacement cleanup, and server-side image verification/re-encoding. Add tests showing one user cannot overwrite or delete another user’s files and non-image/polyglot payloads are rejected.

**You’ll know it worked when:** storage policies are created by migrations, malicious/non-image uploads fail server-side, and replaced photos do not accumulate indefinitely.

### [x] 🤖 7. Resolve dependency advisories and add a CI security gate — 2–4 hours

Move the `shadcn` CLI out of production dependencies or remove it if unused, update its vulnerable `hono` chain, and update Next.js when a stable release includes the PostCSS fix. Do not run `npm audit fix --force` blindly because the current recommendation attempts a breaking downgrade.

> Resolve the current npm audit findings without using npm audit fix --force. Remove runtime CLI dependencies that are only used for development, update safe packages, explain any temporarily accepted advisory and why it is unreachable, then add CI checks for npm ci, lint, test, build, and high-severity production advisories.

**You’ll know it worked when:** `npm audit --omit=dev --audit-level=high` exits successfully or a narrowly documented, time-bounded exception exists for an unreachable advisory.

### [x] 🤖 8. Add real end-to-end and RLS tests — 1 day

The 25 current tests are useful but mostly mocked route/unit tests. They do not prove signup, email confirmation, password reset, storage, RLS, messaging, or a real two-role journey against Supabase.

> Add Playwright end-to-end tests and Supabase integration tests for: hirer signup/login/search/shortlist/outreach/job creation/application review; talent signup/profile upload/job discovery/application/messaging; password reset; logout; unauthorized role access; and private-data non-disclosure. Run them in CI against an isolated test project or local Supabase stack.

**You’ll know it worked when:** a clean CI run completes both core user journeys without mocks and proves tenant isolation.

## Phase 1 — Accounts and prerequisites

### [ ] 🧑 9. Create production hosting and database accounts — 30 minutes

Create a **Vercel Pro** team at [vercel.com](https://vercel.com) (**$20/month**) because Hobby is for personal/non-commercial use. Create or upgrade the production project under **Supabase → Organization → Billing → Pro** (**$25/month**) for daily backups, non-pausing production compute, and longer logs. Enable multi-factor authentication on both accounts and save recovery codes in your password manager.

**You’ll know it worked when:** both dashboards show paid production plans, MFA is enabled, and billing alerts/spend limits are configured.

### [ ] 🧑 10. Create production OpenAI access with a hard budget — 20 minutes

In [OpenAI Platform](https://platform.openai.com), create a project named `atlas-production`, add billing, set a conservative monthly budget/alert, and create a restricted project API key. Start with a budget such as **$10–$25/month** and raise it only from observed usage. Never paste the key into chat or commit it.

**You’ll know it worked when:** the production project has its own key, usage dashboard, budget alerts, and no dependence on a personal all-project key.

### [ ] 🧑 11. Buy or confirm the launch domain — 20 minutes, £10–£25/year typical

Buy the final domain from your preferred registrar or confirm that you control it. Turn on registrar MFA and auto-renew. Keep DNS (the address book that points the domain at the app) at the registrar initially; Vercel will provide the records later.

**You’ll know it worked when:** you can sign in to the registrar, the domain is in your account, MFA and auto-renew are on, and you know who receives renewal notices.

### [ ] 🧑 12. Create authentication email, error tracking, and analytics accounts — 45 minutes

Create a **Resend** account (free tier: 3,000 transactional emails/month), a **Sentry** project for Next.js (free Developer tier is sufficient initially), and a **PostHog** project in the EU region if most users are UK/EU (free tier is sufficient initially). Enable MFA. These are operational tools, not marketing-email permission.

**You’ll know it worked when:** each dashboard has a `atlas-production` project and you can invite a second emergency administrator if needed.

## Phase 2 — Production configuration and services

### [x] 🤖 13. Add typed environment validation and complete the example file — 2 hours

Fail startup clearly when a required production setting is absent. Document `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` in `.env.example` with placeholders, plus the new Sentry/PostHog settings. Ensure server-only secrets cannot enter client bundles. Remove unused DeepSeek settings from the production environment unless a code path actually needs them.

> Add central, typed environment validation for server and browser settings. Complete .env.example with safe placeholders and comments, add a test that server-only keys are not present in client output, and update README setup instructions. Never print secret values.

**You’ll know it worked when:** a build with a missing required variable fails with its name, a correct build succeeds, and browser source contains no service-role or OpenAI secret.

### [ ] 🤝 14. Configure production secrets in Vercel — 30 minutes

The agent prepares the exact variable-name list; you paste values directly into **Vercel → Project → Settings → Environment Variables** for Production. Use separate Preview credentials where possible. Do not paste secrets into chat, tickets, screenshots, or git. Trigger a fresh deployment after changes.

**You’ll know it worked when:** Vercel shows every required variable scoped correctly, the deployed app starts, and no secret value appears in build/runtime logs.

### [ ] 🤝 15. Create and migrate a dedicated production Supabase project — 1–2 hours

The agent applies the repaired migrations to a fresh project after you create it at **Supabase → New project**. Choose a UK/EU region appropriate for your users, use a generated database password stored in your password manager, enable Point-in-Time Recovery later if the business requires a tighter recovery window than daily backups, and never seed fake/demo users into production.

**You’ll know it worked when:** migration history matches the repository, all RLS tests pass against production configuration, the database is empty of demo users, and a backup is visible in **Database → Backups**.

### [ ] 🤝 16. Configure authentication URLs and trustworthy email — 1–2 hours plus DNS propagation

In **Supabase → Authentication → URL Configuration**, set the final Site URL and allow only the required production/preview redirect URLs. Enable email confirmation for public signup. In **Authentication → SMTP Settings**, connect Resend using a verified sending subdomain such as `auth.<your-domain>`; add the DNS records Resend provides. Review confirmation and reset templates so they name Atlas and link to support/privacy pages.

**You’ll know it worked when:** a new external email address receives confirmation and password-reset messages in the inbox, both links land on the production domain, and an unlisted redirect URL is rejected.

### [ ] 🤖 17. Add error monitoring, structured logs, health checks, and product analytics — 4–6 hours *(structured logs and the `/api/health` endpoint are done; Sentry + PostHog wiring waits on the Gate 4 accounts)*

Capture server and client exceptions in Sentry without sending message content, emails, API keys, or full AI prompts. Add a lightweight health endpoint that checks app health without exposing secrets. Track a small event set in PostHog: signup started/completed, profile completed, search performed, talent contacted, job posted, application submitted, and message sent. Respect consent requirements and document analytics in the privacy policy.

> Integrate Sentry and privacy-conscious PostHog analytics into this Next.js app. Redact PII and secrets, disable sensitive session capture, add release/environment tags and source maps, create a non-sensitive health endpoint, and document alert thresholds. Track only the named funnel events with stable properties and no free-text message, bio, email, or search-query content.

**You’ll know it worked when:** a deliberate test exception appears in Sentry with the correct release but no PII, the health endpoint returns 200, and a test journey appears as the intended PostHog funnel.

## Phase 3 — Trust, legal, and marketplace safety

### [ ] 🤝 18. Publish privacy, terms, cookies, and acceptable-use pages — 3–5 hours plus legal review

The agent can draft pages from the actual data flows, but you must confirm the legal entity/contact, lawful basis, retention periods, minimum age, user countries, AI use, subprocessors, and whether Atlas acts as a marketplace or recruiter. Have a UK-qualified lawyer review if this is a commercial launch; legal review cost varies. Add explicit Terms and Privacy acceptance at signup with version/timestamp evidence.

**You’ll know it worked when:** `/privacy`, `/terms`, and `/acceptable-use` are public, linked from signup and the footer, name every production data processor, explain AI processing and user rights, and accepted-policy versions are recorded.

### [ ] 🤝 19. Add account deletion, data export, reporting, blocking, and support — 1–2 days

Talent profiles and direct messages create safety and data-rights obligations. Add in-app self-service account deletion with a clear grace period, data export, report user/content/job, block user, and a monitored support address. Decide who reviews reports and the maximum response time before launch.

**You’ll know it worked when:** a test user can export and delete their account, deletion removes/authentically anonymises related data and files as documented, blocked users cannot contact each other, and a report creates an auditable support case.

### [ ] 🧑 20. Decide launch boundaries and moderation ownership — 45 minutes

Write down: eligible user age, launch countries, prohibited jobs/content, whether hirers are verified, who handles abuse reports, support hours, and the first response target. For the first launch, use an invite-only or capped beta until reporting and moderation have been exercised.

**You’ll know it worked when:** one named person owns safety/support, the rules are published, and every report has a clear escalation route.

## Phase 4 — Deploy and connect the domain

### [ ] 🤝 21. Connect the repository and create the Vercel production project — 30 minutes

You connect the git repository in **Vercel → Add New → Project** and choose this Next.js project. The agent checks build settings (`npm run build`) and ensures the design-system route is either intentionally public or excluded from production. Protect preview deployments so unfinished features are not publicly indexed.

**You’ll know it worked when:** every main-branch commit runs CI, only a green commit deploys, the Vercel production URL loads, and preview URLs require intended access.

### [ ] 🤝 22. Connect the custom domain and HTTPS — 30 minutes plus up to 24 hours

In **Vercel → Project → Settings → Domains**, add the apex domain and `www` form, choose one canonical version, and enter the DNS records at your registrar. DNS changes can take up to a day. Vercel should issue HTTPS automatically. Update Supabase URLs, email links, metadata, and analytics to the final domain, then redeploy.

**You’ll know it worked when:** both domain forms use HTTPS, one redirects to the canonical domain, the browser shows a valid certificate, and authentication links remain on that domain.

### [x] 🤖 23. Add production headers, robots, sitemap, metadata, and error states — 4–6 hours

Add a tested Content Security Policy, HSTS after the domain is stable, frame protection, referrer and permissions policies. Prevent authenticated/design-system routes from indexing, add `robots.ts` and `sitemap.ts` for public pages, provide canonical/Open Graph metadata, and add accessible `error.tsx`, `global-error.tsx`, `not-found.tsx`, and loading states. Remove the two `<img>` lint warnings where they affect the real landing page.

> Add production security headers and public-site SEO metadata appropriate to Atlas. Keep required Supabase, Sentry, PostHog, and image origins narrowly allowlisted. Exclude all authenticated and internal design-system routes from search indexing. Add accessible global error/not-found/loading experiences and resolve current lint warnings without disabling rules.

**You’ll know it worked when:** security headers appear on production responses, authenticated pages are `noindex`, public metadata previews correctly, and lint has zero warnings.

## Phase 5 — Pre-launch verification

### [ ] 🤝 24. Run the complete two-person smoke test on production — 2–3 hours

Use two fresh, real email addresses and two browsers/devices. As talent: sign up, confirm email, reset password, complete a profile, upload images, discover a job, apply, message, export data, and log out. As hirer: sign up, search, filter, view/like/shortlist talent, generate/edit/send outreach, post/close a job, review an application, update status, message, and log out. Test Safari/Chrome and a real phone. Check Sentry/logs after every failure. No payment smoke test is required because no payment system exists.

**You’ll know it worked when:** every step succeeds on the production domain, emails arrive, no private data appears in network responses, no P0/P1 error reaches Sentry, and both accounts remain isolated.

### [ ] 🤖 25. Run performance, accessibility, and abuse checks — 4–8 hours

Test the landing page and core authenticated routes on a mid-range phone/network. Keyboard-test every flow, verify labels/focus/error announcements, and check colour contrast. Load-test rate-limited endpoints modestly without attacking third-party services. Verify large/malformed inputs, repeated views, repeated AI search, and upload abuse are controlled.

> Run Lighthouse and an automated accessibility scan, then manually keyboard-test signup, search, job creation, applications, outreach, messaging, and profile editing. Run a bounded load/abuse test against staging, document p95 latency and error rate, and fix all critical/high findings. Do not send uncontrolled traffic to production or OpenAI.

**You’ll know it worked when:** no critical accessibility issue remains, core pages meet agreed mobile budgets, and controlled bursts produce graceful 429s rather than excess spend or 500s.

### [ ] 🧑 26. Approve the launch and support plan — 30 minutes

Confirm the smoke-test evidence, launch audience size, support mailbox coverage, incident owner, rollback decision-maker, status-update channel, and OpenAI/Vercel/Supabase spend alerts. Schedule a quiet launch window when you can monitor for at least two hours.

**You’ll know it worked when:** one written go/no-go record names the owner for incidents, privacy/safety reports, customer support, and rollback.

## Phase 6 — After launch

### [ ] 🤝 27. Monitor closely for the first 72 hours — 30 minutes twice daily

Check Sentry errors, Vercel function/runtime logs, Supabase auth/database/storage usage, OpenAI usage/cost, email bounces, PostHog funnel drop-off, and the support inbox. The agent can prepare a dashboard/runbook; you make product and customer decisions.

**You’ll know it worked when:** each check has an owner and threshold, unexpected spend or errors alert someone, and issues are logged with severity and resolution.

### [ ] 🤖 28. Prove backup restoration and write the incident runbook — 3–4 hours

A backup is not proven until it restores. Restore a production backup into a separate non-production project, verify core row counts and relationships, document recovery time, and safely delete the temporary copy. Write exact rollback, key-rotation, database recovery, AI-disable, email-disable, and status-message steps.

> Create docs/production-runbook.md covering deploy rollback, Supabase restore, compromised-key rotation, OpenAI cost spike shutdown, email outage, data exposure, and user-report escalation. Perform and document a restore drill into an isolated project without altering production.

**You’ll know it worked when:** a recent backup has been restored and verified, and another engineer can follow the runbook without undocumented knowledge.

### [ ] 🤝 29. Review launch metrics and risks after one week — 1 hour

Review signup completion, profile completion, successful searches, contact/application conversion, messaging success, support volume, abuse reports, latency, errors, and cost per active user. Choose the next three improvements from evidence rather than adding broad scope during launch week.

**You’ll know it worked when:** the review is written down with three owners, dates, and measurable outcomes.

## Recommended first move

Start with **Phase 0, steps 1–3 as one privacy/data-safety workstream**: repair the migrations/RLS, remove private fields from profile reads, and disable authenticated-page service-worker caching. Do not put real customer data into this build until those three checks pass.
