# Deployment and configuration

Never paste secret values into chats, issues, docs, or commits. Put them in
`.env.local` (gitignored) locally and in your host's encrypted environment
settings in production.

## Environment variables

| Variable                                                                 | Browser-safe?                      | Where to get it                                                                                                                                                       | Where it goes                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                                               | Yes                                | Supabase Dashboard → **BrakeWedding** → Project Settings → **Data API** → Project URL (also under the **Connect** button). Format `https://<project-ref>.supabase.co` | `.env.local`; host env                                                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                   | Yes (RLS protects data)            | Project Settings → **API Keys** → **Publishable key** (`sb_publishable_…`). The legacy `anon` key (Legacy API Keys tab) also works.                                   | `.env.local`; host env                                                                     |
| `APP_BASE_URL`                                                           | Server-only (not secret)           | You choose: `http://localhost:3000` locally; the final `https://` wedding domain in production                                                                        | `.env.local`; host env                                                                     |
| `SUPABASE_SECRET_KEY`                                                    | **No — server-only, bypasses RLS** | Project Settings → **API Keys** → **Secret keys** → create/reveal (`sb_secret_…`). Legacy `service_role` also works.                                                  | `.env.local` on your machine only (scripts). **Not needed in the hosted app for Phase 1.** |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | **No**                             | Not needed yet — do not create R2 API tokens in Phase 1                                                                                                               | —                                                                                          |

Other values used once, never stored in the repo:

| Value                 | Where to get it                                                                 | Used by                                      |
| --------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| Project ref           | Project Settings → **General** → Project ID (the `<project-ref>` in the URL)    | `npm run db:link -- --project-ref <ref>`     |
| Database password     | Project Settings → **Database** → Database password (reset it there if unknown) | Prompted by `supabase link` in your terminal |
| Supabase access token | Created by `npm run db:login` (browser flow)                                    | Supabase CLI, stored outside the repo        |

## Supabase: link and apply migrations

```bash
npm run db:login
npm run db:link -- --project-ref <project-ref>   # enter the DB password at the prompt
npm run db:push                                  # shows pending migrations, then applies them
npm run db:types                                 # optional: generate types to compare
```

Docker is not required for any of these. (`supabase start` for a full local
stack needs Docker; tests use PGlite instead.)

## Auth configuration (Supabase Dashboard, one time)

These are project settings, not schema, so they aren't in migrations.

1. **Authentication → Sign In / Providers**: keep **Email** enabled; turn **off**
   "Allow new users to sign up". Guests never sign up; admins are created manually.
2. **Authentication → Users → Add user → Create new user** for each of the two
   admins (email + strong password, auto-confirm).
3. Grant admin access: `npm run admin:grant -- <email>` for each.
4. **Authentication → URL Configuration**: Site URL = `http://localhost:3000`
   for now; change to the production domain at launch.
5. Recommended: minimum password length ≥ 12; consider enabling MFA (TOTP) for admins.

## Verify

```bash
npm run verify:remote    # end-to-end backend check; creates and removes temporary data
npm run dev              # then run the manual acceptance test in README.md
```

## Hosting (decision pending)

Recommendation: **Vercel** for the Next.js app (first-class Next.js 16
support, zero config), with DNS for the wedding domain on Cloudflare pointing
at Vercel. Alternative: **Cloudflare Workers** via the OpenNext adapter, which
keeps everything on Cloudflare next to R2. The code avoids host-specific APIs
so either works; choose in the deployment phase.

On the host, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
and `APP_BASE_URL`. `NEXT_PUBLIC_*` values are inlined into the bundle **at build
time**, so they must be present when the host builds (changing them requires a rebuild). Do **not** add `SUPABASE_SECRET_KEY` unless a later feature
needs it.

## Domain (later)

1. Buy/configure the domain in Cloudflare.
2. Point it at the host; enable HTTPS.
3. Set `APP_BASE_URL=https://<domain>` in the host env and redeploy.
4. Update Supabase Auth Site URL / redirect URLs.
5. Admin → Invitations → **Validate all**; print and scan a proof.
6. Only then lock and print production invitations.

## Pre-print checklist

- [ ] `APP_BASE_URL` is the final `https://` domain (no provisional banner in admin)
- [ ] Every invitation has guests and correct event assignments
- [ ] Shared-invitation privacy warnings reviewed
- [ ] **Validate all** shows zero failed / stale / not validated
- [ ] A physical proof was printed and scanned on a phone over cellular data
- [ ] Invitations locked
