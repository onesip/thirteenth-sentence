-- Run this once in Supabase SQL Editor when "Automatically expose new tables" was disabled.
-- It exposes only the intended read-only public archive data and gives the backend service role full access.

begin;

grant usage on schema public to anon, authenticated, service_role;

grant select on table public.archives to anon, authenticated;
grant select on table public.legacy_fragments to anon, authenticated;

revoke all on table public.game_sessions from anon, authenticated;
revoke all on table public.contributions from anon, authenticated;
revoke all on table public.rate_limit_events from anon, authenticated;

-- The server-only secret key maps to service_role and needs explicit table privileges
-- when automatic table exposure/default grants were disabled at project creation.
grant all privileges on table public.game_sessions to service_role;
grant all privileges on table public.contributions to service_role;
grant all privileges on table public.archives to service_role;
grant all privileges on table public.legacy_fragments to service_role;
grant all privileges on table public.rate_limit_events to service_role;

grant usage, select on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

commit;
