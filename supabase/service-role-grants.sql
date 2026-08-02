-- Required when “Automatically expose new tables” is disabled.
-- This grants the server-side Supabase role access to the game tables only.

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.game_sessions,
  public.contributions,
  public.archives,
  public.legacy_fragments,
  public.rate_limit_events
  to service_role;

grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Keep future server-side tables/functions usable without enabling public access.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;
