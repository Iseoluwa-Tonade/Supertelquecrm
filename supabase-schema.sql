-- SuperTelque CRM - additive schema for Documents, expanded roles, per-teammate
-- view assignment, HR profile fields, the admin pricing calculator's service
-- catalog, and the sales document link on board items.
--
-- Run this once in the Supabase SQL editor for your project (or via the
-- Supabase MCP `apply_migration` tool). It assumes the existing tables
-- (profiles, crm_board_items, crm_daily_activities, crm_change_requests)
-- already exist, as created for the original CRM build. This script is
-- written to be safe to re-run (IF NOT EXISTS / OR REPLACE / drop-then-add).
--
-- This file matches what's actually deployed on the crm-project-board
-- Supabase project as of the admin/manager-parity + documents/pricing
-- rollout. In particular, the original build's `profiles`, `crm_board_items`,
-- `crm_change_requests`, and `crm_daily_activities` tables already had RLS
-- policies that checked `role = 'manager'` only. Section 6 below patches
-- those exact pre-existing policies (by their real names) to also accept
-- `admin`, since otherwise adding `admin` as a role would give admins LESS
-- access than managers on every one of those tables.

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
  with check (uploaded_by = (select auth.uid()));

drop policy if exists "documents_delete_own_or_manager" on public.crm_documents;
create policy "documents_delete_own_or_manager"
  on public.crm_documents for delete
  to authenticated
  using (
    uploaded_by = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin')
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
      owner = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin')
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

-- 5. Company type and feature flags for organisations ---------------------

alter table public.organisations add column if not exists company_type text default '';
alter table public.organisations add column if not exists enabled_features text[] default array['overview','profile'];

-- Managers and admins can view and update every teammate's profile (Team
-- page). This is deliberately additive/OR'd with the original build's
-- `profiles_select_own` / `profiles_update_own_name` policies (not a
-- replacement for them) — those still cover a regular owner/viewer reading
-- and updating their own row; this one covers seeing/managing everyone else.
--
-- IMPORTANT: a policy ON `profiles` can't check the caller's role by
-- querying `profiles` directly in its own USING clause — that makes
-- Postgres re-apply this same policy to evaluate the subquery, which
-- re-applies it again, and so on ("infinite recursion detected in policy
-- for relation \"profiles\""). `is_manager_or_admin()` below is SECURITY
-- DEFINER, so it reads `profiles` as its owner (which bypasses RLS on the
-- table it owns) instead of as the querying user, breaking the loop.
--
-- It lives in a `private` schema (not `public`) so PostgREST never exposes
-- it as a callable `/rest/v1/rpc/is_manager_or_admin` endpoint — it's only
-- ever invoked from inside these policies, never directly by a client.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_manager_or_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = uid and p.role in ('admin', 'manager')
  );
$$;

revoke all on function private.is_manager_or_admin(uuid) from public;
revoke all on function private.is_manager_or_admin(uuid) from anon;
grant execute on function private.is_manager_or_admin(uuid) to authenticated;

drop function if exists public.is_manager_or_admin(uuid);

drop policy if exists "profiles_admin_select_all" on public.profiles;
drop policy if exists "profiles_manager_select_all" on public.profiles;
create policy "profiles_manager_select_all"
  on public.profiles for select
  to authenticated
  using (
    private.is_manager_or_admin((select auth.uid()))
  );

drop policy if exists "profiles_admin_update_all" on public.profiles;
drop policy if exists "profiles_manager_update_all" on public.profiles;
create policy "profiles_manager_update_all"
  on public.profiles for update
  to authenticated
  using (
    private.is_manager_or_admin((select auth.uid()))
  );

-- Security: the original build's `profiles_update_own_name` policy already
-- requires role to stay unchanged on a self-update, but the broader
-- `profiles_manager_update_all` policy above is OR'd with it and doesn't
-- carry that same restriction — so as a second, trigger-level layer of
-- defense, this blocks a non-admin from changing their own
-- role/status/allowed_views no matter which policy let the UPDATE through
-- (including via a raw API call). SECURITY DEFINER is required so the
-- inner lookup of the acting user's *current* role isn't itself blocked by
-- RLS; EXECUTE is revoked below so it can't be called directly as an RPC.
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

revoke execute on function public.prevent_self_role_escalation() from public;
revoke execute on function public.prevent_self_role_escalation() from anon;
revoke execute on function public.prevent_self_role_escalation() from authenticated;

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
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- 6. Sales document link on deals/projects ---------------------------------

alter table public.crm_board_items add column if not exists document_url text default '';

-- 7. Give 'admin' the same access as 'manager' on the original build's
--    pre-existing policies, which were written to only check role = 'manager'.
--    Without this, admins would end up with LESS access than managers.

drop policy if exists "crm_board_items_select_by_role" on public.crm_board_items;
create policy "crm_board_items_select_by_role"
  on public.crm_board_items for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = assigned_to
    or visibility = 'shared'
    or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin'))
  );

drop policy if exists "crm_board_items_insert_by_manager" on public.crm_board_items;
create policy "crm_board_items_insert_by_manager"
  on public.crm_board_items for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active')
  );

drop policy if exists "crm_board_items_update_by_manager" on public.crm_board_items;
create policy "crm_board_items_update_by_manager"
  on public.crm_board_items for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active')
  )
  with check (
    exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active')
  );

drop policy if exists "crm_board_items_delete_by_manager" on public.crm_board_items;
create policy "crm_board_items_delete_by_manager"
  on public.crm_board_items for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active')
  );

