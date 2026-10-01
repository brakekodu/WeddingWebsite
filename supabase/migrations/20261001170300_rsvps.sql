-- =====================================================================
-- RSVPs, meal selections, RSVP activity
-- =====================================================================

-- ---------------------------------------------------------------------
-- rsvps: one row per (guest, event). The composite FK to guest_events means
-- an RSVP can only exist for an event the guest is actually invited to; if
-- the assignment is removed, the RSVP goes with it.
-- ---------------------------------------------------------------------
create table public.rsvps (
  guest_id uuid not null
    constraint rsvps_guest_id_fkey references public.guests (id) on delete cascade,
  event_id uuid not null
    constraint rsvps_event_id_fkey references public.events (id) on delete cascade,
  status public.rsvp_status not null default 'pending',
  -- The invitation through which the most recent answer was submitted.
  invitation_id uuid
    constraint rsvps_invitation_id_fkey references public.invitations (id) on delete set null,
  -- First time a non-pending answer was recorded.
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guest_id, event_id),
  constraint rsvps_guest_event_fkey foreign key (guest_id, event_id)
    references public.guest_events (guest_id, event_id) on delete cascade
);

create index rsvps_event_id_idx on public.rsvps (event_id);
create index rsvps_invitation_id_idx on public.rsvps (invitation_id);

create trigger rsvps_set_updated_at
  before update on public.rsvps
  for each row execute function private.set_updated_at();

alter table public.rsvps enable row level security;

create policy "Admins manage rsvps"
  on public.rsvps for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.rsvps from anon;

-- ---------------------------------------------------------------------
-- meal_selections: one meal per (guest, event). The composite FK to
-- meal_options (event_id, id) guarantees the meal belongs to that event.
-- Person-level dietary restrictions live on guests.dietary_restrictions.
-- ---------------------------------------------------------------------
create table public.meal_selections (
  guest_id uuid not null
    constraint meal_selections_guest_id_fkey references public.guests (id) on delete cascade,
  event_id uuid not null
    constraint meal_selections_event_id_fkey references public.events (id) on delete cascade,
  meal_option_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guest_id, event_id),
  constraint meal_selections_guest_event_fkey foreign key (guest_id, event_id)
    references public.guest_events (guest_id, event_id) on delete cascade,
  -- Deleting a selected meal option directly is blocked (deactivate it instead).
  -- NO ACTION rather than RESTRICT: the check runs at end of statement, so
  -- deleting a whole event can cascade through both tables.
  constraint meal_selections_meal_option_fkey foreign key (event_id, meal_option_id)
    references public.meal_options (event_id, id) on delete no action
);

create index meal_selections_event_meal_idx on public.meal_selections (event_id, meal_option_id);

create trigger meal_selections_set_updated_at
  before update on public.meal_selections
  for each row execute function private.set_updated_at();

alter table public.meal_selections enable row level security;

create policy "Admins manage meal_selections"
  on public.meal_selections for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.meal_selections from anon;

-- ---------------------------------------------------------------------
-- rsvp_activity: operational log for wedding administration.
-- Stores no IP addresses, user agents, or device fingerprints.
-- Append-only, written only by SECURITY DEFINER functions.
-- ---------------------------------------------------------------------
create table public.rsvp_activity (
  id bigint generated always as identity primary key,
  invitation_id uuid not null
    constraint rsvp_activity_invitation_id_fkey references public.invitations (id) on delete cascade,
  activity_type public.rsvp_activity_type not null,
  actor public.activity_actor not null default 'guest',
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index rsvp_activity_invitation_idx on public.rsvp_activity (invitation_id, occurred_at desc);
create index rsvp_activity_type_idx on public.rsvp_activity (activity_type, occurred_at desc);

alter table public.rsvp_activity enable row level security;

create policy "Admins read rsvp_activity"
  on public.rsvp_activity for select
  to authenticated
  using ((select private.is_admin()));

revoke all on public.rsvp_activity from anon;
revoke insert, update, delete, truncate on public.rsvp_activity from authenticated;

create function private.log_activity(
  p_invitation_id uuid,
  p_type public.rsvp_activity_type,
  p_actor public.activity_actor,
  p_details jsonb default '{}'::jsonb,
  p_dedupe_window interval default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_dedupe_window is not null and exists (
    select 1
      from public.rsvp_activity
     where invitation_id = p_invitation_id
       and activity_type = p_type
       and occurred_at > now() - p_dedupe_window
  ) then
    return;
  end if;

  insert into public.rsvp_activity (invitation_id, activity_type, actor, details)
  values (p_invitation_id, p_type, p_actor, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- Failed RSVP-code lookups, for global throttling of /rsvp.
-- Contains timestamps only.
-- ---------------------------------------------------------------------
create table private.rsvp_code_failures (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now()
);

create index rsvp_code_failures_attempted_at_idx on private.rsvp_code_failures (attempted_at);

alter table private.rsvp_code_failures enable row level security;
revoke all on private.rsvp_code_failures from public, anon, authenticated;
