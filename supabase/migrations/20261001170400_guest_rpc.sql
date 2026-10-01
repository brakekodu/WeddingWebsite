-- =====================================================================
-- Guest-facing RPC functions
-- =====================================================================
-- Guests have NO table privileges. These SECURITY DEFINER functions are the
-- only way an unauthenticated caller can read or write wedding data. Each one:
--   * takes the invitation token (a bearer credential) or the RSVP code,
--   * returns only data belonging to that invitation, and only the fields a
--     guest needs (no email, phone, address, notes, or internal invitation IDs),
--   * validates every write against invitation_guests and guest_events.
--
-- Errors are raised with machine-readable messages that the app maps to
-- friendly text: invitation_not_found, invalid_payload, response_not_allowed,
-- response_incomplete, meal_required, invalid_meal.

-- ---------------------------------------------------------------------
-- Builds the guest-safe view of one invitation.
-- An event is included only if at least one guest on this invitation is
-- assigned to it, and each event lists only this invitation's assigned guests.
-- ---------------------------------------------------------------------
create function private.invitation_view(p_invitation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with inv_guests as (
    select g.id, g.first_name, g.last_name, g.display_name, g.dietary_restrictions, ig.display_order
      from public.invitation_guests ig
      join public.guests g on g.id = ig.guest_id
     where ig.invitation_id = p_invitation_id
  ),
  assignments as (
    select ge.guest_id, ge.event_id
      from public.guest_events ge
      join inv_guests ig on ig.id = ge.guest_id
  )
  select jsonb_build_object(
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ig.id,
               'first_name', ig.first_name,
               'last_name', ig.last_name,
               'display_name', ig.display_name,
               'dietary_restrictions', ig.dietary_restrictions
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
             ) order by e.display_order, e.starts_at nulls last, e.name)
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
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
-- get_invitation: resolve a token to the guest-safe invitation view.
-- Returns NULL for unknown, malformed, or void tokens (indistinguishable).
-- Logs invitation_accessed at most once per 30 minutes; admin previews are
-- not logged.
-- ---------------------------------------------------------------------
create function public.get_invitation(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation_id uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24}$' then
    return null;
  end if;

  select id into v_invitation_id
    from public.invitations
   where token = p_token
     and status <> 'void';

  if v_invitation_id is null then
    return null;
  end if;

  if not private.is_admin() then
    perform private.log_activity(
      v_invitation_id, 'invitation_accessed', 'guest', '{}'::jsonb, interval '30 minutes'
    );
  end if;

  return private.invitation_view(v_invitation_id);
end;
$$;

