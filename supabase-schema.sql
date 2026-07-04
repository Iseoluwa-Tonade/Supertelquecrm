-- SuperTelque CRM - additive schema for Documents, expanded roles, and the
-- admin pricing calculator's service catalog.
-- Run this once in the Supabase SQL editor for your project.
-- It assumes the existing tables (profiles, crm_board_items, crm_daily_activities,
-- crm_change_requests) already exist, as created for the original CRM build.
-- This script only adds what's new. It is written to be safe to re-run
-- (IF NOT EXISTS / OR REPLACE / drop-then-add).

-- 1. Documents table -----------------------------------------------------

create table if not exists public.crm_documents (
  id uuid primary key default gen_random_uuid(),
  board_item_id uuid references public.crm_board_items(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  description text default '',
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.crm_documents enable row level security;

drop policy if exists "documents_select_authenticated" on public.crm_documents;
create policy "documents_select_authenticated"
  on public.crm_documents for select
  to authenticated
  using (true);

drop policy if exists "documents_insert_own" on public.crm_documents;
create policy "documents_insert_own"
  on public.crm_documents for insert
  to authenticated
  with check (uploaded_by = auth.uid());

drop policy if exists "documents_delete_own_or_manager" on public.crm_documents;
create policy "documents_delete_own_or_manager"
  on public.crm_documents for delete
  to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role in ('manager', 'admin')
    )
  );

-- 2. Storage bucket for uploaded files -----------------------------------

insert into storage.buckets (id, name, public)
values ('crm-documents', 'crm-documents', false)
on conflict (id) do nothing;

drop policy if exists "crm_documents_storage_select" on storage.objects;
create policy "crm_documents_storage_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'crm-documents');

drop policy if exists "crm_documents_storage_insert" on storage.objects;
create policy "crm_documents_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'crm-documents');

drop policy if exists "crm_documents_storage_delete" on storage.objects;
create policy "crm_documents_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'crm-documents'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.role in ('manager', 'admin')
      )
    )
  );

-- 3. Expanded roles (admin / manager / owner / viewer) -------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'manager', 'owner', 'viewer'));

alter table public.profiles alter column status set default 'active';

-- Admins can view and update every teammate's profile (needed for the Team page).
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
  on public.profiles for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all"
  on public.profiles for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- 4. Service catalog for the admin pricing calculator ---------------------

create table if not exists public.crm_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_price numeric not null default 0,
  unit_label text not null default 'flat',
  created_at timestamptz not null default now()
);

alter table public.crm_services enable row level security;

-- Admin-only: the catalog and the calculator itself are restricted to admins.
drop policy if exists "services_admin_all" on public.crm_services;
create policy "services_admin_all"
  on public.crm_services for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- 5. Realtime for the new tables (optional, matches the existing tables) --
-- If this errors because a table is already in the publication, that's fine.

do $$
begin
  alter publication supabase_realtime add table public.crm_documents;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.crm_services;
exception when duplicate_object then
  null;
end $$;
