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

### D10 — Hosting deferred; Vercel recommended

Not needed until the deployment phase. Vercel is the lowest-friction Next.js
host; Cloudflare (OpenNext) is a viable alternative given the domain and R2.
Code avoids host-specific APIs.

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
