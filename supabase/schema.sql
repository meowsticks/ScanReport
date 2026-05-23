-- AK ScanReport — Supabase setup
-- ===================================================================
-- Run this once in your Supabase dashboard:
--   SQL Editor  ->  New query  ->  paste all of this  ->  Run.
-- It is safe to re-run; every step is idempotent.
-- ===================================================================

-- 1) Reports table -------------------------------------------------
-- One row per saved report, owned by the signed-in user. The whole
-- report document lives in `data` (JSON); photos are NOT stored here
-- (they go in Storage, see step 4) so this row stays small and fast.
create table if not exists public.reports (
  id         uuid        primary key default gen_random_uuid(),
  owner      uuid        not null references auth.users (id) on delete cascade,
  name       text        not null default 'Untitled report',
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_owner_idx on public.reports (owner);

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- 2) Row-Level Security: each user sees only their own reports ------
alter table public.reports enable row level security;

drop policy if exists "Owners manage their reports" on public.reports;
create policy "Owners manage their reports"
  on public.reports for all
  to authenticated
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- 3) Realtime: broadcast changes so other devices update live ------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
end $$;

-- 4) Storage bucket for scan photos --------------------------------
-- Files are stored under a per-user folder: <user-id>/<report-id>/<file>.
-- The bucket is public-read for now (simplest; URLs are unguessable).
-- We can switch to private + signed URLs later if you want stricter privacy.
insert into storage.buckets (id, name, public)
values ('scan-photos', 'scan-photos', true)
on conflict (id) do update set public = excluded.public;

-- Only the owner may write/replace/delete files in their own folder.
drop policy if exists "Owners upload scan photos" on storage.objects;
create policy "Owners upload scan photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners update scan photos" on storage.objects;
create policy "Owners update scan photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners delete scan photos" on storage.objects;
create policy "Owners delete scan photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read is implied by the bucket being public. Done.
