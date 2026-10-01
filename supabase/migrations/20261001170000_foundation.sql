-- =====================================================================
-- Foundation: extensions, private schema, shared helpers, admin allowlist
-- =====================================================================
-- Security model (see docs/SECURITY.md):
--   * RLS is enabled on every table in the same migration that creates it.
--   * Admin access requires an authenticated user listed in public.admin_users.
--     Being authenticated is NOT sufficient.
--   * Guests never authenticate. Guest access happens only through the
--     SECURITY DEFINER functions in the guest RPC migration, keyed by a
--     bearer invitation token.
--   * The `private` schema is not exposed through the Data API.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
-- `authenticated` needs USAGE so RLS policies can call private.is_admin().
grant usage on schema private to authenticated, service_role;

-- Functions are executable by PUBLIC by default in Postgres. Nothing in the
-- private schema should be callable unless explicitly granted.
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.invitation_status as enum ('draft', 'locked', 'void');
create type public.print_status as enum ('not_printed', 'proof_printed', 'printed');
create type public.qr_validation_status as enum ('not_validated', 'passed', 'failed');
create type public.rsvp_status as enum ('pending', 'attending', 'declined');
create type public.rsvp_activity_type as enum (
  'invitation_accessed',
  'rsvp_started',
  'rsvp_completed',
  'rsvp_updated'
);
create type public.activity_actor as enum ('guest', 'admin');
create type public.event_visibility as enum ('public', 'invited_only');

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin allowlist
-- ---------------------------------------------------------------------
-- Membership is managed only with the service role (scripts/grant-admin.ts)
-- or the SQL editor. There are deliberately no INSERT/UPDATE/DELETE policies.
create table public.admin_users (
  user_id uuid primary key
    constraint admin_users_user_id_fkey references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated, service_role;

create policy "Users can see their own admin row; admins see all"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

revoke all on public.admin_users from anon;
revoke insert, update, delete, truncate on public.admin_users from authenticated;
