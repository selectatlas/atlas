begin;
select plan(11);

select has_column('public', 'messages', 'kind', 'messages have a kind column');
select col_default_is('public', 'messages', 'kind', 'text', 'message kind defaults to text');
select has_function('public', 'create_or_get_thread_for_application', array['uuid'], 'application thread RPC exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'hirer@example.test', '{"account_type":"hirer","full_name":"Hirer"}'),
  ('20000000-0000-0000-0000-000000000002', 'talent@example.test', '{"account_type":"talent","full_name":"Talent"}'),
  ('30000000-0000-0000-0000-000000000003', 'talent2@example.test', '{"account_type":"talent","full_name":"Talent Two"}');

insert into public.jobs (id, hirer_id, title, description, category, location)
values (
  'bbbbbbbb-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Music video dancer',
  'Dancer needed for a music video shoot',
  'dancer',
  'London'
);

insert into public.applications (id, job_id, talent_id, status)
values (
  'cccccccc-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'sent'
);

-- A talent who did not apply cannot open the thread.
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.create_or_get_thread_for_application('cccccccc-0000-0000-0000-000000000001')$$,
  '42501',
  'Only the applicant can open this conversation',
  'a non-applicant cannot open the application thread'
);

-- The applicant can, and the thread records the job as origin.
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.create_or_get_thread_for_application('cccccccc-0000-0000-0000-000000000001')$$,
  'the applicant can open a thread with the job hirer'
);
select results_eq(
  $$select origin_job_id from public.message_threads$$,
  array['bbbbbbbb-0000-0000-0000-000000000001'::uuid],
  'the job is recorded as thread origin'
);
select results_eq(
  $$select count(*)::bigint from public.message_threads
     where id = public.create_or_get_thread_for_application('cccccccc-0000-0000-0000-000000000001')$$,
  array[1::bigint],
  'repeat calls reuse the same thread'
);

-- The applicant (a participant) can emit a system message.
select lives_ok(
  $$insert into public.messages (thread_id, sender_id, content, kind)
    select t.id, '20000000-0000-0000-0000-000000000002', 'Applied to Music video dancer', 'application_received'
      from public.message_threads t$$,
  'a participant can insert an application_received system message'
);
select results_eq(
  $$select kind from public.messages order by created_at desc limit 1$$,
  array['application_received'::text],
  'the system message kind persists'
);

-- Plain sends keep the text default.
select lives_ok(
  $$insert into public.messages (thread_id, sender_id, content)
    select t.id, '20000000-0000-0000-0000-000000000002', 'Hello there'
      from public.message_threads t$$,
  'messages without an explicit kind still insert'
);

-- Unknown kinds are rejected by the check constraint.
select throws_ok(
  $$insert into public.messages (thread_id, sender_id, content, kind)
    select t.id, '20000000-0000-0000-0000-000000000002', 'Nope', 'payment_released'
      from public.message_threads t$$,
  '23514',
  null,
  'an unknown message kind violates the check constraint'
);

reset role;
select * from finish();
rollback;
