# Database

Postgres on Supabase project **BrakeWedding** (us-east-2). The schema is
defined only by `supabase/migrations/*.sql` — never by dashboard edits.

## Entities

```
households 1──* guests *──* events            (guest_events = who is invited to what)
                  │
invitations 1──* invitation_guests *──1 guests
     │
     ├──* rsvp_activity                         (operational log)
     │
rsvps (guest, event) ──► guest_events           (answer per guest per event)
meal_selections (guest, event) ──► meal_options (event, id)
admin_users ──► auth.users                      (admin allowlist)
```

**Household ≠ invitation.** A household groups guests (a mailing unit). An
invitation is an issued invitation with one token, one RSVP code, and one QR
code. An invitation may contain guests from any household, and a household can
have several invitations. QR codes belong to invitations.

## Tables

| Table                        | Purpose                                  | Notable columns / rules                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `households`                 | Mailing unit                             | display name, address fields, primary email/phone, notes                                                                                                                                                                                                                                                                                           |
| `guests`                     | A person                                 | `household_id` (nullable; household delete is blocked while guests exist), first/last/`display_name` (greeting name), email, phone, `dietary_restrictions` (≤500), `plus_one_allowed`, `plus_one_of`                                                                                                                                               |
| `events`                     | Configurable event                       | name, description, `starts_at`/`ends_at` (**venue-local wall-clock**, `timestamp`), `time_zone` (IANA), location, `rsvp_required`, `meal_selection_required` (requires RSVP), `visibility` (`public`/`invited_only`), `display_order`                                                                                                              |
| `guest_events`               | Which guests are invited to which events | PK (guest, event). **Sole source of event visibility for guests.**                                                                                                                                                                                                                                                                                 |
| `meal_options`               | Per-event meal choices                   | `is_active` (hide instead of delete), unique name per event                                                                                                                                                                                                                                                                                        |
| `invitations`                | Issued invitation                        | `token` (24-char base64url, unique), `rsvp_code` (8 chars, unique), `status` (`draft`/`locked`/`void`), `generated_at`, `locked_at`, `print_status` (`not_printed`/`proof_printed`/`printed`), `proof_printed_at`, `printed_at`, `qr_validation_status` (`not_validated`/`passed`/`failed`), `validated_at`, `validated_url`, `validation_details` |
| `invitation_guests`          | Guests covered by an invitation          | PK (invitation, guest), `display_order`                                                                                                                                                                                                                                                                                                            |
| `rsvps`                      | Answer per (guest, event)                | `status` (`pending`/`attending`/`declined`), `invitation_id` (which invitation submitted), `submitted_at` (first answer), `updated_at`. Composite FK to `guest_events` — an RSVP cannot exist for an event the guest isn't invited to, and is removed if the assignment is.                                                                        |
| `meal_selections`            | Meal per (guest, event)                  | Composite FK to `guest_events`, and to `meal_options (event_id, id)` so the meal must belong to that event. Deleting a chosen meal option is blocked.                                                                                                                                                                                              |
| `rsvp_activity`              | Operational log                          | `invitation_accessed`, `rsvp_started`, `rsvp_completed`, `rsvp_updated`; `actor` (`guest`/`admin`). No IPs or user agents. Append-only.                                                                                                                                                                                                            |
| `admin_users`                | Admin allowlist                          | `user_id` → `auth.users`. Changed only with the secret key or SQL editor.                                                                                                                                                                                                                                                                          |
| `private.rsvp_code_failures` | Throttle state for `/rsvp`               | Timestamps only; pruned after a day.                                                                                                                                                                                                                                                                                                               |

## Triggers and invariants (enforced in the database)

- **Credentials are server-generated.** On insert, `token` and `rsvp_code` are
  always generated (client values are ignored). On update they can change only
  through `regenerate_invitation_token()`, only while unlocked.
- **Locking is one-way.** `locked_at` can't be cleared; a locked invitation
  can't return to `draft`; its token and code are immutable.
- **Printing rules.** `printed` requires a lock and `qr_validation_status = passed`;
  a printed invitation can't be marked unprinted. Regenerating credentials
  resets a `proof_printed` status (old proofs no longer scan to this invitation).
- **Validation resets** when credentials rotate or the invitation's guests change.
- `updated_at` is maintained by triggers on every mutable table.

## Functions exposed through the Data API

| Function                          | Callable by                  | Purpose                                     |
| --------------------------------- | ---------------------------- | ------------------------------------------- |
| `get_invitation(token)`           | anon, authenticated          | Guest-safe invitation view                  |
| `record_rsvp_started(token)`      | anon, authenticated          | Log "Begin RSVP"                            |
| `submit_rsvp(token, payload)`     | anon, authenticated          | Validate + save a complete response         |
| `resolve_rsvp_code(code)`         | anon, authenticated          | Fallback code → token (throttled)           |
| `regenerate_invitation_token(id)` | authenticated (checks admin) | Rotate an unlocked invitation's credentials |

Helpers in the `private` schema (not exposed) include `is_admin()`, the
credential generators, the trigger functions, and `invitation_view()`.

## Migrations workflow

1. `npm run db:migration -- short_description` creates
   `supabase/migrations/<timestamp>_short_description.sql`.
2. Write the SQL. **Enable RLS and write policies in the same migration as the
   table.** Revoke from `anon` anything guests must not touch. Grant EXECUTE on
   new functions explicitly (Supabase grants new `public` functions to API
   roles by default).
3. Add/extend tests in `tests/db/` and run `npm test` (PGlite applies every
   migration from scratch).
4. Update `src/lib/supabase/database.types.ts` (or regenerate, below).
5. `npm run db:push` applies pending migrations to the hosted project.

Never edit a migration that has been pushed; write a new one.

### Types

`src/lib/supabase/database.types.ts` is hand-maintained to match the
migrations until the CLI is linked. After linking, `npm run db:types` writes
`src/lib/supabase/database.generated.ts`; diff it against the hand-written file
and reconcile (planned: switch to generated types plus named row aliases).

## Local database testing without Docker

`tests/db/harness.ts` boots PGlite (Postgres compiled to WebAssembly), recreates
Supabase's roles (`anon`, `authenticated`, `service_role`), default grants,
`auth.users`, `auth.uid()`, and pgcrypto in `extensions`, then applies all
migrations. Tests switch roles and JWT claims exactly as PostgREST does.
Docker plus `supabase start` also works if you install Docker later.
