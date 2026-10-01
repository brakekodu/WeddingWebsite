# Brake Wedding — design handoff for Claude Code

Low-fidelity wireframes + IA for the wedding website and guest-management platform.
Use these as the **source of truth for structure, routes, content and behavior**. Visual polish (final fonts, photography, monogram) comes later; the color palette below is approved.

## What's in this folder

| Path | What it is |
|---|---|
| `wireframes/*.html` | One standalone HTML file per screen. Open in a browser. Treat as layout/content reference, not production code. |
| `png/*.png` | Screenshot of every screen, same numbering. |
| `Brake-Wedding-IA-Wireframes.pdf` | All 27 screens in one PDF. |
| `canvas.json` | Screen list with frame sizes, grouped by page. |

Screen numbering: 01–02 sitemap & flows · 03–13 guest mobile · 14–19 public/guest desktop · 20–25 admin · 26 components · 27 open questions.

Note: the wireframes reference IBM Plex via Google Fonts; screenshots were rendered with fallback fonts.

## Three experiences

1. **Public site (no login)** — shows public events only.
2. **Personalized guest portal** — `/i/{token}` from the invitation QR, or `/rsvp` code entry. No accounts.
3. **Admin portal** — `/admin`, signed-in couple only. Desktop first.

## Routes

### Public
- `/` Home — hero + countdown, welcome, story preview, weekend preview (**public events only**), travel preview, gallery strip, registry, FAQ preview, RSVP CTA
- `/story` Our Story (includes the Wedding Party section)
- `/weekend` Wedding Weekend — public events; with a token it shows the guest's personal schedule
- `/travel` Travel & Stay — hotels/room blocks, getting there, getting around, things to do (one page, anchors)
- `/gallery` Gallery — engagement photos; guest uploads later (moderated)
- `/registry` Registry — external links only, no cart
- `/faq` FAQ
- `/rsvp` Find your invitation — 6-char code → redirects to `/i/{token}`. **No name search.**
- Utility: 404, invalid/revoked invitation page (code entry + contact; never reveals whose link it was)

### Personalized — `/i/{token}` (one URL whose content depends on state)
- **A · Not responded** → welcome landing ("Welcome, John & Sarah", date, venue, respond-by, Begin RSVP)
- **RSVP flow** `/i/{token}/rsvp` steps: 1 Attendance → 2 Events → 3 Meals* → 4 Dietary (optional) → 5 Review → Confirmation
  - *Meals step only if a guest attends an event with `requires_meal`
- **B · Responded** → portal: your RSVP + Edit, your weekend (only invited events, who's attending each), meals, travel/hotel, registry, FAQ
- **C · Wedding week** (date window from Settings) → Next-up event card first, announcements, transport, full schedule, photo upload (later)
- **D · After RSVP deadline** → read-only RSVP + "contact us"
- Public pages opened with a token show a "Viewing as John & Sarah" pill to return to the portal

### Admin
- `/admin/login`
- `/admin` Dashboard — metrics, RSVP progress, needs attention, event attendance, meal counts, dietary, invitations & QR health, activity
- `/admin/guests` — table, search, filter chips (All / Attending / Declined / No response / Missing meal / Dietary), detail drawer, "Record RSVP" on a guest's behalf
- `/admin/households` — list + detail with **guest × event invitation grid**
- `/admin/invitations` — Generate, Validate all, Print/Export all (**blocked unless every selected invitation is Validated + Locked**)
- `/admin/invitations/{id}` — QR panel, fallback code, URL, validation checklist, test print, lock, lifecycle stepper
- `/admin/events` — configurable events, visibility (Public / Invite-only / Draft), requires-meal + meal options, counts, guest list
- `/admin/responses` — tabs: Activity · By event · Meals · Dietary · exports (replaces separate RSVPs/Meals pages)
- `/admin/photos` (later), `/admin/settings` (wedding details, RSVP deadline, wedding-week dates, announcements, site content, admins)

## RSVP behavior rules
- Step 1: per guest, Accept / Decline (plus-one: optional name + yes/no).
- Step 2: only guests who accepted, only events each guest is invited to; Yes/No per guest × event.
- Everyone declines → skip to Review → "We'll miss you" confirmation.
- Nothing saved until Submit; draft kept on device; Back keeps answers.
- Validation: Continue stays enabled; tapping scrolls to first unanswered guest with a text error.
- Submit failure keeps answers: "We couldn't save your RSVP — your answers are still here. Try again."
- Edit later re-enters at Review with answers prefilled.
- Goal: QR scan → submitted in 1–2 min on a phone, no typing on the happy path.

## Invitation lifecycle
Draft → Generated (token + code) → Validated → Test printed → Locked → Printed.
Validation checks: token resolves to the household · URL loads over HTTPS · QR in the print file decodes to the exact URL · fallback code unique and resolves · every guest has ≥1 event · greeting name present · (manual) test print scanned on paper.
Lock freezes token, code and print layout; guests/events can still change. Tokens never change once printed.

## Data assumptions to confirm against the architecture
A. Responses stored **per guest × event**, never per household.
B. Event invitations per guest (mixed households allowed).
C. Guest-level "attending" flag from step 1 — stored or derived?
D. Meal per guest per meal-event; dietary per guest.
E. Tokens permanent once printed; revocable.
F. Fallback code: 6 chars, no look-alike characters (0/O, 1/I), unique, rate-limited lookups.
G. Invite-only events filtered **server-side** — never in public HTML/API.
H. Portal state computed from RSVP status + deadline + wedding-week dates.
I. Invitation lifecycle + validation checks as above.
J. Audit trail: who changed an RSVP (guest/admin) and when.
K. Partial saves: device-only until Submit, or server-side per step?

## Palette (from the florist inspiration board)
```css
:root{
  --plum:#6F5A8F;      /* primary buttons, selected states, badges */
  --plum-hover:#4F3E69;
  --plum-deep:#3B2F4A; /* dark bands */
  --ink:#2E2638;       /* body text */
  --muted:#5E5468;     /* secondary text */
  --wisteria:#8E7BAA;  /* control borders */
  --mist:#DCD2E6;      /* dividers, panel borders */
  --lilac:#F1EAF6;     /* page ground */
  --cream:#FBF8F2;     /* soft sections */
  --sage:#5F7A5B;      /* success, validated */
  --error:#8F1D1D;
}
```

## Accessibility (required)
- Touch targets ≥44px; real `<button>`/`<a>`/`<label>`.
- Status never color-only: symbol + word (✓ Attending, ✕ Declined, ○ No response, ! Missing, ■ Locked).
- Text contrast ≥4.5:1; error messages in text with `role="alert"`.
- Loading, empty, error and success states for every list, form and submit.

## Open questions (need the couple's input)
See screen 27. Key ones: skip the per-event step for ceremony+reception-only invites? · plus-one rules · kids/kids meal · read-only after deadline? · public venue addresses? · admin roles · batch printing · print/export format · reminders · wedding-week start date · photo moderation.
