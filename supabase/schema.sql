-- ============================================================
-- Atlas - Supabase Schema
-- Run this entire file in: Supabase Dashboard > SQL Editor
-- Prerequisites:
--   1. Enable pgvector: Dashboard > Database > Extensions > "vector" > Enable
--   2. Disable email confirmation: Auth > Settings > "Enable email confirmations" OFF
-- ============================================================

-- pgvector extension (must be enabled in dashboard first)
create extension if not exists vector;

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  account_type  text not null check (account_type in ('hirer', 'talent')),
  full_name     text not null,
  email         text not null,
  avatar_url    text,
  city          text,
  country       text,
  bio           text,
  rates         text,
  availability  text,
  showreel_url  text,
  created_at    timestamptz default now() not null
);

create table public.talent_skills (
  id          uuid default gen_random_uuid() primary key,
  profile_id  uuid references public.profiles(id) on delete cascade not null,
  category    text not null check (category in ('dancer', 'actor', 'content_creator')),
  skill       text not null,
  proficiency text not null check (proficiency in ('beginner', 'intermediate', 'advanced', 'expert')),
  created_at  timestamptz default now() not null
);

-- 1536 dimensions = text-embedding-3-small output size
create table public.profile_embeddings (
  profile_id  uuid references public.profiles(id) on delete cascade primary key,
  embedding   vector(1536),
  source_text text not null,
  updated_at  timestamptz default now() not null
);

-- IVFFlat index for fast cosine similarity search (tune lists= at ~sqrt(row_count))
create index profile_embeddings_ivfflat_idx
  on public.profile_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

create table public.jobs (
  id              uuid default gen_random_uuid() primary key,
  hirer_id        uuid references public.profiles(id) on delete cascade not null,
  title           text not null,
  description     text not null,
  category        text not null check (category in ('dancer', 'actor', 'content_creator')),
  skills_required text[] default '{}',
  location        text not null,
  budget          text,
  status          text not null default 'open' check (status in ('open', 'closed')),
  created_at      timestamptz default now() not null
);

create table public.applications (
  id         uuid default gen_random_uuid() primary key,
  job_id     uuid references public.jobs(id) on delete cascade not null,
  talent_id  uuid references public.profiles(id) on delete cascade not null,
  status     text not null default 'sent'
             check (status in ('sent', 'viewed', 'responded', 'shortlisted', 'hired')),
  created_at timestamptz default now() not null,
  unique(job_id, talent_id)
);

create table public.outreach (
  id         uuid default gen_random_uuid() primary key,
  hirer_id   uuid references public.profiles(id) on delete cascade not null,
  talent_id  uuid references public.profiles(id) on delete cascade not null,
  message    text not null,
  status     text not null default 'sent'
             check (status in ('draft', 'sent', 'viewed', 'responded')),
  created_at timestamptz default now() not null
);

-- ============================================================
-- Trigger: auto-create profile row on auth.users insert
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, account_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce(new.raw_user_meta_data->>'account_type', 'talent')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.talent_skills      enable row level security;
alter table public.profile_embeddings enable row level security;
alter table public.jobs               enable row level security;
alter table public.applications       enable row level security;
alter table public.outreach           enable row level security;

-- profiles
create policy "profiles_select_all"
  on public.profiles for select using (true);

create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = id);

-- talent_skills
create policy "skills_select_all"
  on public.talent_skills for select using (true);

create policy "skills_manage_own"
  on public.talent_skills for all using (auth.uid() = profile_id);

-- profile_embeddings (service_role handles writes, bypasses RLS)
create policy "embeddings_select_authenticated"
  on public.profile_embeddings for select
  to authenticated
  using (true);

-- jobs
create policy "jobs_select_all"
  on public.jobs for select using (true);

create policy "jobs_manage_own"
  on public.jobs for all using (auth.uid() = hirer_id);

-- applications
create policy "applications_select_talent"
  on public.applications for select
  using (auth.uid() = talent_id);

create policy "applications_select_hirer"
  on public.applications for select
  using (
    auth.uid() in (select hirer_id from public.jobs where id = job_id)
  );

create policy "applications_insert_talent"
  on public.applications for insert
  with check (auth.uid() = talent_id);

create policy "applications_update_hirer"
  on public.applications for update
  using (
    auth.uid() in (select hirer_id from public.jobs where id = job_id)
  );

-- outreach
create policy "outreach_select_hirer"
  on public.outreach for select using (auth.uid() = hirer_id);

