begin;
select plan(16);

select has_function('public', 'create_or_get_thread', array['uuid'], 'thread RPC exists');
select has_function('public', 'is_thread_participant', array['uuid'], 'RLS helper exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'hirer@example.test', '{"account_type":"hirer","full_name":"Hirer"}'),
  ('20000000-0000-0000-0000-000000000002', 'talent@example.test', '{"account_type":"talent","full_name":"Talent"}'),
  ('30000000-0000-0000-0000-000000000003', 'outsider@example.test', '{"account_type":"talent","full_name":"Outsider"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.create_or_get_thread('20000000-0000-0000-0000-000000000002')$$,
  'hirer can create a thread with talent'
);
select results_eq(
  $$select count(*)::bigint from public.thread_participants$$,
  array[2::bigint],
  'hirer can see both participants in their thread'
);
select results_eq(
  $$select public.create_or_get_thread('20000000-0000-0000-0000-000000000002') = public.create_or_get_thread('20000000-0000-0000-0000-000000000002')$$,
  array[true],
  'thread creation is idempotent'
);
select throws_ok(
  $$insert into public.message_threads default values$$,
  '42501',
  null,
  'direct thread inserts are blocked by RLS'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select count(*)::bigint from public.thread_participants$$,
  array[2::bigint],
  'talent can see both participants in their thread'
);
select lives_ok(
  $$insert into public.messages (thread_id, sender_id, content)
    select thread_id, '20000000-0000-0000-0000-000000000002', 'Hello'
    from public.thread_participants limit 1$$,
  'a participant can send a message'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select is_empty(
  $$select id from public.message_threads$$,
  'an unrelated user cannot see the thread'
);
select is_empty(
  $$select id from public.messages$$,
  'an unrelated user cannot read messages'
);
select throws_ok(
  $$select public.create_or_get_thread('20000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'an unrelated talent user cannot start a thread'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$update public.profiles
    set account_type = 'hirer'
    where id = '20000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'talent cannot promote their own account role'
);
select throws_ok(
  $$select public.create_or_get_thread('10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'talent cannot start a new thread'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'email', 'select'),
  'authenticated callers cannot select profile email'
);

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'select'),
  'authenticated callers can select public profile fields'
);

select throws_ok(
  $$select email from public.profiles where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'direct profile email queries are rejected'
);

reset role;
select * from finish();
rollback;
