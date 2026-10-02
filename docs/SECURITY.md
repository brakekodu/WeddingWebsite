# Security

## Principles

1. **Row Level Security on every table**, written in the same migration as the table.
2. **Being signed in is not being an admin.** Admin = authenticated user listed in `admin_users`.
3. **Guests have no table access at all.** They reach data only through
   SECURITY DEFINER functions keyed by an invitation token, which return the
   minimum fields for that invitation.
4. **Invitation URLs and RSVP codes are bearer credentials.** Possession = access
   to that one invitation. They are random, unguessable, and not derived from IDs.
5. **No privileged credential reaches a browser.** The app runs Phase 1 without
   the secret key at all.
6. Defense in depth: proxy redirect → layout check → per-action check → RLS.

## Roles and access matrix

| Data                          | anon (guests)               | authenticated, not admin     | admin                         | service role (scripts) |
| ----------------------------- | --------------------------- | ---------------------------- | ----------------------------- | ---------------------- |
| All wedding tables            | **no privileges** (revoked) | RLS: 0 rows, writes rejected | full via RLS                  | full (bypasses RLS)    |
| `rsvp_activity`               | none                        | 0 rows                       | read-only                     | full                   |
| `admin_users`                 | none                        | own row only                 | read                          | full                   |
| `private.*`                   | none (no schema usage)      | `is_admin()` execute only    | `is_admin()` only             | full                   |
| Guest RPCs                    | execute                     | execute                      | execute (not logged as guest) | execute                |
| `regenerate_invitation_token` | **no execute**              | execute → `not_authorized`   | execute                       | execute                |

These rules are tested in `tests/db/security.test.ts` and `tests/db/guest-rpc.test.ts`.

## What a guest can see

`get_invitation(token)` returns, for that invitation only:
guests' first/last/preferred names and dietary restrictions; events at least
one of its guests is assigned to (name, description, time, location, RSVP/meal
flags) with the list of _this invitation's_ assigned guest IDs; active meal
options for meal events; saved answers. It never returns email, phone,
address, notes, household or invitation IDs, other guests, or unassigned events.

**Shared-invitation caveat:** everyone holding one invitation sees all of that
invitation's events. If John (Rehearsal Dinner) and Sarah (not invited) share
an invitation, Sarah can see the Rehearsal Dinner but is not asked to RSVP for
it. The admin invitation page warns when this happens; keep such guests on
separate invitations if an event must stay private.

## Threat model

| Threat                                     | Mitigation                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enumerating invitation URLs                | 144-bit random tokens from pgcrypto's CSPRNG; unknown/void/malformed tokens are indistinguishable (`null`).                                                                                                                                                                                                                                                                    |
| Brute-forcing RSVP codes                   | 31⁸ ≈ 8.5×10¹¹ codes; global throttle: after 50 failed lookups in 10 minutes, all lookups return "throttled". Enforced inside the database function, so it applies even when the public API is called directly. Trade-off: an attacker can temporarily disable code entry (QR links keep working). Future: per-IP rate limiting at the edge (Cloudflare WAF) and/or Turnstile. |
| Token leakage via Referer / search engines | `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex` on `/i/*`, `/rsvp`, `/admin/*`; `robots.txt` disallows them; pages set `noindex`.                                                                                                                                                                                                                                   |
| Leaked or shared invitation link           | Bearer by design (acceptable for a wedding). An unlocked invitation can be rotated (`Regenerate link and code`); any invitation can be voided.                                                                                                                                                                                                                                 |
| Guest tampering with RSVP payloads         | `submit_rsvp` re-validates every guest, event, and meal against the invitation; client-side checks are UX only.                                                                                                                                                                                                                                                                |
| Over-broad reads for convenience           | Anon has no table privileges; only purpose-built RPCs.                                                                                                                                                                                                                                                                                                                         |
| Any Supabase user acting as admin          | `admin_users` allowlist checked by RLS (`private.is_admin()`) and the app. Public sign-ups disabled in Auth settings.                                                                                                                                                                                                                                                          |
| Admin privilege escalation via API         | No INSERT/UPDATE/DELETE policies or grants on `admin_users` for API roles.                                                                                                                                                                                                                                                                                                     |
| Forged credential values                   | DB ignores client-supplied tokens on insert and rejects direct updates.                                                                                                                                                                                                                                                                                                        |
| Admin-session CSRF on Server Actions       | Next.js Server Actions require POST with Origin checking; SameSite auth cookies.                                                                                                                                                                                                                                                                                               |
| Clickjacking                               | `X-Frame-Options: DENY`, `frame-ancestors 'none'`.                                                                                                                                                                                                                                                                                                                             |
| CSV/formula injection from guest text      | CSV export prefixes `= + - @` cells with `'`.                                                                                                                                                                                                                                                                                                                                  |
| XSS                                        | React escaping; the only `dangerouslySetInnerHTML` is our generated QR SVG (built from a fixed character set, titles XML-escaped).                                                                                                                                                                                                                                             |
| Secret leakage in git                      | `.gitignore` excludes `.env*` (except `.env.example`), keys, Supabase temp files.                                                                                                                                                                                                                                                                                              |
| Secret leakage to the browser              | Secret key has no `NEXT_PUBLIC_` prefix and its module imports `server-only` (build error if imported client-side).                                                                                                                                                                                                                                                            |
| Unwanted tracking                          | Activity log stores type, actor, time only — no IP, UA, or fingerprinting; access events are deduplicated.                                                                                                                                                                                                                                                                     |

