begin;
select plan(10);

-- Schema
select has_table('public', 'saved_searches', 'saved_searches table exists');
select has_column('public', 'saved_searches', 'last_viewed_at', 'saved_searches.last_viewed_at exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('60000000-0000-0000-0000-000000000001', 'saved-hirer@example.test', '{"account_type":"hirer","full_name":"Saved Hirer"}'),
  ('60000000-0000-0000-0000-000000000002', 'other-hirer@example.test', '{"account_type":"hirer","full_name":"Other Hirer"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);

-- Owner can create a saved search for themselves
select lives_ok(
  $$insert into public.saved_searches (id, hirer_id, name, query, filters)
    values ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
            'Bollywood dancers', 'Bollywood dancers in London', '{"category":"dancer"}'::jsonb)$$,
  'hirer can insert their own saved search'
);

-- Owner cannot create a saved search owned by someone else
select throws_ok(
  $$insert into public.saved_searches (hirer_id, name)
    values ('60000000-0000-0000-0000-000000000002', 'Spoofed search')$$,
  '42501',
  null,
  'hirer cannot insert a saved search for another user'
);

-- Owner sees their row
select results_eq(
  $$select count(*)::bigint from public.saved_searches$$,
  array[1::bigint],
  'owner can read their saved searches'
);

-- Owner can touch last_viewed_at (marks alerts as seen)
select lives_ok(
  $$update public.saved_searches set last_viewed_at = now()
    where id = '61000000-0000-0000-0000-000000000001'$$,
  'owner can update their saved search'
);

-- Another authenticated user sees nothing and cannot mutate
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);

select is_empty(
  $$select id from public.saved_searches$$,
  'other users cannot read saved searches they do not own'
);
select is_empty(
  $$update public.saved_searches set name = 'Hijacked'
    where id = '61000000-0000-0000-0000-000000000001'
    returning id$$,
  'other users cannot update saved searches they do not own'
);
select is_empty(
  $$delete from public.saved_searches
    where id = '61000000-0000-0000-0000-000000000001'
    returning id$$,
  'other users cannot delete saved searches they do not own'
);

-- Owner can delete their own row
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$delete from public.saved_searches
    where id = '61000000-0000-0000-0000-000000000001'
    returning 1$$,
  array[1],
  'owner can delete their saved search'
);

reset role;
select * from finish();
rollback;
