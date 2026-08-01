-- SuperTelque CRM – allow admins and owners to update their own organisation.
--
-- Run this in the Supabase SQL editor. Admins/owners of the org can now update their
-- own organisation row.

drop policy if exists "organisations_update_org_admin" on public.organisations;
create policy "organisations_update_org_admin"
  on public.organisations for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.organisation_id = public.organisations.id
        and p.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.organisation_id = public.organisations.id
        and p.role in ('admin', 'owner')
    )
  );

