begin;
select plan(5);

-- Migration 028: talent membership tiers.
select has_column('public', 'profiles', 'membership_tier', 'membership_tier column exists');

insert into auth.users (id, email, raw_user_meta_data)
values ('20000000-0000-0000-0000-000000000002', 'talent@example.test', '{"account_type":"talent","full_name":"Talent"}');

select is(
  (select membership_tier from public.profiles where id = '20000000-0000-0000-0000-000000000002'),
  'free',
  'profiles default to the free tier'
);

select lives_ok(
  $$update public.profiles set membership_tier = 'platinum'
     where id = '20000000-0000-0000-0000-000000000002'$$,
  'valid tiers are accepted'
);
select throws_ok(
  $$update public.profiles set membership_tier = 'diamond'
     where id = '20000000-0000-0000-0000-000000000002'$$,
  '23514',
  null,
  'unknown tiers violate the check constraint'
);

-- Column grant: authenticated can read the tier through the allowlist.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select membership_tier from public.profiles
     where id = '20000000-0000-0000-0000-000000000002'$$,
  'authenticated users can select membership_tier'
);

select * from finish();
rollback;
