-- Public job browsing (migration 026): anon reads only the open marketplace,
-- profiles stay closed to anon, and public_open_jobs is the one window onto
-- hirer display fields. Authenticated reads are unchanged (regression guard).
begin;
select plan(13);

select has_view('public', 'public_open_jobs', 'public_open_jobs view exists');
select policies_are(
  'public', 'jobs',
  array['jobs_select_authenticated', 'jobs_select_anon_open', 'jobs_manage_own'],
  'jobs policies are exactly the expected set'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'hirer@example.test', '{"account_type":"hirer","full_name":"Hirer"}'),
  ('20000000-0000-0000-0000-000000000002', 'talent@example.test', '{"account_type":"talent","full_name":"Talent"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.jobs (id, hirer_id, title, description, category, location, status)
    values
      ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
       'Open role', 'Visible to everyone', 'dancer', 'London', 'open'),
      ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
       'Closed role', 'Hirer-only history', 'actor', 'Leeds', 'closed')$$,
  'hirer can insert open and closed jobs'
);

-- Moderation takedown is an admin/service concern; set it outside RLS.
reset role;
insert into public.jobs (id, hirer_id, title, description, category, location, status, removed_at)
values ('60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001',
        'Removed role', 'Moderation takedown', 'dancer', 'Bristol', 'open', now());

set local role anon;
-- Clear the hirer JWT set earlier: a real anon request carries no claims,
-- and a leftover sub would satisfy jobs_manage_own for the hirer's rows.
select set_config('request.jwt.claim.sub', '', true);

select results_eq(
  $$select count(*)::bigint from public.jobs$$,
  array[1::bigint],
  'anon sees only the open, non-removed job'
);
select is_empty(
  $$select id from public.jobs where id = '50000000-0000-0000-0000-000000000005'$$,
  'anon cannot read the closed job'
);
select is_empty(
  $$select id from public.jobs where id = '60000000-0000-0000-0000-000000000006'$$,
  'anon cannot read the moderation-removed job'
);
select throws_ok(
  $$select full_name from public.profiles$$,
  '42501',
  null,
  'anon still cannot read profiles directly'
);
select throws_ok(
  $$select embedding_status from public.jobs$$,
  '42501',
  null,
  'anon cannot read embedding internals off the jobs table (column grants)'
);
select results_eq(
  $$select hirer_name from public.public_open_jobs where id = '40000000-0000-0000-0000-000000000004'$$,
  array['Hirer'::text],
  'anon gets the hirer display name through the view'
);
select is_empty(
  $$select id from public.public_open_jobs
    where id in ('50000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000006')$$,
  'closed and removed jobs are invisible through the view'
);
select results_eq(
  $$select * from public.open_job_locations()$$,
  array['London'::text],
  'anon locations facet reflects only the open job'
);
select results_eq(
  $$select category, job_count from public.open_job_category_counts()$$,
  $$values ('dancer'::text, 1::bigint)$$,
  'anon category counts reflect only the open job'
);

-- Regression guard: authenticated users (hirer dashboards) keep full read.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select count(*)::bigint from public.jobs where id = '50000000-0000-0000-0000-000000000005'$$,
  array[1::bigint],
  'authenticated hirer still sees the closed job'
);

select * from finish();
rollback;
