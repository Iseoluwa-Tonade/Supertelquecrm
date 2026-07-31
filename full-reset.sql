-- SuperTelque CRM – FULL RESET: wipe all data and start over
-- Run in the Supabase SQL editor.
-- WARNING: this deletes EVERYTHING – all users, organisations, requests and CRM data.
-- You will need to sign up again from scratch. This cannot be undone.

-- 1. CRM data (references auth.users / organisations)
delete from public.crm_messages;
delete from public.crm_daily_activities;
delete from public.crm_board_items;
delete from public.crm_change_requests;
delete from public.crm_documents;
delete from public.crm_services;

-- 2. Invite requests + profiles (reference auth.users and organisations)
delete from public.invite_requests;
delete from public.profiles;

-- 3. Organisations (no longer referenced)
delete from public.organisations;

-- 4. Auth users (this signs everyone out, including you)
delete from auth.users;

-- 5. Verify everything is empty
select 'profiles' as tbl, count(*) from public.profiles
union all select 'organisations', count(*) from public.organisations
union all select 'invite_requests', count(*) from public.invite_requests
union all select 'auth.users', count(*) from auth.users
union all select 'crm_messages', count(*) from public.crm_messages;
