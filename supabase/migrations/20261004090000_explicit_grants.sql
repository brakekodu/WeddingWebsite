-- =====================================================================
-- Explicit table privileges for the API roles
-- =====================================================================
-- Newer Supabase projects no longer grant new public tables to anon /
-- authenticated automatically. Grant exactly what each role needs here;
-- Row Level Security still decides which rows (admins only, see the policies
-- in earlier migrations). `anon` (guests) gets no table access at all — guests
-- use the SECURITY DEFINER functions, which are granted explicitly.

-- Signed-in users: admins read and manage wedding data through RLS.
grant select on public.admin_users to authenticated;

grant select, insert, update, delete on
  public.households,
  public.guests,
  public.events,
  public.guest_events,
  public.meal_options,
  public.invitations,
  public.invitation_guests,
  public.rsvps,
  public.meal_selections,
  public.site_photos,
  public.site_placements
to authenticated;

grant select, update on public.wedding_settings to authenticated;

-- Append-only log: written only by SECURITY DEFINER functions.
grant select on public.rsvp_activity to authenticated;

-- Server-side scripts (scripts/grant-admin.ts, scripts/verify-remote.ts) use
-- the service role, which bypasses RLS but still needs table privileges.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