drop policy if exists "crm_change_requests_select_by_role" on public.crm_change_requests;
create policy "crm_change_requests_select_by_role"
  on public.crm_change_requests for select
  to authenticated
  using (
    exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('manager', 'admin') and profiles.status = 'active')
    or requested_by = (select auth.uid())
  );

drop policy if exists "crm_change_requests_update_by_manager" on public.crm_change_requests;
create policy "crm_change_requests_update_by_manager"
  on public.crm_change_requests for update
  to authenticated
  using (
    exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('manager', 'admin') and profiles.status = 'active')
  )
  with check (
    exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('manager', 'admin') and profiles.status = 'active')
  );

drop policy if exists "crm_change_requests_delete_by_manager" on public.crm_change_requests;
create policy "crm_change_requests_delete_by_manager"
  on public.crm_change_requests for delete
  to authenticated
  using (
    exists (select 1 from public.profiles where profiles.user_id = (select auth.uid()) and profiles.role in ('manager', 'admin') and profiles.status = 'active')
  );

drop policy if exists "crm_daily_activities_select_by_role" on public.crm_daily_activities;
create policy "crm_daily_activities_select_by_role"
  on public.crm_daily_activities for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or visibility = 'team'
    or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin'))
  );

drop policy if exists "crm_daily_activities_insert_by_role" on public.crm_daily_activities;
create policy "crm_daily_activities_insert_by_role"
  on public.crm_daily_activities for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'owner', 'admin'))
  );

drop policy if exists "crm_daily_activities_update_by_role" on public.crm_daily_activities;
create policy "crm_daily_activities_update_by_role"
  on public.crm_daily_activities for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin'))
  )
  with check (
    (select auth.uid()) = user_id
    or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin'))
  );

drop policy if exists "crm_daily_activities_delete_by_role" on public.crm_daily_activities;
create policy "crm_daily_activities_delete_by_role"
  on public.crm_daily_activities for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin'))
  );

-- 8. Realtime for the new tables (optional, matches the existing tables) --
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

-- 9. One-time data fix: promote the CRM owner's account to admin ----------
-- Only needed once. Harmless to re-run (it's a no-op if already admin).
-- Adjust the email if your admin account differs.

update public.profiles set role = 'admin' where email = 'iseolu6@gmail.com' and role <> 'admin';

-- 10. Direct messages between teammates -------------------------------------
-- A manager/admin can start a thread with any teammate; the recipient can
-- then reply (and only reply — they can't cold-message a third party this
-- way, so a regular user never needs broad visibility into the profiles
-- table just to send a message).

create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_email text not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.crm_messages enable row level security;

drop policy if exists "crm_messages_select_participant" on public.crm_messages;
create policy "crm_messages_select_participant"
  on public.crm_messages for select
  to authenticated
  using (
    sender_id = (select auth.uid()) or recipient_id = (select auth.uid())
  );

drop policy if exists "crm_messages_insert_participant" on public.crm_messages;
create policy "crm_messages_insert_participant"
  on public.crm_messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active'
      )
      or exists (
        select 1 from public.crm_messages m
        where m.sender_id = recipient_id and m.recipient_id = (select auth.uid())
      )
    )
  );

drop policy if exists "crm_messages_update_read_by_recipient" on public.crm_messages;
create policy "crm_messages_update_read_by_recipient"
  on public.crm_messages for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Recipients can only ever flip read_at, never rewrite what was sent to them.
create or replace function public.protect_message_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_id <> old.sender_id
     or new.recipient_id <> old.recipient_id
     or new.body <> old.body
     or new.created_at <> old.created_at then
    raise exception 'Only read_at can be updated on an existing message';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_message_content() from public;
revoke all on function public.protect_message_content() from anon;
revoke all on function public.protect_message_content() from authenticated;

drop trigger if exists protect_message_content_trigger on public.crm_messages;
create trigger protect_message_content_trigger
  before update on public.crm_messages
  for each row execute function public.protect_message_content();

do $$
begin
  alter publication supabase_realtime add table public.crm_messages;
exception when duplicate_object then
  null;
end $$;

-- 11. Let a requester withdraw their own pending change request -------------

drop policy if exists "crm_change_requests_cancel_by_requester" on public.crm_change_requests;
create policy "crm_change_requests_cancel_by_requester"
  on public.crm_change_requests for update
  to authenticated
  using (
    requested_by = (select auth.uid()) and status = 'pending'
  )
  with check (
    requested_by = (select auth.uid()) and status = 'cancelled'
  );

-- Belt-and-suspenders: even with the policy above, only allow a non-manager
-- to flip their own pending request to 'cancelled' and nothing else.
create or replace function public.restrict_change_request_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role in ('manager', 'admin') and p.status = 'active'
  ) then
    return new;
  end if;

  if new.requested_by <> old.requested_by
     or new.board_item_id is distinct from old.board_item_id
     or new.action <> old.action
     or new.payload is distinct from old.payload
     or new.before_payload is distinct from old.before_payload
     or new.status <> 'cancelled' then
    raise exception 'You can only cancel your own pending request';
  end if;
  return new;
end;
$$;

revoke all on function public.restrict_change_request_cancel() from public;
revoke all on function public.restrict_change_request_cancel() from anon;
revoke all on function public.restrict_change_request_cancel() from authenticated;

drop trigger if exists restrict_change_request_cancel_trigger on public.crm_change_requests;
create trigger restrict_change_request_cancel_trigger
  before update on public.crm_change_requests
  for each row execute function public.restrict_change_request_cancel();
