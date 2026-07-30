-- Fix 1: drop & recreate profiles_update_own_name without the recursive subquery
drop policy if exists "profiles_update_own_name" on public.profiles;
create policy "profiles_update_own_name"
  on public.profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Fix 2: allow role changes during initial setup (registration_complete going false->true)
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
    if old.registration_complete = false and new.registration_complete = true then
      return new;
    end if;
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
