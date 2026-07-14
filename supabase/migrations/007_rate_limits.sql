-- Production-compatible rate limiting and AI quota storage.
-- Counters live in Postgres so limits hold across serverless instances;
-- only the service role may read or consume them.

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
-- No policies: anon/authenticated clients cannot touch counters.
revoke all on public.rate_limits from anon, authenticated;

-- Atomically consume one unit from a fixed window. Returns whether the call
-- is allowed plus the seconds remaining until the window resets.
create or replace function public.consume_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start)
    do update set count = rl.count + 1
  returning rl.count into v_count;

  -- Opportunistic cleanup so the table does not grow without bound.
  delete from public.rate_limits
  where key = p_key and window_start < now() - interval '2 days';

  return query select
    v_count <= p_max,
    greatest(1, ceil(extract(epoch from v_window_start + make_interval(secs => p_window_seconds) - now()))::integer);
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
