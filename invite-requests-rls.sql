-- Allow admins/managers of an organisation to update invite requests for their org
drop policy if exists "invite_requests_update_org" on public.invite_requests;
create policy "invite_requests_update_org"
  on public.invite_requests for update
  to authenticated
  using (
    organisation_id = (select p.organisation_id from public.profiles p where p.user_id = (select auth.uid()))
    and private.is_manager_or_admin((select auth.uid()))
  );

-- Allow the requesting user to withdraw their own pending request
drop policy if exists "invite_requests_delete_own" on public.invite_requests;
create policy "invite_requests_delete_own"
  on public.invite_requests for delete
  to authenticated
  using (user_id = (select auth.uid()));
