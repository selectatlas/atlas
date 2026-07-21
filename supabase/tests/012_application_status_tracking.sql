begin;
select plan(10);

-- Migration 027: talent-side application status tracking.
select has_column('public', 'applications', 'status_changed_at', 'status_changed_at column exists');
select has_column('public', 'applications', 'talent_seen_status', 'talent_seen_status column exists');
select has_function('public', 'mark_application_statuses_seen', '{}'::text[], 'seen-acknowledgement RPC exists');
select has_trigger('public', 'applications', 'applications_status_change_stamp', 'status change stamp trigger exists');

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
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'sent');

-- ------------------------------------------------------------
-- Trigger stamps status_changed_at only on real transitions.
-- ------------------------------------------------------------
select is(
  (select status_changed_at from public.applications where id = 'cccccccc-0000-0000-0000-000000000001'),
  null,
  'fresh applications have no status_changed_at'
);

update public.applications set note = 'hello'
 where id = 'cccccccc-0000-0000-0000-000000000001';
select is(
  (select status_changed_at from public.applications where id = 'cccccccc-0000-0000-0000-000000000001'),
  null,
  'non-status updates do not stamp status_changed_at'
);

update public.applications set status = 'shortlisted'
 where id = 'cccccccc-0000-0000-0000-000000000001';
select isnt(
  (select status_changed_at from public.applications where id = 'cccccccc-0000-0000-0000-000000000001'),
  null,
  'status transitions stamp status_changed_at'
);

-- ------------------------------------------------------------
-- mark_application_statuses_seen: caller-scoped acknowledgement.
-- ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select public.mark_application_statuses_seen();

select is(
  (select talent_seen_status from public.applications where id = 'cccccccc-0000-0000-0000-000000000001'),
  'shortlisted',
  'caller''s applications are acknowledged at the current status'
);
select is(
  (select talent_seen_status from public.applications where id = 'cccccccc-0000-0000-0000-000000000002'),
  null,
  'other talents'' applications are untouched'
);
select is(
  (select status from public.applications where id = 'cccccccc-0000-0000-0000-000000000001'),
  'shortlisted',
  'acknowledgement never changes status itself'
);

select * from finish();
rollback;
