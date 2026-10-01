# Guest experience and RSVP flow

Built from the design handoff in `design/brake-wedding-handoff/` (screens 03–19).
Guests never create accounts; the invitation token in the URL identifies the
invitation and everything is scoped to it.

## Entry points

- **QR / link**: `/i/{token}`
- **Fallback**: `/rsvp` → the 6-character code printed on the card →
  `resolve_rsvp_code` → redirect to `/i/{token}`. No name search, ever.
  Errors: "We couldn't find that code" (with look-alike hint) or "too many
  attempts" when the global throttle is active (QR links still work).
- **Invalid or void link**: "We couldn't open that invitation" with code entry
  and contact email. Never reveals whose link it was.

## The invitation page `/i/{token}` (state-driven)

| State            | When                     | Shows                                                                                                                                                                                                  |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A · Welcome      | Not responded, RSVP open | "Welcome · John & Sarah", date, venue, respond-by date, **Begin RSVP**, See the wedding weekend                                                                                                        |
| B · Portal       | Responded                | "Welcome back", **Your weekend** (only invited events, who's attending each, Directions, Add all to calendar), travel/hotel, registry, FAQ; sidebar: Your RSVP + **Edit RSVP**, Your dinner, Questions |
| D · Closed       | After the RSVP deadline  | Portal with answers read-only and "Need a change? Contact us"                                                                                                                                          |
| C · Wedding week | —                        | Deferred (later phase)                                                                                                                                                                                 |

Opening the link remembers the invitation on that device (an httpOnly cookie
holding the same token). Public pages then show **"◐ Viewing as John & Sarah ·
Your invitation · Not you?"**, and `/weekend` shows the personal schedule
(including private events). "Not you?" forgets it.

## RSVP flow `/i/{token}/rsvp`

Logic: `src/lib/rsvp/flow.ts` (unit-tested). UI: `src/app/i/[token]/rsvp/rsvp-flow.tsx`.

1. **Attendance** — per person: ✓ Joyfully accepts / ✕ Regretfully declines.
   Plus-ones: "Bringing a guest" / "Not this time"; if bringing, first name
   required (last name optional).
2. **Events** — only people who accepted, only events each is invited to;
   explicit Yes/No per person per event. Desktop shows a guest × event grid
   with "Not invited" cells; mobile lists each event with its invited people.
3. **Dinner** — only when someone attends an event with meal selection; radio
   cards per person per meal event (active options only).
4. **Dietary (optional)** — per attending person: chips (None, Vegetarian,
   Vegan, Gluten-free, Dairy-free, Nut allergy, Shellfish, Other) + details for
   the caterer; one optional note to the couple. "Skip" goes straight to Review.
5. **Review** — Guests · Events · Dinner · Dietary, each with **Edit**;
   optional email; **Submit RSVP**.
6. **Confirmation** — "You're all set!" (or "Your changes are saved"), counts,
   View your wedding weekend · Add events to calendar · Edit RSVP. Everyone
   declined → "We'll miss you" + registry.

Behavior rules:

- Everyone declines in step 1 → straight to Review.
- **Nothing is saved until Submit.** The draft is kept on the device
  (localStorage) so Back/Save & exit/returning resumes where they left off.
- Continue is always enabled; tapping it with a gap scrolls to the first
  unanswered person and shows a text error (`role="alert"`).
- Submit failure keeps answers: "We couldn't save your RSVP — your answers are
  still here…"
- **Edit later** re-enters at Review with answers prefilled (`?step=review`).
- Status is never color-only: ✓ ✕ ○ ! symbols plus words; targets ≥ 44px.

## What is saved (`submit_rsvp`)

One transaction, all re-validated in the database:

- `rsvps` per (guest, event): attending/declined (every RSVP-required pair
  answered exactly once; draft events excluded);
- `meal_selections` for attending guests at meal events (deleted when declining);
- `guests.dietary_tags` + `guests.dietary_restrictions` for attending guests;
- plus-one names (only for guests with `plus_one_of` set on this invitation);
- `invitations.contact_email` and `invitations.guest_message`;
- `rsvp_activity`: `rsvp_completed` first time, `rsvp_updated` after.

After the deadline (`wedding_settings.rsvp_deadline`, end of that day in the
venue time zone) guest submissions fail with `rsvp_closed`; admins can still
record RSVPs.

Errors map to friendly text in `src/lib/rsvp/errors.ts`: `invitation_not_found`,
`response_incomplete`, `response_not_allowed`, `meal_required`, `invalid_meal`,
`invalid_payload`, `rsvp_closed`.

## Plus-ones (admin setup)

Add a guest to the household with first name **Guest** and "This guest is the
plus-one of" set to the host; put them on the same invitation and assign their
events. Guests see "John's guest" until they type a name.

## Visibility rules

- Public pages show only events with visibility **Public** (`get_public_site`).
- An invitation shows an event only if one of its guests is assigned to it;
  **Draft** events are hidden everywhere.
- Each person is asked only about their own events.

## Admin previews and activity

Admin previews of `/i/{token}` aren't logged as guest activity. RSVPs submitted
while signed in as an admin are logged with actor `admin`. Activity stores type,
actor, and time only — no IP addresses or device data.
