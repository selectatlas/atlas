-- ============================================================
-- Atlas — Job cover images: optional 16:9 visual header shown
-- on job cards and the job detail page. Seeded jobs get a
-- mirrored storage image; jobs without one fall back to a
-- category gradient in the UI.
-- ============================================================

alter table public.jobs add column if not exists cover_url text;
