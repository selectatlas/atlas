-- Account settings, talent discoverability, and hirer workspace defaults.

alter table public.profiles
  add column if not exists profile_visibility text not null default 'public'
  check (profile_visibility in ('public', 'members', 'private'));

comment on column public.profiles.profile_visibility is
  'Discoverability for talent: public (all members), members (authenticated hirers), private (owner only).';

grant select (profile_visibility) on table public.profiles to authenticated;
grant update (profile_visibility) on table public.profiles to authenticated;

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
  on public.notification_preferences
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
  on public.notification_preferences
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
  on public.notification_preferences
  for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create table if not exists public.hirer_workspace_defaults (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  job_defaults jsonb not null default '{}'::jsonb,
  outreach_defaults jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hirer_workspace_defaults enable row level security;

drop policy if exists "hirer_workspace_defaults_select_own" on public.hirer_workspace_defaults;
create policy "hirer_workspace_defaults_select_own"
  on public.hirer_workspace_defaults
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "hirer_workspace_defaults_insert_own" on public.hirer_workspace_defaults;
create policy "hirer_workspace_defaults_insert_own"
  on public.hirer_workspace_defaults
  for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_type = 'hirer'
    )
  );

drop policy if exists "hirer_workspace_defaults_update_own" on public.hirer_workspace_defaults;
create policy "hirer_workspace_defaults_update_own"
  on public.hirer_workspace_defaults
  for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_type = 'hirer'
    )
  );

create or replace function public.set_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute procedure public.set_settings_updated_at();

drop trigger if exists hirer_workspace_defaults_set_updated_at on public.hirer_workspace_defaults;
create trigger hirer_workspace_defaults_set_updated_at
  before update on public.hirer_workspace_defaults
  for each row execute procedure public.set_settings_updated_at();

-- Discoverable talent only. Private profiles are never returned.
-- members/public both surface in hirer search (search is hirer-gated in the API).
create or replace function public.talent_matches_filters(
  target_profile_id uuid,
  filters jsonb default '{}'
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select
      p.profile_visibility <> 'private'
      and (not (filters ? 'category') or exists (
        select 1 from public.talent_skills skill
        where skill.profile_id = p.id and skill.category = filters->>'category'
      ))
      and (not (filters ? 'location') or
        lower(concat_ws(' ', p.city, p.country)) like '%' || lower(filters->>'location') || '%')
      and (not (filters ? 'available_now') or tp.available_now = (filters->>'available_now')::boolean)
      and (not (filters ? 'age') or (
        (not ((filters->'age') ? 'min') or extract(year from current_date)::int - tp.birth_year >= ((filters->'age'->>'min')::int))
        and (not ((filters->'age') ? 'max') or extract(year from current_date)::int - tp.birth_year <= ((filters->'age'->>'max')::int))
      ))
      and (not (filters ? 'gender') or tp.gender = any(array(select jsonb_array_elements_text(filters->'gender'))))
      and (not (filters ? 'languages') or tp.languages && array(select jsonb_array_elements_text(filters->'languages')))
      and (not (filters ? 'nationalities') or tp.nationalities && array(select jsonb_array_elements_text(filters->'nationalities')))
      and (not (filters ? 'height') or (
        (not ((filters->'height') ? 'min') or tp.height_cm >= ((filters->'height'->>'min')::int))
        and (not ((filters->'height') ? 'max') or tp.height_cm <= ((filters->'height'->>'max')::int))
      ))
      and (not (filters ? 'rate') or (
        (not ((filters->'rate') ? 'min') or tp.rate_max >= ((filters->'rate'->>'min')::int))
        and (not ((filters->'rate') ? 'max') or tp.rate_min <= ((filters->'rate'->>'max')::int))
      ))
      and (not (filters ? 'dance_styles') or exists (
        select 1 from public.talent_skills skill
        where skill.profile_id = p.id
          and regexp_replace(lower(skill.skill), '[^a-z0-9]+', '_', 'g') = any(array(select jsonb_array_elements_text(filters->'dance_styles')))
      ))
      and not exists (
        select 1
        from jsonb_each(coalesce(filters->'attributes', '{}')) requested
        where case jsonb_typeof(requested.value)
          when 'array' then not (
            (jsonb_typeof(tp.public_attributes->requested.key) = 'array'
              and (tp.public_attributes->requested.key) ?| array(select jsonb_array_elements_text(requested.value)))
            or (jsonb_typeof(tp.public_attributes->requested.key) = 'string'
              and tp.public_attributes->>requested.key = any(array(select jsonb_array_elements_text(requested.value))))
          )
          when 'boolean' then coalesce((tp.public_attributes->>requested.key)::boolean is distinct from (requested.value::text)::boolean, true)
          when 'string' then coalesce(lower(tp.public_attributes->>requested.key) not like '%' || lower(requested.value #>> '{}') || '%', true)
          else true
        end
      )
      and not exists (
        select 1
        from jsonb_each(coalesce(filters->'sensitive', '{}')) requested
        where jsonb_typeof(requested.value) <> 'boolean'
          or coalesce((sensitive.preferences->>requested.key)::boolean is distinct from (requested.value::text)::boolean, true)
      )
    from public.profiles p
    left join public.talent_profiles tp on tp.profile_id = p.id
    left join public.talent_sensitive_preferences sensitive on sensitive.profile_id = p.id
    where p.id = target_profile_id and p.account_type = 'talent'
  ), false);
$$;

create or replace function public.search_talent_filtered(
  filters jsonb default '{}',
  result_limit integer default 24,
  result_offset integer default 0,
  result_sort text default 'newest'
)
returns table (profile_id uuid, total_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, count(*) over()
  from public.profiles p
  left join public.talent_profiles tp on tp.profile_id = p.id
  where p.account_type = 'talent'
    and p.profile_visibility <> 'private'
    and public.talent_matches_filters(p.id, filters)
  order by
    case when result_sort = 'available' then tp.available_now::int end desc nulls last,
    p.created_at desc,
    p.id
  limit greatest(1, least(result_limit, 100))
  offset greatest(0, result_offset);
$$;

create or replace function public.match_talent_filtered(
  query_embedding extensions.vector(1536),
  filters jsonb default '{}',
  match_count integer default 20
)
returns table (profile_id uuid, similarity float)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select pe.profile_id,
         1 - (pe.embedding <=> query_embedding) as similarity
  from public.profile_embeddings pe
  join public.profiles p on p.id = pe.profile_id
  where p.account_type = 'talent'
    and p.profile_visibility <> 'private'
    and public.talent_matches_filters(pe.profile_id, filters)
  order by pe.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
$$;
