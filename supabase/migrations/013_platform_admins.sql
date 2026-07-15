-- Platform operators (Atlas business owners). Separate from hirer/talent marketplace roles.

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'moderator', 'support')),
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- No policies: only service_role may read or write admin membership.

create or replace function public.is_platform_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = check_user_id
  );
$$;

revoke all on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;

-- Account suspension (platform-enforced, not user preference).
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text check (suspension_reason is null or char_length(suspension_reason) <= 500);

comment on column public.profiles.suspended_at is
  'When set, the account cannot use marketplace features until cleared by a platform admin.';

-- Job moderation takedown (distinct from hirer closing a job).
alter table public.jobs
  add column if not exists removed_at timestamptz,
  add column if not exists removal_reason text check (removal_reason is null or char_length(removal_reason) <= 500);

comment on column public.jobs.removed_at is
  'Platform moderation takedown. Hidden from discover/search while set.';

-- Report resolution metadata for the admin queue.
alter table public.reports
  add column if not exists admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz;

-- Exclude suspended talent from discoverability.
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
      and p.suspended_at is null
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
    and p.suspended_at is null
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
    and p.suspended_at is null
    and public.talent_matches_filters(pe.profile_id, filters)
  order by pe.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
$$;
