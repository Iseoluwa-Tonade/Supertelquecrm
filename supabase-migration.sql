-- SuperTelque CRM – Multi-tenant migration
-- Run this once in the Supabase SQL editor.
-- Safe to re-run (idempotent).

-- 1. Organisations table ---------------------------------------------------
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text default '',
  address text default '',
  website text default '',
  logo_url text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organisations enable row level security;

-- 2. Add organisation columns to profiles -----------------------------------
alter table public.profiles add column if not exists organisation_id uuid references public.organisations(id);
alter table public.profiles add column if not exists registration_complete boolean not null default false;

-- 3. Invite requests table --------------------------------------------------
create table if not exists public.invite_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.invite_requests enable row level security;

-- 4. Add organisation_id to all data tables ----------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'crm_board_items' and column_name = 'organisation_id') then
    alter table public.crm_board_items add column organisation_id uuid references public.organisations(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'crm_daily_activities' and column_name = 'organisation_id') then
    alter table public.crm_daily_activities add column organisation_id uuid references public.organisations(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'crm_documents' and column_name = 'organisation_id') then
    alter table public.crm_documents add column organisation_id uuid references public.organisations(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'crm_messages' and column_name = 'organisation_id') then
    alter table public.crm_messages add column organisation_id uuid references public.organisations(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'crm_change_requests' and column_name = 'organisation_id') then
    alter table public.crm_change_requests add column organisation_id uuid references public.organisations(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'crm_services' and column_name = 'organisation_id') then
    alter table public.crm_services add column organisation_id uuid references public.organisations(id);
  end if;
end $$;

-- 5. Create default organisation and migrate existing data -------------------
do $$
declare
  default_org_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public.organisations (id, name, email)
  values (default_org_id, 'Default Organisation', 'admin@supertelque.com')
  on conflict (id) do nothing;

  update public.profiles set organisation_id = default_org_id, registration_complete = true
  where organisation_id is null;

  update public.crm_board_items set organisation_id = default_org_id where organisation_id is null;
  update public.crm_daily_activities set organisation_id = default_org_id where organisation_id is null;
  update public.crm_documents set organisation_id = default_org_id where organisation_id is null;
  update public.crm_messages set organisation_id = default_org_id where organisation_id is null;
  update public.crm_change_requests set organisation_id = default_org_id where organisation_id is null;
  update public.crm_services set organisation_id = default_org_id where organisation_id is null;
end $$;

-- 6. RLS policies – organisations -------------------------------------------
drop policy if exists "organisations_select_all" on public.organisations;
create policy "organisations_select_all"
  on public.organisations for select
  to authenticated
  using (true);

drop policy if exists "organisations_insert_own" on public.organisations;
create policy "organisations_insert_own"
  on public.organisations for insert
  to authenticated
  with check (true);

-- 7. RLS policies – data tables scoped to organisation -----------------------
-- Profiles: users see their own row, plus others in the same organisation

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Security-definer helper to avoid RLS recursion when self-referencing profiles
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.get_user_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organisation_id from public.profiles where user_id = auth.uid();
$$;

revoke all on function private.get_user_org_id() from public;
revoke all on function private.get_user_org_id() from anon;
grant execute on function private.get_user_org_id() to authenticated;

drop policy if exists "profiles_select_org" on public.profiles;
create policy "profiles_select_org"
  on public.profiles for select
  to authenticated
  using (
    organisation_id = private.get_user_org_id()
  );

drop policy if exists "profiles_update_org" on public.profiles;
create policy "profiles_update_org"
  on public.profiles for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      organisation_id = private.get_user_org_id()
      and exists (
        select 1 from public.profiles
        where user_id = (select auth.uid()) and role in ('admin', 'manager') and status = 'active'
      )
    )
  );

-- CRM board items scoped to organisation
drop policy if exists "crm_board_items_select_org" on public.crm_board_items;
create policy "crm_board_items_select_org"
  on public.crm_board_items for select
  to authenticated
  using (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
  );

drop policy if exists "crm_board_items_insert_org" on public.crm_board_items;
create policy "crm_board_items_insert_org"
  on public.crm_board_items for insert
  to authenticated
  with check (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active')
  );

drop policy if exists "crm_board_items_update_org" on public.crm_board_items;
create policy "crm_board_items_update_org"
  on public.crm_board_items for update
  to authenticated
  using (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active')
  )
  with check (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active')
  );

drop policy if exists "crm_board_items_delete_org" on public.crm_board_items;
create policy "crm_board_items_delete_org"
  on public.crm_board_items for delete
  to authenticated
  using (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active')
  );

-- Daily activities scoped to organisation
drop policy if exists "crm_daily_activities_select_org" on public.crm_daily_activities;
create policy "crm_daily_activities_select_org"
  on public.crm_daily_activities for select
  to authenticated
  using (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
  );

drop policy if exists "crm_daily_activities_insert_org" on public.crm_daily_activities;
create policy "crm_daily_activities_insert_org"
  on public.crm_daily_activities for insert
  to authenticated
  with check (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
    and user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'owner', 'admin') and p.status = 'active')
  );

-- Documents scoped to organisation
drop policy if exists "crm_documents_select_org" on public.crm_documents;
create policy "crm_documents_select_org"
  on public.crm_documents for select
  to authenticated
  using (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
  );

drop policy if exists "crm_documents_insert_org" on public.crm_documents;
create policy "crm_documents_insert_org"
  on public.crm_documents for insert
  to authenticated
  with check (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
    and uploaded_by = (select auth.uid())
  );

-- Messages scoped to organisation
drop policy if exists "crm_messages_select_org" on public.crm_messages;
create policy "crm_messages_select_org"
  on public.crm_messages for select
  to authenticated
  using (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
    and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
  );

-- Change requests scoped to organisation
drop policy if exists "crm_change_requests_select_org" on public.crm_change_requests;
create policy "crm_change_requests_select_org"
  on public.crm_change_requests for select
  to authenticated
  using (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
  );

-- Services scoped to organisation
drop policy if exists "crm_services_select_org" on public.crm_services;
create policy "crm_services_select_org"
  on public.crm_services for select
  to authenticated
  using (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
  );

drop policy if exists "crm_services_insert_org" on public.crm_services;
create policy "crm_services_insert_org"
  on public.crm_services for insert
  to authenticated
  with check (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin')
  );

-- 8. RLS policies – invite_requests -----------------------------------------
drop policy if exists "invite_requests_select_own" on public.invite_requests;
create policy "invite_requests_select_own"
  on public.invite_requests for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
  );

drop policy if exists "invite_requests_insert_own" on public.invite_requests;
create policy "invite_requests_insert_own"
  on public.invite_requests for insert
  to authenticated
  with check (user_id = (select auth.uid()));
