-- =====================================================================
-- Guest site (design handoff): settings, public events, richer RSVP
-- =====================================================================
-- * wedding_settings: RSVP deadline (enforced here) + venue time zone
-- * events: attire + guest notes; "draft" visibility (hidden everywhere)
-- * guests: dietary chips; invitations: guest email + note to the couple
-- * RSVP codes: 6 characters (legacy 8-character codes keep working)
-- * get_public_site(): public events only, for the public website
-- * invitation_view / submit_rsvp: plus-one names, dietary chips, email,
--   note, deadline, attire/notes
--
-- The new enum value 'draft' cannot be referenced as an enum literal in the
-- same transaction it is added, so comparisons below use visibility::text.

alter type public.event_visibility add value if not exists 'draft';

-- ---------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------
create function private.is_valid_time_zone(p_tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz);
$$;

create table public.wedding_settings (
  id boolean primary key default true constraint wedding_settings_singleton check (id),
  -- Last day guests can submit or change an RSVP (inclusive, venue time).
  rsvp_deadline date,
  time_zone text not null default 'America/New_York'
    constraint wedding_settings_time_zone_valid check (private.is_valid_time_zone(time_zone)),
  updated_at timestamptz not null default now()
);

insert into public.wedding_settings (id) values (true);

create trigger wedding_settings_set_updated_at
  before update on public.wedding_settings
  for each row execute function private.set_updated_at();

alter table public.wedding_settings enable row level security;

create policy "Admins read settings"
  on public.wedding_settings for select
  to authenticated
  using ((select private.is_admin()));

create policy "Admins update settings"
  on public.wedding_settings for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.wedding_settings from anon;
revoke insert, delete, truncate on public.wedding_settings from authenticated;

-- True until the end of the deadline day in the venue's time zone (or when no deadline is set).
create function private.rsvp_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select now() < ((s.rsvp_deadline + 1)::timestamp at time zone s.time_zone)
      from public.wedding_settings s
     where s.id
  ), true);
$$;

-- ---------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------
alter table public.events
  add column attire text check (attire is null or length(attire) <= 200),
  add column guest_notes text check (guest_notes is null or length(guest_notes) <= 1000);

alter table public.guests
  add column dietary_tags text[] not null default '{}'
    constraint guests_dietary_tags_valid check (
      dietary_tags <@ array['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nut_allergy', 'shellfish', 'other']::text[]
    );

alter table public.invitations
  add column contact_email text check (contact_email is null or length(contact_email) <= 254),
  add column guest_message text check (guest_message is null or length(guest_message) <= 1000);

-- ---------------------------------------------------------------------
-- 6-character RSVP codes
-- ---------------------------------------------------------------------
alter table public.invitations drop constraint invitations_rsvp_code_format;
alter table public.invitations add constraint invitations_rsvp_code_format check (
  rsvp_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'
  or rsvp_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'
);

create or replace function private.new_rsvp_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 characters, no 0/O/1/I/L
  v_code text;
  v_bytes bytea;
  v_byte integer;
  v_i integer;
begin
  loop
    v_code := '';
    v_bytes := extensions.gen_random_bytes(32);
    v_i := 0;
    while length(v_code) < 6 loop
      if v_i >= 32 then
        v_bytes := extensions.gen_random_bytes(32);
        v_i := 0;
      end if;
      v_byte := get_byte(v_bytes, v_i);
      v_i := v_i + 1;
      if v_byte < 248 then -- rejection sampling, 248 = 8 * 31
        v_code := v_code || substr(c_alphabet, (v_byte % 31) + 1, 1);
      end if;
    end loop;
    exit when not exists (select 1 from public.invitations where rsvp_code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.resolve_rsvp_code(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_token text;
begin
  if (select count(*) from private.rsvp_code_failures
       where attempted_at > now() - interval '10 minutes') >= 50 then
    return jsonb_build_object('status', 'throttled');
  end if;

  if p_code is not null and length(p_code) <= 64 then
    v_code := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
    if v_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'
       or v_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' then
      select token into v_token
        from public.invitations
       where rsvp_code = v_code
         and status <> 'void';
    end if;
  end if;

  if v_token is null then
    insert into private.rsvp_code_failures default values;
    delete from private.rsvp_code_failures where attempted_at < now() - interval '1 day';
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object('status', 'ok', 'token', v_token);
end;
$$;

-- ---------------------------------------------------------------------
-- Public website data: public events only. Never invite-only or draft.
-- ---------------------------------------------------------------------
create function public.get_public_site()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id,
               'name', e.name,
               'description', e.description,
               'starts_at', e.starts_at,
               'ends_at', e.ends_at,
               'time_zone', e.time_zone,
               'location_name', e.location_name,
               'location_address', e.location_address,
               'attire', e.attire,
               'guest_notes', e.guest_notes
             ) order by e.starts_at nulls last, e.display_order, e.name)
        from public.events e
       where e.visibility::text = 'public'
    ), '[]'::jsonb),
    'rsvp_deadline', (select s.rsvp_deadline from public.wedding_settings s where s.id)
  );
