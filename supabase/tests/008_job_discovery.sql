-- Job discovery at scale (migration 021): structured budget bounds,
-- job_passes ownership RLS, and the open_job_locations helper.
begin;
select plan(10);

select has_column('public', 'jobs', 'budget_min', 'jobs.budget_min exists');
select has_column('public', 'jobs', 'budget_max', 'jobs.budget_max exists');
select has_table('public', 'job_passes', 'job_passes table exists');
select has_function('public', 'open_job_locations', '{}'::name[], 'open_job_locations helper exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'hirer@example.test', '{"account_type":"hirer","full_name":"Hirer"}'),
  ('20000000-0000-0000-0000-000000000002', 'talent@example.test', '{"account_type":"talent","full_name":"Talent"}'),
  ('30000000-0000-0000-0000-000000000003', 'other-talent@example.test', '{"account_type":"talent","full_name":"Other Talent"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.jobs (id, hirer_id, title, description, category, location, status, budget, budget_min, budget_max)
    values ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
            'Test role', 'A role for the discovery tests', 'dancer', 'London', 'open', '£300 per day', 300, 300)$$,
  'hirer can insert an open job with budget bounds'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$insert into public.job_passes (talent_id, job_id)
    values ('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004')$$,
  'talent can record a pass on a job'
);
select throws_ok(
  $$insert into public.job_passes (talent_id, job_id)
    values ('30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004')$$,
  '42501',
  null,
  'talent cannot record a pass for another user'
);
select results_eq(
  $$select count(*)::bigint from public.job_passes$$,
  array[1::bigint],
  'talent sees their own pass'
);
select results_eq(
  $$select * from public.open_job_locations()$$,
  array['London'::text],
  'locations helper returns open job locations'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select is_empty(
  $$select * from public.job_passes$$,
  'another user cannot see the pass'
);

select * from finish();
rollback;
