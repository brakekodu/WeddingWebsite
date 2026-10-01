# RSVP flow

Guests never create accounts. The invitation token in the URL identifies the
invitation; everything is scoped to it.

## Entry points

- **QR / link**: `/i/{token}`
- **Fallback**: `/rsvp` → guest types the printed code (e.g. `ABCD-2345`) →
  `resolve_rsvp_code` → redirect to `/i/{token}`. Errors: "not found", or
  "too many attempts" when the global throttle is active (QR still works).
- Unknown, malformed, or void tokens show a friendly "couldn't find that
  invitation" page with a link to `/rsvp`.

## Steps

Implemented in `src/app/i/[token]/rsvp-experience.tsx`, logic in `src/lib/rsvp/flow.ts`.

1. **Welcome** — "Welcome, John & Sarah." / "We're so excited to celebrate with
   you." Lists the invitation's events. **Begin RSVP** (or **Update RSVP** if
   they already answered, with their saved answers shown). Starting logs `rsvp_started`.
2. **Attendance per person** — "Joyfully accepts" / "Regretfully declines"
   for each guest who has at least one RSVP-required event.
3. **Events** _(only if someone attending has 2+ RSVP events)_ — per person, per
   event; defaults to attending.
4. **Meals** _(only if someone is attending a meal event)_ — one choice per
   person per meal event, from that event's active options.
5. **Dietary restrictions** _(only if someone is attending)_ — optional, per person.
6. **Review** — summary of every answer.
7. **Submit** → **Confirmation** — "Thank you!" (or "We'll miss you" if
   everyone declined), summary, and a note that the same link can be used to change it.

Greeting names use `display_name` if set, else first name: one name →
"Welcome, John."; two → "John & Sarah"; more → "A, B & C".

## Visibility rules

- An event appears only if at least one guest **on this invitation** is assigned
  to it in `guest_events`.
- Each person is asked only about events **they** are assigned to.
- Events with `rsvp_required = false` are shown as information ("No RSVP needed").

## What is saved (`submit_rsvp`)

The submission must answer every (guest, RSVP-required event) pair on the
invitation, exactly once. In one transaction it:

- upserts `rsvps` (`attending`/`declined`, `invitation_id`, first `submitted_at`, `updated_at`);
- upserts `meal_selections` for attending guests at meal events, and deletes
  them where a guest now declines;
- updates `guests.dietary_restrictions` for attending guests (declined guests'
  notes are left untouched);
- logs `rsvp_completed` (first time) or `rsvp_updated` (later), with counts.

Database-side validation errors map to friendly messages (`src/lib/rsvp/errors.ts`):
`invitation_not_found`, `response_incomplete`, `response_not_allowed`,
`meal_required`, `invalid_meal`, `invalid_payload`. A rejected submission writes nothing.

## Editing later

Guests reopen the same link (or re-enter the code); the flow pre-fills their
saved answers. A meal option the couple has since hidden is cleared so the
guest picks again.

## Admin previews and admin-entered RSVPs

When a signed-in admin opens `/i/{token}` (Preview), no `invitation_accessed`
or `rsvp_started` activity is logged. If the admin submits the form (e.g. for a
guest who replied by phone), it is saved normally and logged with actor `admin`.

## Activity log

`invitation_accessed` (at most once per 30 minutes per invitation),
`rsvp_started` (same), `rsvp_completed`, `rsvp_updated`. No IP addresses,
user agents, or device data. It exists to answer "has the Smiths' invitation
been opened?", not to track people.
