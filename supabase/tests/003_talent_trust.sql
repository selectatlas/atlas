begin;
select plan(18);

-- Schema: new columns exist
select has_column('public', 'credits', 'outcome', 'credits.outcome exists');
select has_column('public', 'credits', 'client_logo_url', 'credits.client_logo_url exists');
select has_column('public', 'portfolio_items', 'role', 'portfolio_items.role exists');
select has_column('public', 'portfolio_items', 'project_date', 'portfolio_items.project_date exists');
select has_column('public', 'portfolio_items', 'outcome', 'portfolio_items.outcome exists');
select has_column('public', 'profiles', 'verified_at', 'profiles.verified_at exists');
select has_column('public', 'profiles', 'verified_categories', 'profiles.verified_categories exists');
select has_column('public', 'talent_profiles', 'response_time_hours', 'talent_profiles.response_time_hours exists');
select has_table('public', 'talent_reviews', 'talent_reviews table exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('40000000-0000-0000-0000-000000000001', 'trust-hirer@example.test', '{"account_type":"hirer","full_name":"Trust Hirer"}'),
  ('50000000-0000-0000-0000-000000000002', 'trust-talent@example.test', '{"account_type":"talent","full_name":"Trust Talent"}');

-- Seed a review + a photographer credit as service role
set local role service_role;
select lives_ok(
  $$insert into public.talent_reviews (talent_id, reviewer_id, rating, body, project_title)
    values ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 5, 'Outstanding on set.', 'Brand campaign')$$,
  'service role can insert reviews'
);
select lives_ok(
  $$insert into public.credits (profile_id, title, production, category, outcome)
    values ('50000000-0000-0000-0000-000000000002', 'Lead shooter', 'Lookbook 2026', 'photographer_videographer', 'Delivered 40 finals in 5 days')$$,
  'credits accepts photographer_videographer category'
);
select lives_ok(
  $$update public.profiles
    set verified_at = now(), verified_categories = array['actor']
    where id = '50000000-0000-0000-0000-000000000002'$$,
  'service role can set verification'
);

-- Authenticated hirer can read reviews and aggregates
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$select count(*)::bigint from public.talent_reviews where talent_id = '50000000-0000-0000-0000-000000000002'$$,
  array[1::bigint],
  'authenticated users can read reviews'
);
select results_eq(
  $$select review_count::bigint, avg_rating::numeric
    from public.talent_stats where profile_id = '50000000-0000-0000-0000-000000000002'$$,
  $$values (1::bigint, 5.00::numeric)$$,
  'talent_stats exposes review_count and avg_rating'
);
select throws_ok(
  $$insert into public.talent_reviews (talent_id, reviewer_id, rating, body)
    values ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 5, 'Self-service insert')$$,
  '42501',
  null,
  'authenticated users cannot insert reviews'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'verified_at', 'select'),
  'authenticated callers can select verified_at'
);

-- Talent cannot self-verify
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
-- now() is transaction-stable: the seeded verified_at above is the same
-- value, which would make the identity trigger see no change. Use a
-- clearly distinct timestamp so the write is a real modification.
select throws_ok(
  $$update public.profiles
    set verified_at = now() + interval '1 day'
    where id = '50000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'talent cannot self-verify'
);
select throws_ok(
  $$update public.profiles
    set verified_categories = array['dancer']
    where id = '50000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'talent cannot self-assign verified categories'
);

reset role;
select * from finish();
rollback;
