-- Talent application confidence flow: structured job context and an optional application note.
alter table public.jobs
  add column if not exists work_type text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists application_deadline date,
  add column if not exists duration text,
  add column if not exists usage_rights text,
  add column if not exists travel_required boolean default false;

alter table public.applications
  add column if not exists note text;
