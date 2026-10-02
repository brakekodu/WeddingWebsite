# Architecture

## Overview

```
                 ┌──────────────────────────── Next.js app ─────────────────────────────┐
 Guest phone ──► │ /i/[token]  /rsvp            (Server Components + Server Actions)     │
 (no account)    │      │  publishable key, no session                                     │
                 │      ▼                                                                  │
                 │  supabase.rpc(get_invitation | submit_rsvp | resolve_rsvp_code | …)     │──► Supabase Postgres
                 │                                                                         │    SECURITY DEFINER functions
 Couple ───────► │ /admin/*   proxy.ts (session refresh) → layout requireAdminPage()      │    validate token → return only
 (2 admins)      │      │  publishable key + admin's session cookie                        │    that invitation's data
                 │      ▼                                                                  │
                 │  supabase.from(...)  ── every query filtered by RLS (is_admin()) ──────│──► Tables (RLS on all)
                 └─────────────────────────────────────────────────────────────────────────┘
                                         (later) presigned URLs ──► Cloudflare R2 `brake-wedding`
```

There is one deployable unit: the Next.js app. Supabase provides Postgres,
Auth, and the Data API (PostgREST). Cloudflare R2 will hold media in later phases.

## Request flows

**Guest opens an invitation** (`/i/{token}`):

1. `src/app/i/[token]/page.tsx` calls `get_invitation(token)` through the
   cookie-aware server client.
2. The function validates the token format, finds a non-void invitation,
   logs `invitation_accessed` (deduplicated; skipped for admins), and returns a
   guest-safe JSON view: names, assigned events, active meal options, saved answers.
3. The page renders the greeting; `rsvp-experience.tsx` (client) runs the
   multi-step flow. Submit calls the `submitRsvp` Server Action → `submit_rsvp`
   RPC, which validates everything again in the database.

**Guest types a code** (`/rsvp`): `resolve_rsvp_code(code)` (globally throttled)
returns the token; the server redirects to `/i/{token}`.

**Admin**: `src/proxy.ts` refreshes the Supabase session and redirects
signed-out visitors to `/admin/login`. `admin/(protected)/layout.tsx` calls
`requireAdminPage()`, which verifies the JWT (`getClaims`) and requires a row in
`admin_users`. Every Server Action calls `requireAdmin()` again via
`runAdminAction()`. RLS enforces the same rule in the database, so a bug in any
one layer does not expose data.

## Supabase clients

| Module                       | Key         | Session          | RLS          | Use                                                                 |
| ---------------------------- | ----------- | ---------------- | ------------ | ------------------------------------------------------------------- |
| `src/lib/supabase/client.ts` | publishable | user's (browser) | yes          | Browser code (unused in Phase 1)                                    |
| `src/lib/supabase/server.ts` | publishable | user's (cookies) | yes          | Server Components, Actions, Route Handlers — everything in Phase 1  |
| `src/lib/supabase/admin.ts`  | **secret**  | none             | **bypassed** | Server-only, `import "server-only"`; not used at runtime in Phase 1 |

`scripts/` construct their own secret-key client for local operational tasks.

## Code map

| Path                                 | Responsibility                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `src/lib/invitations/credentials.ts` | Token/code formats, normalization, display                                       |
| `src/lib/invitations/url.ts`         | `APP_BASE_URL` canonicalization, `/i/{token}` URLs, provisional-domain detection |
| `src/lib/invitations/qr.ts`          | QR matrix → SVG (display/print) and → RGBA (decode)                              |
| `src/lib/invitations/validation.ts`  | The six QR validation checks (pure, injected lookups)                            |
| `src/lib/invitations/server.ts`      | Server glue: RPC view fetch, run + persist validation                            |
| `src/lib/rsvp/flow.ts`               | RSVP steps, draft state, payload construction (pure)                             |
| `src/lib/dashboard/metrics.ts`       | Dashboard metric definitions (pure)                                              |
| `src/lib/admin/actions.ts`           | Admin Server Action wrapper, FormData parsing, DB error mapping                  |

Business rules that can be pure functions are, and are unit-tested. Rules that
protect data live in the database and are tested with PGlite (`tests/db/`).

## Rendering

Admin pages and `/i/*` are dynamic (per request, never cached). `/`, `/rsvp`,
and `robots.txt` are static. Security headers are set in `next.config.ts`
(no framing, `no-referrer` + `noindex` on invitation/admin routes).

## Cloudflare R2

The existing bucket `brake-wedding` (Eastern North America, Standard) will be
holds website photos uploaded from Admin → Photos. The Worker reaches it through a
**binding** (`MEDIA` in `cloudflare.config.ts`), so there are no R2 access keys.
Files live under `site/photos/<id>/` (master + full sizes) and
`site/crops/<spot>/<position>/<variant>-<nonce>-<width>` (each saved crop gets
new names, so caches never show an old crop). Browsers fetch them through
`/media/[...key]`, which serves only those shapes of key with long-lived caching.
Supabase tables `site_photos` / `site_placements` record which photo is where.
Photos are resized and cropped in the admin's browser (`src/lib/media/client-images.ts`)
before upload.

Logical prefixes (one bucket, separated by key prefix):

| Prefix           | Contents (future)                        | Access                                                 |
| ---------------- | ---------------------------------------- | ------------------------------------------------------ |
| `site/`          | Site imagery (hero, backgrounds)         | Public read via a custom domain or cached route        |
| `engagement/`    | Engagement photos                        | Public read (curated)                                  |
| `wedding/`       | Professional wedding photos              | Public or link-restricted read                         |
| `guest-uploads/` | Photos uploaded by guests                | Write via presigned PUT only; moderated before display |
| `gallery/`       | Curated post-wedding gallery derivatives | Public read                                            |

Design rules (implemented in `src/lib/storage/r2.ts`):

- The bucket is **not** public. Public assets will be exposed deliberately
  (custom domain on specific prefixes, or a server route), never by flipping the bucket.
- Browsers never hold R2 credentials. The server authorizes an action (e.g. a
  guest with a valid invitation token uploading one photo), builds a key under a
  known prefix with `buildObjectKey()` (safe characters only; no traversal), and
  returns a **presigned URL** valid ≤ 15 minutes for exactly that object and
  content type.
- R2 API tokens, when created, will be scoped to this bucket with the minimum
  permission needed (Object Read & Write), stored server-only.

## Hosting

Cloudflare Workers, Worker `wedding-website`, built with vinext (the Next.js API on
Vite) and deployed by Cloudflare from GitHub on every push to `main`. Custom
domains `kevinandsarina.com` and `www.kevinandsarina.com` are declared in
`cloudflare.config.ts`. Supabase remains the database and auth provider; the
Worker calls it over HTTPS. See DEPLOYMENT.md and DECISIONS.md D10.
