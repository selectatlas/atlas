-- Job search + facets (migration 023): generated FTS document and the
-- per-category open-job counts helper.
begin;
select plan(5);

select has_column('public', 'jobs', 'search_tsv', 'jobs.search_tsv exists');
select has_function('public', 'open_job_category_counts', '{}'::name[], 'open_job_category_counts exists');

insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-0000-0000-000000000001', 'hirer@example.test', '{"account_type":"hirer","full_name":"Hirer"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.jobs (hirer_id, title, description, category, location, status)
    values ('10000000-0000-0000-0000-000000000001', 'Ballet dancers needed',
            'Contemporary ballet production in the West End', 'dancer', 'London', 'open')$$,
  'job insert populates the generated search document'
);
select results_eq(
  $$select count(*)::bigint from public.jobs
    where search_tsv @@ websearch_to_tsquery('english', 'dancer ballet')$$,
  array[1::bigint],
  'stemmed full-text search matches the job'
);
select results_eq(
  $$select job_count from public.open_job_category_counts() where category = 'dancer'$$,
  array[1::bigint],
  'category counts reflect open jobs'
);

select * from finish();
rollback;
