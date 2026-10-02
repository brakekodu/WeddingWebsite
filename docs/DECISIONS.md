# Decisions

Short records of choices with long-term consequences. Add new entries at the end.

### D1 — Next.js (App Router) + TypeScript

One framework for the public site, personalized server-rendered pages (SEO for
public pages, no client-side data fetching for guests), Server Actions for
forms, and route handlers for exports. Widely known, which helps AI-assisted
maintenance. Next.js 16: `proxy.ts` replaces middleware; request APIs are async.

### D2 — Supabase with RLS for admins, SECURITY DEFINER RPCs for guests

Admins query tables directly under RLS (`private.is_admin()`). Guests get **no**
table privileges; four narrow functions take the token and return/validate only
that invitation's data. This keeps "never expose broad SELECT on guests" true
by construction, and puts the authorization rules next to the data where they
are tested.

### D3 — No privileged key in the running app (Phase 1)

Everything the app does works with the publishable key plus either the admin's
session or a guest's token. The secret key is used only by local scripts.
Smaller blast radius if the host environment leaks.

### D4 — Credentials generated in the database

Tokens (18 random bytes → 24 base64url chars, 144 bits) and RSVP codes (8 chars,
31-letter unambiguous alphabet) are created by a trigger using pgcrypto, so every
insert path gets a strong value and clients cannot choose one. Codes are short
enough to type; brute force is countered by a global DB-side throttle (D15).

### D5 — Canonical URL derived from `APP_BASE_URL`

Only the token is stored. The production domain is unknown, so the QR URL is
computed at render time; validation stores the exact URL it validated so a
domain change shows as "stale" rather than silently passing.

### D6 — Lock is one-way; printed requires lock + validation

Enforced in a trigger, not just the UI. Prevents the one unrecoverable mistake:
reprinting or changing a token after invitations are in the mail.

### D7 — QR validation decodes the same modules that are printed

The SVG and the decode raster come from one matrix, and resolution goes through
the public RPC a phone would use. Pure JS (`qrcode`, `jsqr`), no native canvas,
so it runs on any host.

### D8 — Event times as venue-local wall-clock + IANA zone

`timestamp without time zone` + `time_zone`. "4:00 PM" displays as 4:00 PM for
every guest everywhere; the zone is kept for future calendar files.

### D9 — Dietary restrictions per guest, meals per guest per event

Allergies don't change between dinners, so `guests.dietary_restrictions` is the
single place for them (guest-editable via RSVP). `meal_selections` holds the
meal choice per (guest, event) with FK guarantees that the meal belongs to the event.

### D10 — Hosting: Cloudflare Workers via vinext, deployed from GitHub

Mirrors the couple's other site: one Cloudflare account holds the domain, DNS,
hosting, and R2; Cloudflare builds from GitHub on every push to `main`.
Cloudflare's recommended path for Next.js is vinext (the Next.js API on Vite),
which ran this app unchanged (`vinext check`: no app-code issues; full guest
RSVP flow verified in the Workers runtime). Supabase stays as the database and
admin login — already built and tested; moving to D1/Access would be a rewrite.
Worker config, custom domains, and non-secret settings live in
`cloudflare.config.ts`; no secrets on the Worker. No CDN caching: every page is
personalized or admin. `next` stays installed only for `next typegen` types.

### D11 — Database tests on PGlite

Docker isn't installed. PGlite runs real Postgres in-process; a small harness
recreates Supabase's roles, grants, and `auth.uid()`, so RLS and RPC behavior
are tested on every `npm test`. `npm run verify:remote` covers the hosted project.

### D12 — Hand-written DB types until the CLI is linked

Mirrors the migrations in Supabase's generated format so queries are typed now.
After linking, `npm run db:types` produces generated types to reconcile.

### D13 — R2 via S3 API with `aws4fetch`; nothing wired yet

Tiny, runtime-agnostic SigV4 presigning. Private bucket, logical prefixes,
presigned URLs ≤ 15 min. No R2 credentials until a feature needs them.

### D14 — Event visibility is the union of an invitation's guests' assignments

A shared invitation shows any event assigned to any of its guests, but only asks
each person about their own events. Simpler than per-person sub-links; the admin
page warns when a shared invitation would reveal an event to someone not invited.

### D15 — Global (not per-IP) throttle for RSVP code lookups

The lookup function is callable through the public API, so the throttle must
live in the database, where the caller's IP isn't trustworthy. Global limiting
makes brute force infeasible; the trade-off (temporary denial of code entry) is
acceptable because QR links are unaffected. Edge rate limiting can be added later.

### D16 — Postgres enums for statuses

Generated types become precise unions. Adding a value is a simple migration;
removing one is rare.

### D17 — Production domain kevinandsarina.com

Apex is canonical: `APP_BASE_URL=https://kevinandsarina.com` (shorter QR).
`www` is attached too so typed URLs work. Tokens never embed the domain.
Auto-renew must stay on — a lapsed domain breaks every printed QR code.

### D18 — Design handoff is the source of truth for the guest site

`design/brake-wedding-handoff/` (wireframes, flows, components, palette) defines
routes, content, and behavior. Where the handoff left a question open (screen 27),
we built the default it drew; see "Open questions — defaults used" below.

### D19 — 6-character RSVP codes

Per the handoff. 31⁶ ≈ 887M codes; with the global DB-side throttle (D15)
brute force is still impractical. Earlier 8-character codes remain valid.

### D20 — Website text lives in `src/content/site.ts` (for now)

Names, story, travel, registry links, and FAQ are typed content in one file —
simple, versioned, and deployed on push. Behavior settings that must be
enforced (RSVP deadline) live in the database. Editing site text from
Admin → Settings is planned with the admin redesign.

### D21 — "Viewing as" via an httpOnly cookie

Opening `/i/{token}` stores the same bearer token in an httpOnly, SameSite=Lax
cookie so public pages can personalize. It grants nothing beyond the link
itself; "Not you?" clears it.

### Open questions (handoff screen 27) — defaults used

1 Both steps always (attendance, then events). · 2 Ceremony and reception are
separate lines. · 3 Plus-one: optional name, then a full guest. · 4 Kids: no
special handling yet. · 5 One person answers for the whole invitation. ·
6 Desktop shows "Not invited"; mobile hides. · 7 Read-only after the deadline. ·
8 Email optional; no emails are sent yet. · 9 One optional note, on the dietary
step. · 10 Addresses shown for public events only. · 11 Wedding Party merged
into Our Story; 6 nav links. · 12 No site-wide password. · 18–19 Wedding-week
mode and photo uploads deferred.

### D22 — Photos are managed in the admin, stored in R2 via a Worker binding

Admins swap and crop every photo on the site. Images are resized and cropped in
the browser (no paid image service, no native modules in the Worker), stored in
R2 through the Worker's binding (no access keys), and served by `/media/...`.
Spots without a choice fall back to the bundled engagement photos, so the site
always renders even before the database is set up. Banners get separate
desktop/phone crops (art direction via `<picture>`).
