begin;
select plan(12);

select has_table('public', 'message_reactions', 'message_reactions table exists');
select has_column('public', 'messages', 'reply_to_id', 'messages.reply_to_id exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'hirer@example.test', '{"account_type":"hirer","full_name":"Hirer"}'),
  ('20000000-0000-0000-0000-000000000002', 'talent@example.test', '{"account_type":"talent","full_name":"Talent"}'),
  ('30000000-0000-0000-0000-000000000003', 'outsider@example.test', '{"account_type":"talent","full_name":"Outsider"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

-- Create the thread in its own statement first: rows inserted by the RPC
-- inside the same INSERT statement are not visible to the messages RLS
-- with-check subquery (statement snapshot), which made the seed fail.
select public.create_or_get_thread('20000000-0000-0000-0000-000000000002');
select lives_ok(
  $$insert into public.messages (id, thread_id, sender_id, content)
    select '99000000-0000-0000-0000-000000000001',
           public.create_or_get_thread('20000000-0000-0000-0000-000000000002'),
           '10000000-0000-0000-0000-000000000001', 'Hello'$$,
  'hirer can seed a message in a fresh thread'
);

select lives_ok(
  $$insert into public.messages (thread_id, sender_id, content, reply_to_id)
    select thread_id, '10000000-0000-0000-0000-000000000001', 'Replying to myself',
           '99000000-0000-0000-0000-000000000001'
    from public.thread_participants limit 1$$,
  'a participant can send a reply-to message'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$insert into public.message_reactions (message_id, profile_id, emoji)
    values ('99000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '👍')$$,
  'a participant can react to a message'
);

select throws_ok(
  $$insert into public.message_reactions (message_id, profile_id, emoji)
    values ('99000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '👍')$$,
  '42501',
  null,
  'a participant cannot react as someone else'
);

select throws_ok(
  $$update public.message_reactions set emoji = '🔥'
    where message_id = '99000000-0000-0000-0000-000000000001'
      and profile_id = '20000000-0000-0000-0000-000000000002'$$,
  '23514',
  null,
  'emoji outside the allowed set is rejected'
);

select lives_ok(
  $$update public.message_reactions set emoji = '❤️'
    where message_id = '99000000-0000-0000-0000-000000000001'
      and profile_id = '20000000-0000-0000-0000-000000000002'$$,
  'a participant can change their own reaction'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select count(*)::bigint from public.message_reactions$$,
  array[1::bigint],
  'the other participant can see the reaction'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select is_empty(
  $$select emoji from public.message_reactions$$,
  'an unrelated user cannot see reactions'
);
select throws_ok(
  $$insert into public.message_reactions (message_id, profile_id, emoji)
    values ('99000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '👍')$$,
  '42501',
  null,
  'a non-participant cannot react'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$delete from public.message_reactions
    where message_id = '99000000-0000-0000-0000-000000000001'
      and profile_id = '20000000-0000-0000-0000-000000000002'$$,
  'a participant can remove their own reaction'
);

reset role;
select * from finish();
rollback;