$$;

revoke execute on function public.get_public_site() from public;
grant execute on function public.get_public_site() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Guest-safe invitation view (replaces the Phase 1 version)
-- Draft events are excluded even when assigned.
-- ---------------------------------------------------------------------
create or replace function private.invitation_view(p_invitation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with inv_guests as (
    select g.id, g.first_name, g.last_name, g.display_name, g.dietary_restrictions,
           g.dietary_tags, g.plus_one_of, ig.display_order,
           (select coalesce(h.display_name, h.first_name) from public.guests h where h.id = g.plus_one_of) as host_name
      from public.invitation_guests ig
      join public.guests g on g.id = ig.guest_id
     where ig.invitation_id = p_invitation_id
  ),
  assignments as (
    select ge.guest_id, ge.event_id
      from public.guest_events ge
      join inv_guests ig on ig.id = ge.guest_id
      join public.events e on e.id = ge.event_id
     where e.visibility::text <> 'draft'
  ),
  inv as (
    select i.contact_email, i.guest_message from public.invitations i where i.id = p_invitation_id
  )
  select jsonb_build_object(
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ig.id,
               'first_name', ig.first_name,
               'last_name', ig.last_name,
               'display_name', ig.display_name,
               'dietary_restrictions', ig.dietary_restrictions,
               'dietary_tags', to_jsonb(ig.dietary_tags),
               'is_plus_one', ig.plus_one_of is not null,
               'plus_one_host', ig.host_name
             ) order by ig.display_order, ig.first_name, ig.id)
        from inv_guests ig
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id,
               'name', e.name,
               'description', e.description,
               'starts_at', e.starts_at,
               'ends_at', e.ends_at,
               'time_zone', e.time_zone,
               'location_name', e.location_name,
               'location_address', e.location_address,
               'attire', e.attire,
               'guest_notes', e.guest_notes,
               'rsvp_required', e.rsvp_required,
               'meal_selection_required', e.meal_selection_required,
               'guest_ids', (
                 select jsonb_agg(a.guest_id order by a.guest_id)
                   from assignments a
                  where a.event_id = e.id
               ),
               'meal_options', case
                 when e.meal_selection_required then coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id', m.id,
                            'name', m.name,
                            'description', m.description
                          ) order by m.display_order, m.name)
                     from public.meal_options m
                    where m.event_id = e.id
                      and m.is_active
                 ), '[]'::jsonb)
                 else '[]'::jsonb
               end
             ) order by e.starts_at nulls last, e.display_order, e.name)
        from public.events e
       where e.id in (select event_id from assignments)
    ), '[]'::jsonb),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'guest_id', r.guest_id,
               'event_id', r.event_id,
               'status', r.status,
               'meal_option_id', ms.meal_option_id,
               'updated_at', r.updated_at
             ) order by r.guest_id, r.event_id)
        from public.rsvps r
        join assignments a on a.guest_id = r.guest_id and a.event_id = r.event_id
        left join public.meal_selections ms
          on ms.guest_id = r.guest_id and ms.event_id = r.event_id
    ), '[]'::jsonb),
    'contact_email', (select contact_email from inv),
    'guest_message', (select guest_message from inv),
    'rsvp_deadline', (select s.rsvp_deadline from public.wedding_settings s where s.id),
    'rsvp_open', private.rsvp_open()
  );
$$;

