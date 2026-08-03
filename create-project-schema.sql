-- ----------------------------------------------------------------------------
-- Project creation support script
-- Run this in the Supabase SQL editor (Dashboard > SQL > New query).
-- It is idempotent (safe to run repeatedly) and ensures that:
--   1. the crm_board_items table exists with every column used by the
--      "New project" form (projects + tasks get stored here),
--   2. RLS is enabled,
--   3. managers/admins can insert/update/delete projects, and
--   4. the abbreviation owner/admin/manager select policies are in place.
-- ----------------------------------------------------------------------------

-- 1. Core table -------------------------------------------------------------
create table if not exists public.crm_board_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  organisation_id uuid,
  assigned_to uuid,
  visibility text default '',
  type text not null default 'deal',           -- 'deal' | 'project' | 'task'
  title text not null,
  company text default '',
  owner text default '',
  priority text default 'medium',              -- 'high' | 'medium' | 'low'
  value numeric default 0,
  due date,
  status text default '',
  notes text default '',
  document_url text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_board_items enable row level security;

-- Columns added over time (idempotent) --------------------------------------
alter table public.crm_board_items add column if not exists document_url text default '';
alter table public.crm_board_items add column if not exists organisation_id uuid;
alter table public.crm_board_items add column if not exists updated_at timestamptz not null default now();

--  RLS: managers/admins can read every project ------------------------------
drop policy if exists "crm_board_items_select_by_role" on public.crm_board_items;
create policy "crm_board_items_select_by_role"
  on public.crm_board_items for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = assigned_to
    or visibility = 'shared'
    or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role in ('manager', 'admin')
        and p.status = 'active'
    )
  );

-- RLS: managers/admins can create projects ----------------------------------
drop policy if exists "crm_board_items_insert_by_manager" on public.crm_board_items;
create policy "crm_board_items_insert_by_manager"
  on public.crm_board_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role in ('manager', 'admin')
        and p.status = 'active'
    )
  );

-- RLS: managers/admins can update projects -----------------------------------
drop policy if exists "crm_board_items_update_by_manager" on public.crm_board_items;
create policy "crm_board_items_update_by_manager"
  on public.crm_board_items for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role in ('manager', 'admin')
        and p.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role in ('manager', 'admin')
        and p.status = 'active'
    )
  );

-- RLS: managers/admins can delete projects -----------------------------------
drop policy if exists "crm_board_items_delete_by_manager" on public.crm_board_items;
create policy "crm_board_items_delete_by_manager"
  on public.crm_board_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role in ('manager', 'admin')
        and p.status = 'active'
    )
  );