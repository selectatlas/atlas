-- Privacy-safe talent filter data and filtered search primitives.
-- Exact/private values are kept out of public.profiles so the browser-wide
-- profile projection cannot accidentally expose them.

alter table public.talent_skills drop constraint if exists talent_skills_category_check;
alter table public.talent_skills add constraint talent_skills_category_check
  check (category in ('dancer', 'actor', 'photographer_videographer', 'content_creator'));

alter table public.jobs drop constraint if exists jobs_category_check;
alter table public.jobs add constraint jobs_category_check
  check (category in ('dancer', 'actor', 'photographer_videographer', 'content_creator'));

create table public.talent_profiles (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  birth_year         smallint check (birth_year between 1900 and 2100),
  gender             text check (gender in ('male', 'female', 'non_binary')),
  height_cm          smallint check (height_cm between 100 and 230),
  rate_min           integer check (rate_min between 0 and 20000),
  rate_max           integer check (rate_max between 0 and 20000),
  rate_unit          text default 'day' check (rate_unit = 'day'),
  rate_currency      text not null default 'GBP' check (rate_currency = 'GBP'),
  languages          text[] not null default '{}',
  nationalities      text[] not null default '{}',
  available_now      boolean,
  public_attributes  jsonb not null default '{}',
  updated_at         timestamptz not null default now(),
  check (rate_min is null or rate_max is null or rate_min <= rate_max),
  check (jsonb_typeof(public_attributes) = 'object')
);

create table public.talent_sensitive_preferences (
  profile_id   uuid primary key references public.profiles(id) on delete cascade,
  preferences  jsonb not null default '{}',
  updated_at   timestamptz not null default now(),
  check (jsonb_typeof(preferences) = 'object')
);

create index talent_profiles_birth_year_idx on public.talent_profiles(birth_year);
create index talent_profiles_gender_idx on public.talent_profiles(gender);
create index talent_profiles_height_idx on public.talent_profiles(height_cm);
create index talent_profiles_rate_idx on public.talent_profiles(rate_min, rate_max);
create index talent_profiles_available_idx on public.talent_profiles(available_now);
create index talent_profiles_languages_gin_idx on public.talent_profiles using gin(languages);
create index talent_profiles_nationalities_gin_idx on public.talent_profiles using gin(nationalities);
create index talent_profiles_attributes_gin_idx on public.talent_profiles using gin(public_attributes);
create index talent_sensitive_preferences_gin_idx on public.talent_sensitive_preferences using gin(preferences);
create index talent_skills_category_profile_idx on public.talent_skills(category, profile_id);

alter table public.talent_profiles enable row level security;
alter table public.talent_sensitive_preferences enable row level security;

create policy "talent_profiles_select_own"
  on public.talent_profiles for select to authenticated
  using (auth.uid() = profile_id);
create policy "talent_profiles_update_own"
  on public.talent_profiles for update to authenticated
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "talent_profiles_insert_own"
  on public.talent_profiles for insert to authenticated
  with check (auth.uid() = profile_id);

create policy "talent_sensitive_select_own"
  on public.talent_sensitive_preferences for select to authenticated
  using (auth.uid() = profile_id);
create policy "talent_sensitive_update_own"
  on public.talent_sensitive_preferences for update to authenticated
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "talent_sensitive_insert_own"
  on public.talent_sensitive_preferences for insert to authenticated
  with check (auth.uid() = profile_id);

-- Product code accesses these records through role-checked server routes. Do
-- not expose either table through the general authenticated PostgREST surface.
revoke all on table public.talent_profiles from anon, authenticated;
revoke all on table public.talent_sensitive_preferences from anon, authenticated;

create or replace function public.set_talent_filter_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger talent_profiles_updated_at
  before update on public.talent_profiles
  for each row execute procedure public.set_talent_filter_updated_at();
create trigger talent_sensitive_preferences_updated_at
  before update on public.talent_sensitive_preferences
  for each row execute procedure public.set_talent_filter_updated_at();

-- Central predicate shared by browse and semantic search. The API validates
-- filter keys before calling this function; all values remain SQL parameters.
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
      (not (filters ? 'category') or exists (
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
    and public.talent_matches_filters(p.id, filters)
  order by
    case when result_sort = 'available' then tp.available_now::int end desc nulls last,
    p.created_at desc,
    p.id
  limit greatest(1, least(result_limit, 48))
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
  where public.talent_matches_filters(pe.profile_id, filters)
  order by pe.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
$$;

revoke execute on function public.talent_matches_filters(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.search_talent_filtered(jsonb, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.match_talent_filtered(extensions.vector, jsonb, integer) from public, anon, authenticated;
grant execute on function public.talent_matches_filters(uuid, jsonb) to service_role;
grant execute on function public.search_talent_filtered(jsonb, integer, integer, text) to service_role;
grant execute on function public.match_talent_filtered(extensions.vector, jsonb, integer) to service_role;