-- ---------------------------------------------------------------------
-- submit_rsvp (replaces the Phase 1 version)
--
-- p_payload = {
--   "responses": [{ guest_id, event_id, status, meal_option_id }],
--   "dietary":   [{ guest_id, dietary_restrictions, dietary_tags: [] }],
--   "plus_ones": [{ guest_id, first_name, last_name }],   -- plus-one guests only
--   "contact_email": text|null,
--   "message": text|null                                   -- note to the couple
-- }
-- Additional error: rsvp_closed (after the deadline; admins may still submit).
-- ---------------------------------------------------------------------
create or replace function public.submit_rsvp(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation_id uuid;
  v_is_admin boolean;
  v_actor public.activity_actor;
  v_responses jsonb := coalesce(p_payload -> 'responses', '[]'::jsonb);
  v_dietary jsonb := coalesce(p_payload -> 'dietary', '[]'::jsonb);
  v_plus_ones jsonb := coalesce(p_payload -> 'plus_ones', '[]'::jsonb);
  v_email text := nullif(btrim(p_payload ->> 'contact_email'), '');
  v_message text := nullif(btrim(p_payload ->> 'message'), '');
  v_had_previous boolean;
  v_activity public.rsvp_activity_type;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24}$' then
    raise exception 'invitation_not_found';
  end if;

  select id into v_invitation_id
    from public.invitations
   where token = p_token
     and status <> 'void';

  if v_invitation_id is null then
    raise exception 'invitation_not_found';
  end if;

  v_is_admin := private.is_admin();
  v_actor := case when v_is_admin then 'admin' else 'guest' end;

  if not v_is_admin and not private.rsvp_open() then
    raise exception 'rsvp_closed';
  end if;

  if jsonb_typeof(v_responses) <> 'array'
     or jsonb_typeof(v_dietary) <> 'array'
     or jsonb_typeof(v_plus_ones) <> 'array'
     or jsonb_array_length(v_responses) > 1000
     or jsonb_array_length(v_dietary) > 100
     or jsonb_array_length(v_plus_ones) > 100
     or (v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
     or (v_message is not null and length(v_message) > 1000) then
    raise exception 'invalid_payload';
  end if;

  begin
    create temporary table rsvp_input on commit drop as
      select x.guest_id, x.event_id, x.status::public.rsvp_status as status, x.meal_option_id
        from jsonb_to_recordset(v_responses)
          as x(guest_id uuid, event_id uuid, status text, meal_option_id uuid);

    create temporary table dietary_input on commit drop as
      select d.guest_id,
             nullif(btrim(d.dietary_restrictions), '') as dietary_restrictions,
             coalesce(array(select jsonb_array_elements_text(coalesce(d.dietary_tags, '[]'::jsonb))), '{}') as dietary_tags
        from jsonb_to_recordset(v_dietary)
          as d(guest_id uuid, dietary_restrictions text, dietary_tags jsonb);

    create temporary table plus_one_input on commit drop as
      select p.guest_id, btrim(p.first_name) as first_name, nullif(btrim(p.last_name), '') as last_name
        from jsonb_to_recordset(v_plus_ones)
          as p(guest_id uuid, first_name text, last_name text);
  exception
    -- Only parsing happens in this block: any failure means a malformed payload.
    when others then
      raise exception 'invalid_payload';
  end;

  if exists (select 1 from pg_temp.rsvp_input where guest_id is null or event_id is null or status is null)
     or exists (select 1 from pg_temp.rsvp_input where status = 'pending')
     or (select count(*) from pg_temp.rsvp_input)
        <> (select count(*) from (select distinct guest_id, event_id from pg_temp.rsvp_input) s)
     or exists (select 1 from pg_temp.dietary_input where guest_id is null)
     or exists (select 1 from pg_temp.dietary_input where length(dietary_restrictions) > 500)
     or exists (
       select 1 from pg_temp.dietary_input
        where not dietary_tags <@ array['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nut_allergy', 'shellfish', 'other']::text[]
     )
     or (select count(*) from pg_temp.dietary_input)
        <> (select count(distinct guest_id) from pg_temp.dietary_input)
     or exists (
       select 1 from pg_temp.plus_one_input
        where guest_id is null
           or first_name is null or length(first_name) not between 1 and 100
           or length(coalesce(last_name, '')) > 100
     )
     or (select count(*) from pg_temp.plus_one_input)
        <> (select count(distinct guest_id) from pg_temp.plus_one_input) then
    raise exception 'invalid_payload';
  end if;

  create temporary table rsvp_required on commit drop as
    select ge.guest_id, ge.event_id, e.meal_selection_required
      from public.invitation_guests ig
      join public.guest_events ge on ge.guest_id = ig.guest_id
      join public.events e on e.id = ge.event_id
     where ig.invitation_id = v_invitation_id
       and e.rsvp_required
       and e.visibility::text <> 'draft';

  if exists (
    select 1 from pg_temp.rsvp_input i
     where not exists (
       select 1 from pg_temp.rsvp_required r
        where r.guest_id = i.guest_id and r.event_id = i.event_id
     )
  ) or exists (
    select 1 from pg_temp.dietary_input d
     where not exists (
       select 1 from public.invitation_guests ig
        where ig.invitation_id = v_invitation_id and ig.guest_id = d.guest_id
     )
  ) or exists (
    -- Names can only be set for plus-one guests on this invitation.
    select 1 from pg_temp.plus_one_input p
     where not exists (
       select 1 from public.invitation_guests ig
         join public.guests g on g.id = ig.guest_id
        where ig.invitation_id = v_invitation_id
          and ig.guest_id = p.guest_id
          and g.plus_one_of is not null
     )
  ) then
    raise exception 'response_not_allowed';
  end if;

  if exists (
    select 1 from pg_temp.rsvp_required r
     where not exists (
       select 1 from pg_temp.rsvp_input i
        where i.guest_id = r.guest_id and i.event_id = r.event_id
     )
  ) then
    raise exception 'response_incomplete';
  end if;

  if exists (
    select 1 from pg_temp.rsvp_input i
      join pg_temp.rsvp_required r on r.guest_id = i.guest_id and r.event_id = i.event_id
     where r.meal_selection_required and i.status = 'attending' and i.meal_option_id is null
  ) then
    raise exception 'meal_required';
  end if;

  if exists (
    select 1 from pg_temp.rsvp_input i
      join pg_temp.rsvp_required r on r.guest_id = i.guest_id and r.event_id = i.event_id
     where i.meal_option_id is not null
       and (
         not r.meal_selection_required
         or i.status <> 'attending'
         or not exists (
           select 1 from public.meal_options m
            where m.id = i.meal_option_id and m.event_id = i.event_id and m.is_active
         )
       )
  ) then
    raise exception 'invalid_meal';
  end if;

  v_had_previous := exists (
    select 1 from public.rsvps r
      join pg_temp.rsvp_required q on q.guest_id = r.guest_id and q.event_id = r.event_id
     where r.status <> 'pending'
  );

  insert into public.rsvps (guest_id, event_id, status, invitation_id, submitted_at)
  select i.guest_id, i.event_id, i.status, v_invitation_id, now()
    from pg_temp.rsvp_input i
  on conflict (guest_id, event_id) do update
     set status = excluded.status,
         invitation_id = excluded.invitation_id,
         submitted_at = coalesce(public.rsvps.submitted_at, excluded.submitted_at);

  delete from public.meal_selections ms
   using pg_temp.rsvp_input i
   where ms.guest_id = i.guest_id
     and ms.event_id = i.event_id
     and i.meal_option_id is null;

  insert into public.meal_selections (guest_id, event_id, meal_option_id)
  select i.guest_id, i.event_id, i.meal_option_id
    from pg_temp.rsvp_input i
   where i.meal_option_id is not null
  on conflict (guest_id, event_id) do update
     set meal_option_id = excluded.meal_option_id;

  update public.guests g
     set dietary_restrictions = d.dietary_restrictions,
         dietary_tags = d.dietary_tags
    from pg_temp.dietary_input d
   where g.id = d.guest_id
     and (g.dietary_restrictions is distinct from d.dietary_restrictions
          or g.dietary_tags is distinct from d.dietary_tags);

  update public.guests g
     set first_name = p.first_name,
         last_name = p.last_name
    from pg_temp.plus_one_input p
   where g.id = p.guest_id;

  update public.invitations
     set contact_email = v_email,
         guest_message = v_message
   where id = v_invitation_id
     and (contact_email is distinct from v_email or guest_message is distinct from v_message);

  v_activity := case when v_had_previous then 'rsvp_updated' else 'rsvp_completed' end;

  perform private.log_activity(
    v_invitation_id,
    v_activity,
    v_actor,
    jsonb_build_object(
      'attending', (select count(*) from pg_temp.rsvp_input where status = 'attending'),
      'declined', (select count(*) from pg_temp.rsvp_input where status = 'declined')
    )
  );

  return jsonb_build_object(
    'result', v_activity,
    'invitation', private.invitation_view(v_invitation_id)
  );
end;
$$;

-- Re-assert privileges for replaced/new functions.
revoke execute on function public.submit_rsvp(text, jsonb) from public;
revoke execute on function public.resolve_rsvp_code(text) from public;
grant execute on function public.submit_rsvp(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.resolve_rsvp_code(text) to anon, authenticated, service_role;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated, service_role;
-- The settings CHECK constraint calls this as the updating admin.
grant execute on function private.is_valid_time_zone(text) to authenticated, service_role;