create policy "outreach_select_talent"
  on public.outreach for select using (auth.uid() = talent_id);

create policy "outreach_insert_hirer"
  on public.outreach for insert with check (auth.uid() = hirer_id);

create policy "outreach_update_hirer"
  on public.outreach for update using (auth.uid() = hirer_id);

create policy "outreach_update_talent"
  on public.outreach for update using (auth.uid() = talent_id);

-- ============================================================
-- Phase 4 additions
-- ============================================================

-- match_talent: cosine similarity search over profile embeddings
-- Called by /api/search
create or replace function match_talent(
  query_embedding vector(1536),
  match_count int default 20
)
returns table (profile_id uuid, similarity float)
language plpgsql as $$
begin
  return query
  select pe.profile_id,
         1 - (pe.embedding <=> query_embedding) as similarity
  from public.profile_embeddings pe
  order by pe.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- job_embeddings: stores OpenAI embeddings for job descriptions
create table public.job_embeddings (
  job_id     uuid references public.jobs(id) on delete cascade primary key,
  embedding  vector(1536),
  updated_at timestamptz default now() not null
);

alter table public.job_embeddings enable row level security;

create policy "job_embeddings_select_authenticated"
  on public.job_embeddings for select
  to authenticated
  using (true);

-- shortlists: hirers bookmark talent profiles
create table public.shortlists (
  id         uuid default gen_random_uuid() primary key,
  hirer_id   uuid references public.profiles(id) on delete cascade not null,
  talent_id  uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(hirer_id, talent_id)
);

alter table public.shortlists enable row level security;

create policy "shortlists_manage_own"
  on public.shortlists for all using (auth.uid() = hirer_id);

-- ============================================================
-- Storage: avatars bucket
-- Run in: Supabase Dashboard > Storage > New Bucket > "avatars" (public)
-- Then run these policies in SQL Editor:
-- ============================================================

-- Allow any authenticated user to upload to avatars
-- create policy "avatars_insert_own"
--   on storage.objects for insert
--   to authenticated
--   with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access
-- create policy "avatars_select_public"
--   on storage.objects for select
--   using (bucket_id = 'avatars');

-- Allow users to update/delete their own uploads
-- create policy "avatars_update_own"
--   on storage.objects for update
--   to authenticated
--   using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- create policy "avatars_delete_own"
--   on storage.objects for delete
--   to authenticated
--   using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Direct messaging
-- ============================================================

create table public.message_threads (
  id         uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null
);

create table public.thread_participants (
  thread_id    uuid references public.message_threads(id) on delete cascade not null,
  profile_id   uuid references public.profiles(id) on delete cascade not null,
  last_read_at timestamptz default now() not null,
  primary key (thread_id, profile_id)
);

create table public.messages (
  id         uuid default gen_random_uuid() primary key,
  thread_id  uuid references public.message_threads(id) on delete cascade not null,
  sender_id  uuid references public.profiles(id) on delete cascade not null,
  content    text not null,
  created_at timestamptz default now() not null
);

alter table public.message_threads enable row level security;
alter table public.thread_participants enable row level security;
alter table public.messages enable row level security;

-- thread_participants: only see/insert your own
create policy "participants_select_own"
  on public.thread_participants for select
  using (profile_id = auth.uid());

create policy "participants_insert_own"
  on public.thread_participants for insert
  with check (profile_id = auth.uid());

-- messages: only participants can read; authenticated can insert as self
create policy "messages_select_participant"
  on public.messages for select
  using (
    exists (
      select 1 from public.thread_participants
      where thread_id = messages.thread_id and profile_id = auth.uid()
    )
  );

create policy "messages_insert_own"
  on public.messages for insert
  with check (sender_id = auth.uid());

-- message_threads: accessible to participants
create policy "threads_select_participant"
  on public.message_threads for select
  using (
    exists (
      select 1 from public.thread_participants
      where thread_id = message_threads.id and profile_id = auth.uid()
    )
  );

-- match_jobs: cosine similarity search over job embeddings
-- Called by /api/discover (talent side)
create or replace function match_jobs(
  query_embedding vector(1536),
  match_count int default 20
)
returns table (job_id uuid, similarity float)
language plpgsql as $$
begin
  return query
  select je.job_id,
         1 - (je.embedding <=> query_embedding) as similarity
  from public.job_embeddings je
  order by je.embedding <=> query_embedding
  limit match_count;
end;
$$;
