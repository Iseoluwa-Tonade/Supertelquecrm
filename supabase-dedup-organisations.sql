-- SuperTelque CRM – Deduplicate organisations + add unique constraint
-- Run this once in the Supabase SQL editor AFTER supabase-migration.sql.
-- Safe to re-run (idempotent).

-- 1. Deduplicate organisations, keeping the earliest-created row for each
--    (name, email) pair. Updates all foreign-key references to point at the
--    survivor before deleting the duplicate rows.
do $$
declare
  dup record;
  keep_id uuid;
begin
  for dup in (
    select name, email
    from public.organisations
    group by name, email
    having count(*) > 1
  ) loop
    select id into keep_id
    from public.organisations
    where name = dup.name and email = dup.email
    order by created_at asc, id asc
    limit 1;

    update public.profiles
    set organisation_id = keep_id
    where organisation_id in (
      select id from public.organisations
      where name = dup.name and email = dup.email and id != keep_id
    );

    update public.crm_board_items set organisation_id = keep_id
    where organisation_id in (
      select id from public.organisations
      where name = dup.name and email = dup.email and id != keep_id
    );
    update public.crm_daily_activities set organisation_id = keep_id
    where organisation_id in (
      select id from public.organisations
      where name = dup.name and email = dup.email and id != keep_id
    );
    update public.crm_documents set organisation_id = keep_id
    where organisation_id in (
      select id from public.organisations
      where name = dup.name and email = dup.email and id != keep_id
    );
    update public.crm_messages set organisation_id = keep_id
    where organisation_id in (
      select id from public.organisations
      where name = dup.name and email = dup.email and id != keep_id
    );
    update public.crm_change_requests set organisation_id = keep_id
    where organisation_id in (
      select id from public.organisations
      where name = dup.name and email = dup.email and id != keep_id
    );
    update public.crm_services set organisation_id = keep_id
    where organisation_id in (
      select id from public.organisations
      where name = dup.name and email = dup.email and id != keep_id
    );

    delete from public.organisations
    where name = dup.name and email = dup.email and id != keep_id;
  end loop;
end $$;

-- 2. Add unique constraint to prevent future duplicates
alter table public.organisations
  drop constraint if exists organisations_name_email_key;

alter table public.organisations
  add constraint organisations_name_email_key unique (name, email);