## Credentials: where each lives

| Credential                | Where it lives                                                   | Browser-safe?           | Phase 1 needed?        |
| ------------------------- | ---------------------------------------------------------------- | ----------------------- | ---------------------- |
| Supabase URL              | `.env.local` / host env: `NEXT_PUBLIC_SUPABASE_URL`              | yes                     | yes                    |
| Publishable (anon) key    | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                           | yes (RLS protects data) | yes                    |
| Secret (service-role) key | `SUPABASE_SECRET_KEY` in `.env.local` on your machine            | **no**                  | only for `scripts/`    |
| Database password         | Typed into `supabase link` prompt; not stored in the repo        | **no**                  | for linking            |
| Supabase access token     | Created by `supabase login`; stored by the CLI outside the repo  | **no**                  | for CLI                |
| R2 access key / secret    | (future) `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, server-only | **no**                  | no — do not create yet |
| Cloudflare API token      | not used                                                         | **no**                  | no                     |

If the secret key is ever exposed: Supabase Dashboard → Project Settings →
API Keys → roll/revoke it, then update `.env.local`.

## Cloudflare R2

- The `brake-wedding` bucket stays private; never enable public access on the whole bucket.
- Uploads (future guest uploads) only via short-lived (≤15 min) presigned PUT
  URLs for one server-chosen key under `guest-uploads/`, issued after the
  server authorizes the request (e.g. valid invitation token, size/type limits).
- Object keys are built server-side from a safe character set (`buildObjectKey`), so clients cannot write outside their prefix.
- R2 API tokens (when needed) are bucket-scoped with minimal permissions and server-only.
- Public display of guest uploads requires moderation (later phase).

## Admin photo uploads

- Upload and crop endpoints (`/admin/photos/upload`, `/admin/photos/placement`)
  require an admin session; the proxy also redirects signed-out requests.
- Every storage key is generated on the server; the browser never chooses a path.
- Each file is size-limited (20 MB) and must carry a real WebP/JPEG signature.
- `/media/[...key]` serves only `site/photos/…` and `site/crops/…` keys; other
  prefixes (e.g. future `guest-uploads/`) are not readable through it.
- Uploaded photos are re-encoded in the browser, which drops camera metadata
  including GPS location.

## Known gaps / future hardening

- Per-IP rate limiting for `/rsvp` and RSVP submission (edge/WAF), optionally Turnstile.
- Content-Security-Policy with nonces (currently only `frame-ancestors`).
- MFA for the two admin accounts (Supabase Auth TOTP).
- Hosted Auth settings (sign-ups off, password length) are dashboard configuration; re-check them before launch.
