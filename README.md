# Brake Wedding Platform

A custom wedding platform: a protected admin app for the couple, personalized
invitation pages with QR codes, and a guest RSVP flow. Guests never create
accounts — each printed invitation carries a QR code (and a short fallback code)
that opens their personal RSVP page.

**Status:** foundation, invitation/RSVP system, and the guest-facing site from
the design handoff (`design/brake-wedding-handoff/`) are built. Content still has
[bracketed placeholders] in `src/content/site.ts`. Admin redesign, wedding-week
mode, photo uploads, and bulk printing are later phases.

## Stack

| Concern               | Choice                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| App                   | Next.js 16 (App Router) + React 19 + TypeScript                                                |
| Styling               | Tailwind CSS 4                                                                                 |
| Database / auth       | Supabase (Postgres + Auth), Row Level Security on every table                                  |
| Schema changes        | Version-controlled SQL in `supabase/migrations/` via the Supabase CLI                          |
| QR codes              | `qrcode` (generate) + `jsqr` (decode for validation) — pure JS                                 |
| Hosting               | Cloudflare Workers (via vinext), auto-deployed from GitHub `main`; domain `kevinandsarina.com` |
| Media storage (later) | Cloudflare R2 bucket `brake-wedding`, presigned URLs via `aws4fetch`                           |
| Tests                 | Vitest; database/RLS tests run on PGlite (in-process Postgres, no Docker)                      |

Why these choices: [docs/DECISIONS.md](docs/DECISIONS.md).

## Quick start

Requires Node.js ≥ 20.9 (developed on 24) and npm.

```bash
npm install
cp .env.example .env.local      # then fill in values — see below
npm run dev                     # http://localhost:3000
```

Without Supabase values the site builds and runs, but admin and invitation
pages will tell you configuration is missing.

### One-time Supabase setup

Full detail, including where to find each value: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

1. **Fill `.env.local`** with `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and
   `APP_BASE_URL=http://localhost:3000`.
2. **Link the CLI to the existing `BrakeWedding` project and push migrations**
   (you'll be prompted for things in your own terminal — never paste them into chat):
   ```bash
   npm run db:login                               # opens a browser to authorize the CLI
   npm run db:link -- --project-ref <project-ref> # prompts for the database password
   npm run db:push                                # applies supabase/migrations/*
   ```
3. **Auth settings** in the Supabase Dashboard: turn off public sign-ups and
   create the two admin users (see DEPLOYMENT.md → "Auth configuration").
4. **Grant admin access** to each admin user:
   ```bash
   npm run admin:grant -- you@example.com
   ```
5. **Verify the backend end to end** (creates and deletes temporary test data):
   ```bash
   npm run verify:remote
   ```

## Commands

| Command                                     | What it does                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`                               | Development server (vinext/Vite, http://localhost:3000)                                 |
| `npm run build` / `npm start`               | Build the Cloudflare Worker / run it locally in Cloudflare's runtime                    |
| `npm run deploy`                            | Build + deploy to Cloudflare (runs automatically on every push to `main`)               |
| `npm run typecheck`                         | Generate Next route types, then `tsc --noEmit`                                          |
| `npm run lint`                              | ESLint                                                                                  |
| `npm run format` / `format:check`           | Prettier write / check                                                                  |
| `npm test`                                  | All tests (unit + database/RLS on PGlite)                                               |
| `npm run test:watch`                        | Tests in watch mode                                                                     |
| `npm run check`                             | typecheck + lint + format:check + test                                                  |
| `npm run db:login` / `db:link` / `db:push`  | Supabase CLI: authorize, link project, apply migrations                                 |
| `npm run db:migration -- <name>`            | Create a new timestamped migration file                                                 |
| `npm run db:types`                          | Generate DB types from the linked project into `src/lib/supabase/database.generated.ts` |
| `npm run admin:grant -- <email> [--revoke]` | Grant/revoke admin access (uses the secret key locally)                                 |
| `npm run verify:remote`                     | End-to-end backend check of the Phase 1 slice against Supabase                          |

## Phase 1 acceptance test (manual, in the browser)

After setup, sign in at `/admin/login` and:

1. **Households** → create "Smith Household" → add guests John Smith and Sarah Smith.
2. **Events** → create "Ceremony" (RSVP on) and "Reception" (RSVP + meal selection on) → add meal options to Reception.
3. On each event, check John and Sarah in **Invited guests** → Save.
4. Back on the household → **Create invitation for all household guests** (token, RSVP code, and QR are generated).
5. On the invitation → **Preview invitation** → see "Welcome, John & Sarah." → Begin RSVP → answer, choose meals, add dietary notes → Submit.
6. **Dashboard** → responses, attending, meal totals, and dietary list update.
7. Invitation → **Validate QR** → all six checks pass.
8. **Print single invitation** → print a proof → scan its QR code with a phone (the phone must be able to reach `APP_BASE_URL`; `localhost` only works on the same machine).

## Project structure

```
src/
  app/
    (site)/                  public site: home, story, weekend, travel, gallery, registry, faq, rsvp
    i/[token]/               personalized invitation portal; rsvp/ = the RSVP flow
    forget-invitation/       "Not you?" (clears the remembered invitation)
    admin/login/             admin sign-in
    admin/(protected)/       all admin pages (layout enforces admin)
      dashboard/ households/ guests/ events/ invitations/ export/
  components/site/           guest-site components (header, event/hotel/registry cards, FAQ)
  components/ui/             admin UI primitives
  content/site.ts            ALL website text — fill in the [placeholders] here
  lib/
    supabase/                browser, server, and privileged clients; DB types
    auth/admin.ts            admin authorization
    invitations/             credentials, URLs, QR, validation, greeting
    rsvp/                    guest view schema, flow logic, error messages
    dashboard/metrics.ts     dashboard definitions (pure, tested)
    storage/r2.ts            R2 foundation (unused in Phase 1)
  proxy.ts                   session refresh + admin redirect (Next 16 "proxy")
supabase/
  config.toml                CLI config (local stack)
  migrations/                schema + RLS + guest RPC functions
scripts/                     admin:grant, verify:remote
tests/db/                    migration + RLS + RPC tests (PGlite)
docs/                        architecture, database, security, flows, deployment, decisions
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — how the pieces fit, including R2
- [Database](docs/DATABASE.md) — entities, constraints, migrations workflow
- [Security](docs/SECURITY.md) — RLS, threat model, credential handling
- [Invitation system](docs/INVITATION-SYSTEM.md) — tokens, codes, QR, validation, printing
- [RSVP flow](docs/RSVP-FLOW.md) — the guest experience and what gets stored
- [Admin dashboard](docs/ADMIN-DASHBOARD.md) — admin pages and metric definitions
- [Deployment](docs/DEPLOYMENT.md) — environment variables, Supabase, hosting, domain
- [Decisions](docs/DECISIONS.md) — why things are the way they are

## Security rules for contributors

- Never commit `.env*` files other than `.env.example` (placeholders only).
- `SUPABASE_SECRET_KEY` and R2 keys are server-only; never prefix them with `NEXT_PUBLIC_`.
- All schema changes go through `supabase/migrations/` with RLS in the same migration.
- Guests never get table access; guest data flows only through the RPC functions.
