begin;
select plan(3);

select has_function(
  'public', 'search_talent_filtered',
  array['jsonb', 'integer', 'integer', 'text'],
  'browse search function exists'
);
select has_function(
  'public', 'match_talent_filtered',
  array['extensions.vector', 'jsonb', 'integer'],
  'semantic match function exists'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('20000000-0000-0000-0000-000000000002', 'older-verified@example.test', '{"account_type":"talent","full_name":"Older Verified"}'),
  ('30000000-0000-0000-0000-000000000003', 'newer-unverified@example.test', '{"account_type":"talent","full_name":"Newer Unverified"}');

-- The verified talent joined FIRST; without the boost, newest-first ordering
-- would put the unverified talent ahead.
update public.profiles set created_at = now() - interval '2 days', verified_at = now()
 where id = '20000000-0000-0000-0000-000000000002';
update public.profiles set created_at = now() - interval '1 day'
 where id = '30000000-0000-0000-0000-000000000003';

select results_eq(
  $$select profile_id from public.search_talent_filtered('{}'::jsonb, 10, 0, 'newest')$$,
  array[
    '20000000-0000-0000-0000-000000000002'::uuid,
    '30000000-0000-0000-0000-000000000003'::uuid
  ],
  'verified talent rank ahead of newer unverified talent'
);

select * from finish();
rollback;
