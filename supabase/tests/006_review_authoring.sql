begin;
select plan(11);

-- Schema: authoring columns exist
select has_column('public', 'talent_reviews', 'rating_communication', 'talent_reviews.rating_communication exists');
select has_column('public', 'talent_reviews', 'rating_reliability', 'talent_reviews.rating_reliability exists');
select has_column('public', 'talent_reviews', 'rating_craft', 'talent_reviews.rating_craft exists');
select has_column('public', 'talent_reviews', 'recommend_score', 'talent_reviews.recommend_score exists');

-- Fixtures (as postgres, bypassing RLS): an eligible hirer with a hired
-- application, a second hirer with no hire, and two talent profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('70000000-0000-0000-0000-000000000001', 'review-hirer@example.test', '{"account_type":"hirer","full_name":"Review Hirer"}'),
  ('70000000-0000-0000-0000-000000000002', 'review-other-hirer@example.test', '{"account_type":"hirer","full_name":"Other Hirer"}'),
  ('70000000-0000-0000-0000-000000000003', 'review-talent@example.test', '{"account_type":"talent","full_name":"Hired Talent"}'),
  ('70000000-0000-0000-0000-000000000004', 'review-talent-2@example.test', '{"account_type":"talent","full_name":"Unhired Talent"}');

insert into public.jobs (id, hirer_id, title, description, category, location)
values ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
        'Music video shoot', 'Two day shoot in East London', 'dancer', 'London');

insert into public.applications (id, job_id, talent_id, status)
values ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001',
        '70000000-0000-0000-0000-000000000003', 'hired');

set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);

-- Eligible hirer can publish a review with sub-ratings + private score
select lives_ok(
  $$insert into public.talent_reviews
      (talent_id, reviewer_id, rating, body, rating_communication, rating_reliability, rating_craft, recommend_score)
    values ('70000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001',
            5, 'Brilliant on set, would rebook.', 5, 5, 4, 9)$$,
  'hirer with a hired application can insert a review'
);

-- Same hirer cannot review talent they never hired
select throws_ok(
  $$insert into public.talent_reviews (talent_id, reviewer_id, rating, body)
    values ('70000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000001', 5, 'Never worked together.')$$,
  '42501',
  null,
  'hirer cannot review talent without a hired application'
);

-- Reviewer identity cannot be spoofed
select throws_ok(
  $$insert into public.talent_reviews (talent_id, reviewer_id, rating, body)
    values ('70000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 5, 'Spoofed reviewer.')$$,
  '42501',
  null,
  'hirer cannot insert a review as another reviewer'
);

-- A hirer with no hired application is blocked entirely
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$insert into public.talent_reviews (talent_id, reviewer_id, rating, body)
    values ('70000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 4, 'No hire behind this.')$$,
  '42501',
  null,
  'hirer without a hired application cannot insert a review'
);

-- Public columns stay readable to authenticated users
select results_eq(
  $$select rating_communication::int from public.talent_reviews
    where talent_id = '70000000-0000-0000-0000-000000000003'$$,
  array[5],
  'authenticated users can read public sub-rating columns'
);

-- The private recommend score is not granted to authenticated users
select throws_ok(
  $$select recommend_score from public.talent_reviews$$,
  '42501',
  null,
  'authenticated users cannot read recommend_score'
);

-- Service role keeps full access for seed and admin surfaces
set local role service_role;
select results_eq(
  $$select recommend_score::int from public.talent_reviews
    where talent_id = '70000000-0000-0000-0000-000000000003'$$,
  array[9],
  'service role can read recommend_score'
);

reset role;
select * from finish();
rollback;