-- ---------------------------------------------------------------------
-- record_rsvp_started: the guest pressed "Begin RSVP".
-- ---------------------------------------------------------------------
create function public.record_rsvp_started(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation_id uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24}$' then
    return;
  end if;

  select id into v_invitation_id
    from public.invitations
   where token = p_token
     and status <> 'void';

  if v_invitation_id is null or private.is_admin() then
    return;
  end if;

  perform private.log_activity(
    v_invitation_id, 'rsvp_started', 'guest', '{}'::jsonb, interval '30 minutes'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- submit_rsvp: save a complete response for an invitation.
--
-- p_payload = {
--   "responses": [{ "guest_id", "event_id", "status": "attending"|"declined",
--                   "meal_option_id": uuid|null }],
--   "dietary":   [{ "guest_id", "dietary_restrictions": text|null }]
-- }
--
-- Every RSVP-required (guest, event) pair on the invitation must be answered
-- exactly once, and nothing else may be answered. A meal is required when
-- attending an event with meal_selection_required, and must be null otherwise.
-- ---------------------------------------------------------------------
create function public.submit_rsvp(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation_id uuid;
  v_actor public.activity_actor;
  v_responses jsonb := coalesce(p_payload -> 'responses', '[]'::jsonb);
  v_dietary jsonb := coalesce(p_payload -> 'dietary', '[]'::jsonb);
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

  v_actor := case when private.is_admin() then 'admin' else 'guest' end;

  if jsonb_typeof(v_responses) <> 'array'
     or jsonb_typeof(v_dietary) <> 'array'
     or jsonb_array_length(v_responses) > 1000
     or jsonb_array_length(v_dietary) > 100 then
    raise exception 'invalid_payload';
  end if;

  -- Parse into typed temp rows. Malformed UUIDs or statuses are invalid_payload.
  begin
    create temporary table rsvp_input on commit drop as
      select x.guest_id, x.event_id, x.status::public.rsvp_status as status, x.meal_option_id
        from jsonb_to_recordset(v_responses)
          as x(guest_id uuid, event_id uuid, status text, meal_option_id uuid);

    create temporary table dietary_input on commit drop as
      select d.guest_id, nullif(btrim(d.dietary_restrictions), '') as dietary_restrictions
        from jsonb_to_recordset(v_dietary)
          as d(guest_id uuid, dietary_restrictions text);
  exception
    -- Only parsing happens in this block: bad UUIDs, unknown statuses, and
    -- non-object array elements all mean the payload is malformed.
    when others then
      raise exception 'invalid_payload';
  end;

  if exists (select 1 from pg_temp.rsvp_input where guest_id is null or event_id is null or status is null)
     or exists (select 1 from pg_temp.rsvp_input where status = 'pending')
     or (select count(*) from pg_temp.rsvp_input)
        <> (select count(*) from (select distinct guest_id, event_id from pg_temp.rsvp_input) s)
     or exists (select 1 from pg_temp.dietary_input where guest_id is null)
     or exists (select 1 from pg_temp.dietary_input where length(dietary_restrictions) > 500)
     or (select count(*) from pg_temp.dietary_input)
        <> (select count(distinct guest_id) from pg_temp.dietary_input) then
    raise exception 'invalid_payload';
  end if;

  create temporary table rsvp_required on commit drop as
    select ge.guest_id, ge.event_id, e.meal_selection_required
      from public.invitation_guests ig
      join public.guest_events ge on ge.guest_id = ig.guest_id
      join public.events e on e.id = ge.event_id
     where ig.invitation_id = v_invitation_id
       and e.rsvp_required;

  -- Nothing outside this invitation's assigned, RSVP-required events.
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
  ) then
    raise exception 'response_not_allowed';
  end if;

  -- Everything required is answered.
  if exists (
    select 1 from pg_temp.rsvp_required r
     where not exists (
       select 1 from pg_temp.rsvp_input i
        where i.guest_id = r.guest_id and i.event_id = r.event_id
     )
  ) then
    raise exception 'response_incomplete';
  end if;

  -- Meals: required when attending a meal event; otherwise must be absent.
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
     set dietary_restrictions = d.dietary_restrictions
    from pg_temp.dietary_input d
   where g.id = d.guest_id
     and g.dietary_restrictions is distinct from d.dietary_restrictions;

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

-- ---------------------------------------------------------------------
-- resolve_rsvp_code: printed fallback code -> token (for a redirect).
-- Globally throttled: after 50 failed lookups in 10 minutes, all lookups
-- return 'throttled' until the window passes. The QR route is unaffected.
-- ---------------------------------------------------------------------
create function public.resolve_rsvp_code(p_code text)
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
    if v_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' then
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
-- Privileges
-- ---------------------------------------------------------------------
-- Supabase grants EXECUTE on new public functions to anon/authenticated by
-- default, so be explicit about every function.
revoke execute on function public.get_invitation(text) from public;
revoke execute on function public.record_rsvp_started(text) from public;
revoke execute on function public.submit_rsvp(text, jsonb) from public;
revoke execute on function public.resolve_rsvp_code(text) from public;

grant execute on function public.get_invitation(text) to anon, authenticated, service_role;
grant execute on function public.record_rsvp_started(text) to anon, authenticated, service_role;
grant execute on function public.submit_rsvp(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.resolve_rsvp_code(text) to anon, authenticated, service_role;

-- Sweep: nothing in the private schema is callable except is_admin(), which
-- RLS policies need. Trigger functions do not need EXECUTE to fire.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated, service_role;
