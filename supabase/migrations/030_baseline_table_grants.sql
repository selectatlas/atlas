-- ============================================================
-- Atlas - Explicit baseline table grants.
--
-- Why: local stacks started by current Supabase CLI versions do
-- not carry the legacy default privileges that hosted projects
-- have, so every table that relied on implicit grants throws
-- "permission denied" for the authenticated role in CI (the
-- pgTAP job has failed on this since the first recorded run).
-- Hosted already has these grants, so this migration is an
-- idempotent no-op there and makes CI match production.
--
-- Model: RLS is the row boundary; table grants are the column/
-- verb boundary. Deliberately-restricted tables are NOT granted
-- here and must stay that way:
--   profiles           - column-allowlisted select (005/015/028)
--   talent_reviews     - column-allowlisted select (018)
--   rate_limits        - service-role only (007)
--   talent_profiles    - service-role only (009)
--   talent_sensitive_preferences - service-role only (009)
--   platform_admins    - service-role only (013)
--   profile_embeddings / job_embeddings - service-role only
--
-- Convention going forward: every migration that creates a table
-- declares its own grants explicitly (029 missed this; fixed
-- here for message_reactions).
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- The server-side client acts with service_role across the whole
-- schema, including the restricted tables above - that is its job.
grant all on all tables in schema public to service_role;

-- User-facing tables: full verbs for authenticated; RLS policies
-- (and their absence) decide which rows each verb can touch.
grant select, insert, update, delete on table public.applications to authenticated;
grant select, insert, update, delete on table public.blocks to authenticated;
grant select, insert, update, delete on table public.credits to authenticated;
grant select, insert, update, delete on table public.hirer_workspace_defaults to authenticated;
grant select, insert, update, delete on table public.job_alerts to authenticated;
grant select, insert, update, delete on table public.job_passes to authenticated;
grant select, insert, update, delete on table public.jobs to authenticated;
grant select, insert, update, delete on table public.message_reactions to authenticated;
grant select, insert, update, delete on table public.message_threads to authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant select, insert, update, delete on table public.notification_preferences to authenticated;
grant select, insert, update, delete on table public.outreach to authenticated;
grant select, insert, update, delete on table public.portfolio_items to authenticated;
grant select, insert, update, delete on table public.profile_likes to authenticated;
grant select, insert, update, delete on table public.profile_views to authenticated;
grant select, insert, update, delete on table public.reports to authenticated;
grant select, insert, update, delete on table public.saved_searches to authenticated;
grant select, insert, update, delete on table public.shortlists to authenticated;
grant select, insert, update, delete on table public.talent_skills to authenticated;
grant select, insert, update, delete on table public.thread_participants to authenticated;

-- profiles: users update their own row (RLS profiles_update_own;
-- protect_profile_identity() guards server-managed columns).
-- SELECT stays column-allowlisted - do not add a table-level select.
grant insert, update on table public.profiles to authenticated;

-- talent_reviews: writing goes through RLS-checked policies (018/020);
-- reading stays column-allowlisted from 018 - grant verbs, not select.
grant insert, update, delete on table public.talent_reviews to authenticated;

-- anon keeps only what 026 explicitly granted (public job browsing).
