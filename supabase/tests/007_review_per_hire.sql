begin;
select plan(3);

-- Fixtures (as postgres, bypassing RLS): a hirer with one hired
-- application for a talent.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('80000000-0000-0000-0000-000000000001', 'quota-hirer@example.test', '{"account_type":"hirer","full_name":"Quota Hirer"}'),
  ('80000000-0000-0000-0000-000000000002', 'quota-talent@example.test', '{"account_type":"talent","full_name":"Quota Talent"}');

insert into public.jobs (id, hirer_id, title, description, category, location)
values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001',
   'Launch film', 'Three day shoot', 'dancer', 'London'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001',
   'Follow-up campaign', 'Two day shoot', 'dancer', 'London');

insert into public.applications (id, job_id, talent_id, status)
values ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001',
        '80000000-0000-0000-0000-000000000002', 'hired');

set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000001', true);

-- One hire allows exactly one review
select lives_ok(
  $$insert into public.talent_reviews (talent_id, reviewer_id, rating, body)
    values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 5, 'First booking, great work.')$$,
  'first review for a hired talent inserts'
);

-- A second review against the same single hire is blocked (no rating stacking)
select throws_ok(
  $$insert into public.talent_reviews (talent_id, reviewer_id, rating, body)
    values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 5, 'Stacked review.')$$,
  '42501',
  null,
  'second review without a second hire is rejected'
);

-- A repeat hire unlocks one more review
set local role postgres;
insert into public.applications (id, job_id, talent_id, status)
values ('82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002',
        '80000000-0000-0000-0000-000000000002', 'hired');

set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$insert into public.talent_reviews (talent_id, reviewer_id, rating, body)
    values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 5, 'Second booking, rebooked and delivered again.')$$,
  'repeat hire allows a second review'
);

reset role;
select * from finish();
rollback;
