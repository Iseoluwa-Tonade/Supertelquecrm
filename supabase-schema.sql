-- SuperTelque CRM - additive schema for Documents, expanded roles, per-teammate
-- view assignment, HR profile fields, the admin pricing calculator's service
-- catalog, and the sales document link on board items.
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
-- If uploads fail with "Bucket not found", this step didn't run yet (or ran
-- against a different project) — re-run this script, or create a private
-- bucket named "crm-documents" by hand in Supabase → Storage.

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

-- 4. Per-teammate view assignment + HR profile fields ---------------------

alter table public.profiles add column if not exists allowed_views text[];
alter table public.profiles add column if not exists phone text default '';
alter table public.profiles add column if not exists department text default '';
alter table public.profiles add column if not exists job_title text default '';
alter table public.profiles add column if not exists start_date date;
alter table public.profiles add column if not exists employee_id text default '';
alter table public.profiles add column if not exists emergency_contact_name text default '';
alter table public.profiles add column if not exists emergency_contact_phone text default '';
alter table public.profiles add column if not exists address text default '';

-- Managers and admins can view and update every teammate's profile (Team page).
-- Everyone can also always read/update their own row (also covers the HR
-- "My Profile" self-service form) — see the trigger below for why that's safe.
drop policy if exists "profiles_admin_select_all" on public.profiles;
drop policy if exists "profiles_manager_select_all" on public.profiles;
create policy "profiles_manager_select_all"
  on public.profiles for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role in ('admin', 'manager')
    )
  );

drop policy if exists "profiles_admin_update_all" on public.profiles;
drop policy if exists "profiles_manager_update_all" on public.profiles;
create policy "profiles_manager_update_all"
  on public.profiles for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role in ('admin', 'manager')
    )
  );

-- Security: the update policy above lets a user update their OWN row (needed
-- for self-service HR editing), which would otherwise let anyone grant
-- themselves admin by editing their own `role`/`status`/`allowed_views` via a
-- raw API call. This trigger blocks that: when you're updating your own row
-- and you are not already an admin, role/status/allowed_views are silently
-- reset to their previous value no matter what the request asked for.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_role text;
begin
  if new.user_id = auth.uid() then
    select role into acting_role from public.profiles where user_id = auth.uid();
    if acting_role is distinct from 'admin' then
      new.role := old.role;
      new.status := old.status;
      new.allowed_views := old.allowed_views;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_escalation on public.profiles;
create trigger trg_prevent_self_role_escalation
before update on public.profiles
for each row
execute function public.prevent_self_role_escalation();

-- 5. Service catalog for the admin pricing calculator ---------------------

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

-- 6. Sales document link on deals/projects ---------------------------------

alter table public.crm_board_items add column if not exists document_url text default '';

-- 7. Realtime for the new tables (optional, matches the existing tables) --
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
