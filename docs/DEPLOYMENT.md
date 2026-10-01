# Deployment and configuration

Never paste secret values into chats, issues, docs, or commits. Put them in
`.env.local` (gitignored) locally and in your host's encrypted environment
settings in production.

## Environment variables

| Variable                                                                 | Browser-safe?                      | Where to get it                                                                                                                                                       | Where it goes                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                                               | Yes                                | Supabase Dashboard → **BrakeWedding** → Project Settings → **Data API** → Project URL (also under the **Connect** button). Format `https://<project-ref>.supabase.co` | `.env.local`; production: `cloudflare.config.ts`                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                   | Yes (RLS protects data)            | Project Settings → **API Keys** → **Publishable key** (`sb_publishable_…`). The legacy `anon` key (Legacy API Keys tab) also works.                                   | `.env.local`; production: `cloudflare.config.ts`                                           |
| `APP_BASE_URL`                                                           | Server-only (not secret)           | You choose: `http://localhost:3000` locally; the final `https://` wedding domain in production                                                                        | `.env.local`; production: `cloudflare.config.ts`                                           |
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

## Hosting: Cloudflare Workers, deployed from GitHub

Same setup as the trip planner: everything lives in the Cloudflare account
(brakekodu@gmail.com); GitHub only stores the code.

| Piece                 | What it is                                                                                                                                        | Where in Cloudflare                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Domain                | `kevinandsarina.com`, registered through Cloudflare                                                                                               | Domains → Registrations                     |
| DNS                   | Created automatically by the Worker's custom domains                                                                                              | Domains → kevinandsarina.com → DNS          |
| Website + server code | Worker `wedding-website`, built by [vinext](https://github.com/cloudflare/vinext) from `brakekodu/WeddingWebsite`; every push to `main` goes live | Compute → Workers & Pages → wedding-website |
| Data + admin login    | Supabase project BrakeWedding (unchanged)                                                                                                         | supabase.com                                |
| Photos (later)        | R2 bucket `brake-wedding`                                                                                                                         | Storage & databases → R2                    |

All Worker settings live in `cloudflare.config.ts` (committed): the custom
domains `kevinandsarina.com` + `www.kevinandsarina.com`, `APP_BASE_URL`, and the
two browser-safe Supabase values. There are no dashboard variables to manage,
and no secrets on the Worker. Cost: Workers free plan; only the domain renewal.

### One-time: connect the GitHub repo

1. Fill the two `REPLACE_WITH_…` values in `cloudflare.config.ts` (Supabase
   Project URL and publishable key — both browser-safe), commit, and push.
2. Cloudflare Dashboard → **Compute → Workers & Pages → Create → Import a repository**
   → GitHub → `brakekodu/WeddingWebsite`.
3. Project name `wedding-website`; **Build command:** leave empty;
   **Deploy command:** `npm run deploy`; root directory `/`. Save and deploy.
4. The first deploy attaches `kevinandsarina.com` and `www.kevinandsarina.com`.
   If it reports an existing DNS record for either name, delete that record
   under Domains → kevinandsarina.com → DNS and retry the deploy.
5. Supabase → Authentication → URL Configuration → Site URL
   `https://kevinandsarina.com`.

Until step 1 is done the site still deploys; admin and invitation pages show
"not configured".

### Local commands

`npm run dev` (http://localhost:3000, uses `.env.local`), `npm run build`,
`npm start` (runs the built Worker locally in Cloudflare's runtime), and
`npm run deploy` (manual deploy; needs `npx cf auth login` once).

## Domain

`kevinandsarina.com` is final. `APP_BASE_URL=https://kevinandsarina.com` in
`cloudflare.config.ts` is what every QR code encodes. **Turn on auto-renew**
(Domains → Registrations → kevinandsarina.com → Settings): if the domain ever
lapses, every printed QR code stops working.

Before printing: Admin → Invitations → **Validate all** on the live site; print
and scan a proof; then lock and print.

## Pre-print checklist

- [ ] Live site at https://kevinandsarina.com shows no provisional-domain banner in admin
- [ ] Domain auto-renew is on
- [ ] Every invitation has guests and correct event assignments
- [ ] Shared-invitation privacy warnings reviewed
- [ ] **Validate all** shows zero failed / stale / not validated
- [ ] A physical proof was printed and scanned on a phone over cellular data
- [ ] Invitations locked
