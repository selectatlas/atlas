begin;
select plan(13);

select has_column('public', 'message_threads', 'origin_outreach_id', 'threads have an origin outreach column');
select has_column('public', 'message_threads', 'origin_job_id', 'threads have an origin job column');
select has_column('public', 'thread_participants', 'archived_at', 'participants have an archive column');
select has_function('public', 'create_or_get_thread_with_origin', array['uuid', 'uuid', 'uuid'], 'origin-aware thread RPC exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'hirer@example.test', '{"account_type":"hirer","full_name":"Hirer"}'),
  ('20000000-0000-0000-0000-000000000002', 'talent@example.test', '{"account_type":"talent","full_name":"Talent"}'),
  ('40000000-0000-0000-0000-000000000004', 'hirer2@example.test', '{"account_type":"hirer","full_name":"Hirer Two"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

insert into public.outreach (id, hirer_id, talent_id, message, status)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'Hello from outreach',
  'sent'
);
insert into public.jobs (id, hirer_id, title, description, category, location)
values (
  'bbbbbbbb-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Music video dancer',
  'Dancer needed for a music video shoot',
  'dancer',
  'London'
);

select lives_ok(
  $$select public.create_or_get_thread_with_origin(
      '20000000-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000001')$$,
  'hirer can create a thread with origin context'
);
select results_eq(
  $$select origin_outreach_id from public.message_threads$$,
  array['aaaaaaaa-0000-0000-0000-000000000001'::uuid],
  'origin outreach is recorded on the thread'
);
select results_eq(
  $$select origin_job_id from public.message_threads$$,
  array['bbbbbbbb-0000-0000-0000-000000000001'::uuid],
  'origin job is recorded on the thread'
);

insert into public.outreach (id, hirer_id, talent_id, message, status)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'Follow-up outreach',
  'sent'
);
select results_eq(
  $$select t.origin_outreach_id from public.message_threads t
     where t.id = public.create_or_get_thread_with_origin(
       '20000000-0000-0000-0000-000000000002',
       'aaaaaaaa-0000-0000-0000-000000000002',
       null)$$,
  array['aaaaaaaa-0000-0000-0000-000000000001'::uuid],
  'repeat calls reuse the thread and never overwrite origin'
);

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
select lives_ok(
  $$select public.create_or_get_thread_with_origin(
      '20000000-0000-0000-0000-000000000002',
      'aaaaaaaa-0000-0000-0000-000000000001',
      'bbbbbbbb-0000-0000-0000-000000000001')$$,
  'a second hirer can open a thread while citing foreign origins'
);
select results_eq(
  $$select (origin_outreach_id is null and origin_job_id is null)
      from public.message_threads
     where id = public.create_or_get_thread('20000000-0000-0000-0000-000000000002')$$,
  array[true],
  'an outreach or job owned by someone else is not attached as origin'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$update public.thread_participants
      set archived_at = now()
    where profile_id = '20000000-0000-0000-0000-000000000002'$$,
  'a participant can archive their own side of a thread'
);
select results_eq(
  $$select count(*)::bigint from public.thread_participants
     where profile_id = '20000000-0000-0000-0000-000000000002'
       and archived_at is not null$$,
  array[2::bigint],
  'archive state persists on the participant rows'
);

update public.thread_participants
   set archived_at = now()
 where profile_id = '10000000-0000-0000-0000-000000000001';
select results_eq(
  $$select count(*)::bigint from public.thread_participants
     where profile_id = '10000000-0000-0000-0000-000000000001'
       and archived_at is not null$$,
  array[0::bigint],
  'a participant cannot archive the other side of a thread'
);

reset role;
select * from finish();
rollback;
