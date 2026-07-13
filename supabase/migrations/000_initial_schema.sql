-- Atlas canonical baseline.
-- This migration creates every object required before migrations 001-003 run.
-- Apply through the Supabase CLI; do not paste fragments into the dashboard.

create extension if not exists vector with schema extensions;

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

create table public.profile_embeddings (
  profile_id  uuid references public.profiles(id) on delete cascade primary key,
  embedding   extensions.vector(1536),
  source_text text not null,
  updated_at  timestamptz default now() not null
);

create index profile_embeddings_ivfflat_idx
  on public.profile_embeddings
  using ivfflat (embedding extensions.vector_cosine_ops)
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

create table public.job_embeddings (
  job_id     uuid references public.jobs(id) on delete cascade primary key,
  embedding  extensions.vector(1536),
  updated_at timestamptz default now() not null
);

create table public.shortlists (
  id         uuid default gen_random_uuid() primary key,
  hirer_id   uuid references public.profiles(id) on delete cascade not null,
  talent_id  uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(hirer_id, talent_id)
);

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
  content    text not null check (char_length(content) between 1 and 5000),
  created_at timestamptz default now() not null
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

create index thread_participants_profile_idx
  on public.thread_participants(profile_id, thread_id);
create index messages_thread_created_idx
  on public.messages(thread_id, created_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, account_type)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'User'),
    case
      when new.raw_user_meta_data->>'account_type' in ('hirer', 'talent')
        then new.raw_user_meta_data->>'account_type'
      else 'talent'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
    and (
      new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.account_type is distinct from old.account_type
    )
  then
    raise exception 'Profile identity fields are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_profile_identity_before_update
  before update on public.profiles
  for each row execute procedure public.protect_profile_identity();

create or replace function public.match_talent(
  query_embedding extensions.vector(1536),
  match_count int default 20
)
returns table (profile_id uuid, similarity float)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select pe.profile_id,
         1 - (pe.embedding <=> query_embedding) as similarity
  from public.profile_embeddings pe
  order by pe.embedding <=> query_embedding
  limit greatest(0, least(match_count, 100));
$$;

create or replace function public.match_jobs(
  query_embedding extensions.vector(1536),
  match_count int default 20
)
returns table (job_id uuid, similarity float)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select je.job_id,
         1 - (je.embedding <=> query_embedding) as similarity
  from public.job_embeddings je
  order by je.embedding <=> query_embedding
  limit greatest(0, least(match_count, 100));
$$;

-- SECURITY DEFINER avoids recursive RLS checks while exposing only a boolean.
create or replace function public.is_thread_participant(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.thread_participants participant
    where participant.thread_id = target_thread_id
      and participant.profile_id = auth.uid()
  );
$$;

-- Thread creation must be atomic. Direct inserts remain blocked by RLS.
create or replace function public.create_or_get_thread(other_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  caller_type text;
  other_type text;
  found_thread_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if other_profile_id is null or other_profile_id = caller_id then
    raise exception 'A different participant is required' using errcode = '22023';
  end if;

  select account_type into caller_type from public.profiles where id = caller_id;
  select account_type into other_type from public.profiles where id = other_profile_id;

  if caller_type is distinct from 'hirer' or other_type is distinct from 'talent' then
    raise exception 'Only hirers can start conversations with talent' using errcode = '42501';
  end if;

  -- Serialize creation for this pair so concurrent requests cannot create duplicates.
  perform pg_advisory_xact_lock(
    hashtextextended(least(caller_id::text, other_profile_id::text) || ':' || greatest(caller_id::text, other_profile_id::text), 0)
  );

  select mine.thread_id
    into found_thread_id
  from public.thread_participants mine
  join public.thread_participants theirs on theirs.thread_id = mine.thread_id
  where mine.profile_id = caller_id
    and theirs.profile_id = other_profile_id
  limit 1;

  if found_thread_id is not null then
    return found_thread_id;
  end if;

  insert into public.message_threads default values
    returning id into found_thread_id;

  insert into public.thread_participants (thread_id, profile_id)
  values (found_thread_id, caller_id), (found_thread_id, other_profile_id);

  return found_thread_id;
end;
$$;

revoke all on function public.is_thread_participant(uuid) from public;
revoke all on function public.create_or_get_thread(uuid) from public;
revoke all on function public.is_thread_participant(uuid) from anon;
revoke all on function public.create_or_get_thread(uuid) from anon;
grant execute on function public.is_thread_participant(uuid) to authenticated;
grant execute on function public.create_or_get_thread(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.talent_skills enable row level security;
alter table public.profile_embeddings enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.outreach enable row level security;
alter table public.job_embeddings enable row level security;
alter table public.shortlists enable row level security;
alter table public.message_threads enable row level security;
alter table public.thread_participants enable row level security;
alter table public.messages enable row level security;

create policy "profiles_select_all"
  on public.profiles for select using (true);
create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = id);

create policy "skills_select_all"
  on public.talent_skills for select using (true);
create policy "skills_manage_own"
  on public.talent_skills for all using (auth.uid() = profile_id);

create policy "embeddings_select_authenticated"
  on public.profile_embeddings for select to authenticated using (true);

create policy "jobs_select_all"
  on public.jobs for select using (true);
create policy "jobs_manage_own"
  on public.jobs for all using (auth.uid() = hirer_id);

create policy "applications_select_talent"
  on public.applications for select using (auth.uid() = talent_id);
create policy "applications_select_hirer"
  on public.applications for select using (
    auth.uid() in (select hirer_id from public.jobs where id = job_id)
  );
create policy "applications_insert_talent"
  on public.applications for insert with check (auth.uid() = talent_id);
create policy "applications_update_hirer"
  on public.applications for update using (
    auth.uid() in (select hirer_id from public.jobs where id = job_id)
  );

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

create policy "job_embeddings_select_authenticated"
  on public.job_embeddings for select to authenticated using (true);
create policy "shortlists_manage_own"
  on public.shortlists for all using (auth.uid() = hirer_id);

create policy "threads_select_participant"
  on public.message_threads for select
  using (public.is_thread_participant(id));

create policy "participants_select_thread"
  on public.thread_participants for select
  using (public.is_thread_participant(thread_id));
create policy "participants_update_own"
  on public.thread_participants for update
  using (profile_id = auth.uid() and public.is_thread_participant(thread_id))
  with check (profile_id = auth.uid() and public.is_thread_participant(thread_id));

create policy "messages_select_participant"
  on public.messages for select
  using (public.is_thread_participant(thread_id));
create policy "messages_insert_participant"
  on public.messages for insert
  with check (sender_id = auth.uid() and public.is_thread_participant(thread_id));
