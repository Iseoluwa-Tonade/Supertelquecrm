alter table public.invite_requests
  drop constraint if exists invite_requests_user_id_organisation_id_key;

alter table public.invite_requests
  add constraint invite_requests_user_id_organisation_id_key unique (user_id, organisation_id);
