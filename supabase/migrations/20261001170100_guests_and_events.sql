-- =====================================================================
-- Households, guests, events, guest_events, meal_options
-- =====================================================================
-- All tables in this file are admin-only. Guests reach the subset of this
-- data that belongs to their invitation through public.get_invitation().

-- ---------------------------------------------------------------------
-- households: a grouping of guests (mailing unit). NOT an invitation.
-- ---------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  primary_email text,
  primary_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index households_display_name_idx on public.households (lower(display_name));

create trigger households_set_updated_at
  before update on public.households
  for each row execute function private.set_updated_at();

alter table public.households enable row level security;

create policy "Admins manage households"
  on public.households for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.households from anon;

-- ---------------------------------------------------------------------
-- guests: individual people.
-- ---------------------------------------------------------------------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid
    constraint guests_household_id_fkey references public.households (id) on delete restrict,
  first_name text not null check (length(btrim(first_name)) between 1 and 100),
  last_name text check (last_name is null or length(last_name) <= 100),
  -- Preferred name used in greetings ("Johnny"). Falls back to first_name.
  display_name text check (display_name is null or length(display_name) <= 100),
  email text,
  phone text,
  -- Person-level dietary restrictions / allergies. Guests may edit via RSVP.
  dietary_restrictions text check (
    dietary_restrictions is null or length(dietary_restrictions) <= 500
  ),
  -- This guest may bring a plus-one.
  plus_one_allowed boolean not null default false,
  -- This guest IS the plus-one of another guest.
  plus_one_of uuid
    constraint guests_plus_one_of_fkey references public.guests (id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guests_plus_one_not_self check (plus_one_of is null or plus_one_of <> id)
);

create index guests_household_id_idx on public.guests (household_id);
create index guests_plus_one_of_idx on public.guests (plus_one_of);
create index guests_name_idx on public.guests (lower(last_name), lower(first_name));

create trigger guests_set_updated_at
  before update on public.guests
  for each row execute function private.set_updated_at();

alter table public.guests enable row level security;

create policy "Admins manage guests"
  on public.guests for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.guests from anon;

-- ---------------------------------------------------------------------
-- events: configurable. Nothing is hard-coded or seeded.
-- Times are venue-local wall-clock times (timestamp without time zone)
-- plus an IANA time zone name, so "4:00 PM" always displays as 4:00 PM.
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text,
  starts_at timestamp,
  ends_at timestamp,
  time_zone text,
  location_name text,
  location_address text,
  rsvp_required boolean not null default true,
  meal_selection_required boolean not null default false,
  -- 'public': may appear on the future public schedule.
  -- 'invited_only': shown only to invitations that include an assigned guest.
  -- Either way, RSVP visibility is governed by guest_events.
  visibility public.event_visibility not null default 'invited_only',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or starts_at is null or ends_at >= starts_at),
  -- Meals are collected through the RSVP flow, so they require RSVP.
  constraint events_meal_requires_rsvp check (not meal_selection_required or rsvp_required)
);

create index events_display_order_idx on public.events (display_order, starts_at);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

alter table public.events enable row level security;

create policy "Admins manage events"
  on public.events for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.events from anon;

-- ---------------------------------------------------------------------
-- guest_events: exactly which guests are invited to which events.
-- This is the sole source of truth for event visibility to guests.
-- ---------------------------------------------------------------------
create table public.guest_events (
  guest_id uuid not null
    constraint guest_events_guest_id_fkey references public.guests (id) on delete cascade,
  event_id uuid not null
    constraint guest_events_event_id_fkey references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guest_id, event_id)
);

create index guest_events_event_id_idx on public.guest_events (event_id);

alter table public.guest_events enable row level security;

create policy "Admins manage guest_events"
  on public.guest_events for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.guest_events from anon;

-- ---------------------------------------------------------------------
-- meal_options: configurable per event. No foods are hard-coded.
-- ---------------------------------------------------------------------
create table public.meal_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    constraint meal_options_event_id_fkey references public.events (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_options_event_name_key unique (event_id, name),
  -- Target for the composite FK from meal_selections, which guarantees a
  -- selected meal belongs to the event it was selected for.
  constraint meal_options_event_id_id_key unique (event_id, id)
);

create trigger meal_options_set_updated_at
  before update on public.meal_options
  for each row execute function private.set_updated_at();

alter table public.meal_options enable row level security;

create policy "Admins manage meal_options"
  on public.meal_options for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.meal_options from anon;
