begin;
select plan(18);

select has_function('public', 'mark_application_replied', array['uuid'], 'talent reply RPC exists');
select has_function('public', 'is_caller_suspended', '{}'::text[], 'suspension check function exists');

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
values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'sent'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'shortlisted');

insert into public.outreach (id, hirer_id, talent_id, message, status)
values (
  'dddddddd-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'We would love to work with you',
  'sent'
);

-- ------------------------------------------------------------
-- Constraint: 'declined' is a valid application status; junk is not.
-- ------------------------------------------------------------
select lives_ok(
  $$update public.applications set status = 'declined'
     where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  'applications accept the declined status'
);
select throws_ok(
  $$update public.applications set status = 'ghosted'
     where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  '23514',
  null,
  'unknown application statuses violate the check constraint'
);
-- Restore for the no-regress test below.
update public.applications set status = 'shortlisted'
 where id = 'cccccccc-0000-0000-0000-000000000002';

-- ------------------------------------------------------------
-- New message kinds pass the messages_kind_check constraint.
-- ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select public.create_or_get_thread_for_application('cccccccc-0000-0000-0000-000000000001');

select lives_ok(
  $$insert into public.messages (thread_id, sender_id, content, kind)
    select t.id, '20000000-0000-0000-0000-000000000002', 'Not selected', 'application_declined'
      from public.message_threads t limit 1$$,
  'application_declined is an accepted message kind'
);
select lives_ok(
  $$insert into public.messages (thread_id, sender_id, content, kind)
    select t.id, '20000000-0000-0000-0000-000000000002', 'Review published', 'review_published'
      from public.message_threads t limit 1$$,
  'review_published is an accepted message kind'
);
select lives_ok(
  $$insert into public.messages (thread_id, sender_id, content, kind)
    select t.id, '20000000-0000-0000-0000-000000000002', 'Role closed', 'job_closed'
      from public.message_threads t limit 1$$,
  'job_closed is an accepted message kind'
);

-- ------------------------------------------------------------
-- mark_application_replied guards
-- ------------------------------------------------------------
-- A different talent calling the RPC must not touch the applicant's row,
-- and their own non-pre-reply application must never regress.
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select public.mark_application_replied('bbbbbbbb-0000-0000-0000-000000000001');
select results_eq(
  $$select status from public.applications where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  array['sent'::text],
  'the RPC never advances another talent''s application'
);
select results_eq(
  $$select status from public.applications where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  array['shortlisted'::text],
  'the RPC never regresses a shortlisted application'
);

-- The applicant advances their own application, idempotently.
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select public.mark_application_replied('bbbbbbbb-0000-0000-0000-000000000001');
select results_eq(
  $$select status from public.applications where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  array['responded'::text],
  'the applicant''s reply advances sent to responded'
);
select public.mark_application_replied('bbbbbbbb-0000-0000-0000-000000000001');
select results_eq(
  $$select status from public.applications where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  array['responded'::text],
  'repeat calls are idempotent'
);

-- The talent can flip their own outreach to responded under RLS.
select lives_ok(
  $$update public.outreach set status = 'responded'
     where id = 'dddddddd-0000-0000-0000-000000000001'
       and talent_id = '20000000-0000-0000-0000-000000000002'$$,
  'the talent can mark their own outreach responded'
);
select results_eq(
  $$select status from public.outreach where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  array['responded'::text],
  'the outreach status persisted as responded'
);

-- ------------------------------------------------------------
-- is_caller_suspended + column secrecy
-- ------------------------------------------------------------
select results_eq(
  $$select public.is_caller_suspended()$$,
  array[false],
  'an active caller is not suspended'
);
select throws_ok(
  $$select suspended_at from public.profiles limit 1$$,
  '42501',
  null,
  'suspended_at is not selectable with a user session'
);

reset role;
update public.profiles set suspended_at = now()
 where id = '20000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select public.is_caller_suspended()$$,
  array[true],
  'a suspended caller is reported as suspended'
);

-- Anon cannot execute either function.
reset role;
set local role anon;
select throws_ok(
  $$select public.mark_application_replied('bbbbbbbb-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'anon cannot execute mark_application_replied'
);
select throws_ok(
  $$select public.is_caller_suspended()$$,
  '42501',
  null,
  'anon cannot execute is_caller_suspended'
);

reset role;
select * from finish();
rollback;
