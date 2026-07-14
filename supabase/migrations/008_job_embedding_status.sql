-- Track job embedding state so failed or missing embeddings are visible and
-- retryable instead of silently lost when a serverless worker stops early.

alter table public.jobs
  add column if not exists embedding_status text not null default 'pending'
    check (embedding_status in ('pending', 'complete', 'failed')),
  add column if not exists embedding_error text,
  add column if not exists embedding_attempts integer not null default 0;

-- Existing jobs that already have an embedding are complete.
update public.jobs
set embedding_status = 'complete'
where embedding_status = 'pending'
  and id in (select job_id from public.job_embeddings);

create index if not exists jobs_embedding_status_idx
  on public.jobs(embedding_status)
  where embedding_status <> 'complete';

create or replace function public.increment_job_embedding_attempts(p_job_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.jobs
  set embedding_attempts = embedding_attempts + 1
  where id = p_job_id;
$$;

revoke execute on function public.increment_job_embedding_attempts(uuid) from public, anon, authenticated;
grant execute on function public.increment_job_embedding_attempts(uuid) to service_role;
