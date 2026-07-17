-- ============================================================
-- Atlas — Saved searches: hirers persist a named query + filter
-- set. New-match alerts are computed at read time against
-- last_viewed_at (no cron, no notifications table).
-- ============================================================

create table if not exists public.saved_searches (
  id             uuid default gen_random_uuid() primary key,
  hirer_id       uuid references public.profiles(id) on delete cascade not null,
  name           text not null check (char_length(name) between 1 and 80),
  query          text not null default '' check (char_length(query) <= 500),
  filters        jsonb not null default '{}'::jsonb,
  last_viewed_at timestamptz default now() not null,
  created_at     timestamptz default now() not null
);

alter table public.saved_searches enable row level security;

-- Owner-only on every verb: a saved search is private hirer state.
create policy "saved_searches_select_own"
  on public.saved_searches for select
  using (auth.uid() = hirer_id);

create policy "saved_searches_insert_own"
  on public.saved_searches for insert
  to authenticated
  with check (auth.uid() = hirer_id);

create policy "saved_searches_update_own"
  on public.saved_searches for update
  using (auth.uid() = hirer_id)
  with check (auth.uid() = hirer_id);

create policy "saved_searches_delete_own"
  on public.saved_searches for delete
  using (auth.uid() = hirer_id);

create index if not exists saved_searches_hirer_created_idx
  on public.saved_searches(hirer_id, created_at desc);
