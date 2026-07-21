-- Public talent browsing (migration 031): anon reads only the reduced
-- marketplace projection of public, onboarded, non-suspended talent.
-- Profiles and talent_skills stay closed to anon (regression guards).
begin;
select plan(9);

select has_view('public', 'public_talent_profiles', 'public_talent_profiles view exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'hirer@example.test', '{"account_type":"hirer","full_name":"Hirer"}'),
  ('20000000-0000-0000-0000-000000000002', 'visible@example.test', '{"account_type":"talent","full_name":"Visible Talent"}'),
  ('30000000-0000-0000-0000-000000000003', 'private@example.test', '{"account_type":"talent","full_name":"Private Talent"}'),
  ('40000000-0000-0000-0000-000000000004', 'suspended@example.test', '{"account_type":"talent","full_name":"Suspended Talent"}'),
  ('50000000-0000-0000-0000-000000000005', 'unboarded@example.test', '{"account_type":"talent","full_name":"No Skills Yet"}');

-- Profile shaping is a service concern (visibility, suspension, headline);
-- do it outside RLS like the moderation setup in 011.
update public.profiles set headline = 'Contemporary dancer', city = 'London'
  where id = '20000000-0000-0000-0000-000000000002';
update public.profiles set headline = 'Hidden profile', profile_visibility = 'private'
  where id = '30000000-0000-0000-0000-000000000003';
update public.profiles set headline = 'Was public', suspended_at = now()
  where id = '40000000-0000-0000-0000-000000000004';
-- 5th talent keeps no headline and no skills: not onboarded, not listed.

insert into public.talent_skills (profile_id, category, skill, proficiency)
values
  ('20000000-0000-0000-0000-000000000002', 'dancer', 'Contemporary', 'expert'),
  ('20000000-0000-0000-0000-000000000002', 'dancer', 'Ballet', 'advanced'),
  ('30000000-0000-0000-0000-000000000003', 'dancer', 'Hip Hop', 'expert'),
  ('40000000-0000-0000-0000-000000000004', 'actor', 'Screen acting', 'expert');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select results_eq(
  $$select count(*)::bigint from public.public_talent_profiles$$,
  array[1::bigint],
  'anon sees only the public, onboarded, non-suspended talent'
);
select results_eq(
  $$select full_name from public.public_talent_profiles$$,
  array['Visible Talent'::text],
  'the visible row is the public talent profile'
);
select results_eq(
  $$select skills from public.public_talent_profiles
    where id = '20000000-0000-0000-0000-000000000002'$$,
  $$values (array['Ballet', 'Contemporary']::text[])$$,
  'skills are aggregated onto the marketplace row'
);
select results_eq(
  $$select id from public.public_talent_profiles
    where search_text like '%contemporary%'$$,
  array['20000000-0000-0000-0000-000000000002'::uuid],
  'search_text covers name, headline, and skills'
);
select throws_ok(
  $$select full_name from public.profiles$$,
  '42501',
  null,
  'anon still cannot read profiles directly'
);
select throws_ok(
  $$select skill from public.talent_skills$$,
  '42501',
  null,
  'anon still cannot read talent_skills directly'
);
select is_empty(
  $$select id from public.public_talent_profiles
    where id in ('30000000-0000-0000-0000-000000000003',
                 '40000000-0000-0000-0000-000000000004',
                 '50000000-0000-0000-0000-000000000005')$$,
  'private, suspended, and un-onboarded talent are invisible'
);

-- Signed-in hirers browse the same public page with the same projection.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select count(*)::bigint from public.public_talent_profiles$$,
  array[1::bigint],
  'authenticated callers read the view too'
);

select * from finish();
rollback;
