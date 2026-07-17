-- ============================================================
-- Atlas - Verification affects ranking, not just the badge.
-- Recreates search_talent_filtered and match_talent_filtered
-- (canonical bodies from 013) so verified talent rank ahead:
--   * browse: verified-first tiebreak before recency
--   * semantic match: +0.02 similarity ordering boost (~2 display
--     points), applied to ORDER BY only - the returned similarity
--     stays the raw cosine score so match scores remain real.
-- The same 0.02 constant lives in src/lib/matching.ts
-- (VERIFICATION_MATCH_BOOST) because the search route re-sorts in
-- JS; keep the two in sync.
-- ============================================================

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
    (p.verified_at is not null)::int desc,
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
  order by (1 - (pe.embedding <=> query_embedding))
         + case when p.verified_at is not null then 0.02 else 0 end desc
  limit greatest(1, least(match_count, 100));
$$;
