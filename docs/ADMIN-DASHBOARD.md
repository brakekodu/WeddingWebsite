# Admin app and dashboard

## Access

- Sign in at `/admin/login` with an email + password admin account.
- Only accounts listed in `admin_users` get in (`npm run admin:grant -- <email>`).
  Other Supabase accounts are signed out with "not an administrator".
- Designed for two administrators (the couple).

## Pages

| Route                           | What you can do                                                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/dashboard`              | Headline numbers, attendance by event, meal counts, dietary list, QR status, CSV download                                                                                                                                                                |
| `/admin/households`             | Search, create; detail: edit, add guests, create an invitation for all household guests, delete (when empty)                                                                                                                                             |
| `/admin/guests`                 | Search by name/email, filter by household; create; detail: edit (incl. household, preferred name, plus-one, dietary), choose events, see RSVP + invitations, delete                                                                                      |
| `/admin/events`                 | Create configurable events; detail: edit, meal options (add / hide / delete unused), invite guests with a household-grouped checklist (shows RSVP status)                                                                                                |
| `/admin/invitations`            | Search by name or code, filter by status/QR; create (optionally with a household's guests); **Validate all**                                                                                                                                             |
| `/admin/invitations/{id}`       | Link + code, QR code, guests (add/remove), event × guest RSVP matrix, privacy warnings, activity, **Preview**, **Open personalized URL**, **Test QR**, **Validate QR**, **Print single invitation**, **Lock**, regenerate, void/restore, download QR SVG |
| `/admin/invitations/{id}/print` | 5×7 print proof; record proof printed; mark final print (when allowed)                                                                                                                                                                                   |
| `/admin/export/rsvps.csv`       | One row per guest × assigned event                                                                                                                                                                                                                       |

Destructive or permanent actions (lock, regenerate, void, delete) ask for confirmation.

## Dashboard metric definitions

"Invited" = on at least one invitation that isn't void. Implemented and tested
in `src/lib/dashboard/metrics.ts`.

| Metric                      | Definition                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Guests invited              | Distinct guests on non-void invitations                                            |
| Households                  | All households                                                                     |
| Invitations                 | Non-void invitations                                                               |
| Responses received          | Non-void invitations where every (guest, RSVP-required event) pair has an answer   |
| Response %                  | Responses received ÷ invitations that need a response (have ≥1 RSVP-required pair) |
| Attending                   | Invited guests who answered and are attending ≥1 event                             |
| Declined                    | Invited guests who answered and are attending none                                 |
| Still to reply              | Invited guests with RSVP events and no answers yet                                 |
| QR codes needing attention  | Non-void invitations whose QR validation is failed, stale, or not run              |
| Guests not on an invitation | Guests who won't receive anything yet                                              |

Guests whose events need no RSVP are counted as invited but in none of
attending/declined/still-to-reply.

Per event: invited (assigned guests on active invitations), attending,
declined, awaiting reply. Per meal event: count per option among attending
guests, plus "attending, no meal chosen" with names. Dietary: attending guests
with non-empty restrictions.

## CSV export

Columns: Household, First name, Last name, Event, RSVP, Meal, Dietary
restrictions, RSVP code, Last updated. Cells starting with `= + - @` are
prefixed with `'` so spreadsheets don't execute guest-entered text.

## Prepared for later

Event-level and meal totals are computed per event already; charts, caterer
exports, and filters can build on `computeDashboardMetrics()` without schema changes.
