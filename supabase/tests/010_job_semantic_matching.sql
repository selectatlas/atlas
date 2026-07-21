-- Semantic job matching (migration 025): match RPCs, the For You stack's
-- pass/application exclusions, and job_alerts ownership RLS.
begin;
select plan(11);

select has_table('public', 'job_alerts', 'job_alerts table exists');
select has_function('public', 'match_jobs_filtered', 'match_jobs_filtered exists');
select has_function('public', 'match_jobs_for_talent', '{integer}'::name[], 'match_jobs_for_talent exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'hirer@example.test', '{"account_type":"hirer","full_name":"Hirer"}'),
  ('20000000-0000-0000-0000-000000000002', 'talent@example.test', '{"account_type":"talent","full_name":"Talent"}'),
  ('30000000-0000-0000-0000-000000000003', 'other-talent@example.test', '{"account_type":"talent","full_name":"Other"}');

-- Jobs are inserted by the hirer under RLS; embeddings are service-managed,
-- so those rows are seeded as the table owner before switching role.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$insert into public.jobs (id, hirer_id, title, description, category, location, status)
    values ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
            'Ballet dancers needed', 'Contemporary ballet production', 'dancer', 'London', 'open'),
           ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
            'Passed job', 'Already passed on', 'dancer', 'London', 'open')$$,
  'hirer can insert open jobs'
);

reset role;
insert into public.job_embeddings (job_id, embedding)
select id, ('[' || array_to_string(array_fill(0.1::float, array[1536]), ',') || ']')::extensions.vector(1536)
from public.jobs;
insert into public.profile_embeddings (profile_id, embedding, source_text)
values ('20000000-0000-0000-0000-000000000002',
        ('[' || array_to_string(array_fill(0.1::float, array[1536]), ',') || ']')::extensions.vector(1536),
        'test profile embedding source');
insert into public.job_passes (talent_id, job_id)
values ('20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000005');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$select job_id from public.match_jobs_for_talent(10)$$,
  array['40000000-0000-0000-0000-000000000004'::uuid],
  'for-talent stack matches on the profile embedding and excludes passed jobs'
);
select results_eq(
  $$select (similarity > 0.99) from public.match_jobs_for_talent(10)$$,
  array[true],
  'identical embeddings produce ~1.0 similarity'
);
select lives_ok(
  $$insert into public.job_alerts (talent_id, name, query, filters)
    values ('20000000-0000-0000-0000-000000000002', 'Ballet alerts', 'ballet', '{"work":"in_person"}')$$,
  'talent can save a job alert'
);
select throws_ok(
  $$insert into public.job_alerts (talent_id, name, query)
    values ('30000000-0000-0000-0000-000000000003', 'Not mine', 'x')$$,
  '42501',
  null,
  'talent cannot create an alert for another user'
);
select results_eq(
  $$select count(*)::bigint from public.job_alerts$$,
  array[1::bigint],
  'talent sees their own alert'
);
select throws_ok(
  $$select * from public.match_jobs_filtered(
      ('[' || array_to_string(array_fill(0.1::float, array[1536]), ',') || ']')::extensions.vector(1536))$$,
  '42501',
  null,
  'match_jobs_filtered is service-role only'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select is_empty(
  $$select * from public.job_alerts$$,
  'another user cannot see the alert'
);

select * from finish();
rollback;
