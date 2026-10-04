# Church Management System

A multi-tenant church management platform built for churches in Kenya/East Africa. It combines a public marketing site with authenticated admin and member dashboards, where each user can belong to one or more churches with a role that controls what they can see and do.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Available Scripts](#available-scripts)
- [Authentication and Roles](#authentication-and-roles)
- [Database](#database)
- [Continuous Integration](#continuous-integration)

## Overview

The app is organized around **churches** and **memberships**:

- A user authenticates with Supabase Auth (email + password).
- After verifying their email, they complete onboarding by creating a church or joining an existing one.
- Each membership carries a role: `super_admin`, `dept_admin`, or `member`.
- Row Level Security (RLS) in Postgres enforces tenant isolation, so a user only sees the churches and memberships they belong to.

Highlights:

- Public site: landing page, features, pricing, church directory, events, sermons, prayer wall, focus mode, about, and contact.
- Auth flow: register, email verification, login, forgot/reset password, onboarding.
- Admin area: dashboard with a church switcher for users who belong to multiple churches.
- Member area: personal home screen with a daily scripture.
- Integrations (scaffolded): Africa's Talking (SMS), M-Pesa Daraja (payments), Google Maps, Resend (email), and Sentry.

## Tech Stack

| Area      | Technology                                                        |
| --------- | ----------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack, React Server Components)       |
| Language  | TypeScript (strict)                                               |
| UI        | React 19, Tailwind CSS v4, Base UI + shadcn-style components      |
| Backend   | Supabase (Postgres, Auth, Row Level Security) via `@supabase/ssr` |
| Monorepo  | Turborepo + pnpm workspaces                                       |
| Tooling   | ESLint, Prettier, Husky, lint-staged                              |

## Project Structure

```
.
├── apps/
│   └── web/                     # Next.js application
│       ├── src/app/             # App Router routes (see below)
│       ├── src/components/      # App-level components (layout, auth, public)
│       ├── src/lib/             # Supabase clients, hooks, services, helpers
│       ├── src/types/           # Generated Supabase database types
│       ├── .env.example         # Template for required environment variables
│       └── next.config.ts
├── packages/
│   ├── ui/                      # Shared Base UI / shadcn-style components
│   ├── config/                  # Reserved for shared config
│   ├── types/                   # Reserved for shared types
│   └── utils/                   # Reserved for shared utilities
├── supabase/
│   └── migrations/              # SQL schema, enums, triggers, and RLS policies
├── .github/workflows/ci.yml     # Lint, typecheck, and build on pull requests
├── turbo.json                   # Turborepo task pipeline
└── pnpm-workspace.yaml
```

### Route groups (`apps/web/src/app`)

| Group           | Purpose                                     | Example routes                                                                                  |
| --------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `(public)`      | Public, unauthenticated pages               | `/`, `/features`, `/pricing`, `/churches`, `/events`, `/sermons`, `/prayer-wall`, `/focus-mode` |
| `(auth)`        | Authentication and onboarding               | `/login`, `/register`, `/verify`, `/forgot-password`, `/onboarding`                             |
| `(admin)`       | Church administration (admins only)         | `/admin/dashboard`                                                                              |
| `(member)`      | Member area                                 | `/member/home`                                                                                  |
| `auth/callback` | Supabase auth code exchange (route handler) | `/auth/callback`                                                                                |

Route protection is implemented in `apps/web/src/proxy.ts` (Next.js 16 Proxy, formerly Middleware). It guards `/admin` and `/member`, redirects unauthenticated users to `/login`, and enforces that `/admin` requires an admin role.

## Prerequisites

- **Node.js >= 20** (see `engines` in the root `package.json`)
- **pnpm 9** — the repo pins `packageManager: pnpm@9.0.0`
  ```bash
  corepack enable
  corepack prepare pnpm@9.0.0 --activate
  # or: npm install -g pnpm@9
  ```
- **Supabase** — either a hosted project or the local Supabase CLI stack
- Optional: Docker (required by `supabase start` for the local stack)

## Environment Variables

Create `apps/web/.env.local` (copy the template and fill in real values):

```bash
# macOS / Linux
cp apps/web/.env.example apps/web/.env.local
```

```powershell
# Windows (PowerShell)
Copy-Item apps/web/.env.example apps/web/.env.local
```

| Variable                               | Required | Description                        |
| -------------------------------------- | -------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes      | Supabase project URL               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes      | Supabase publishable (anon) key    |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`      | No       | Google Maps for church locations   |
| `AFRICAS_TALKING_API_KEY`              | No       | Africa's Talking SMS API key       |
| `AFRICAS_TALKING_USERNAME`             | No       | Africa's Talking username          |
| `MPESA_CONSUMER_KEY`                   | No       | Safaricom Daraja consumer key      |
| `MPESA_CONSUMER_SECRET`                | No       | Safaricom Daraja consumer secret   |
| `MPESA_PASSKEY`                        | No       | Safaricom Daraja passkey           |
| `MPESA_SHORTCODE`                      | No       | Safaricom paybill / till number    |
| `RESEND_API_KEY`                       | No       | Resend transactional email API key |
| `NEXT_PUBLIC_SENTRY_DSN`               | No       | Sentry DSN for error reporting     |
| `SENTRY_AUTH_TOKEN`                    | No       | Sentry auth token for source maps  |

Only the first two are needed to boot the app and sign in. The rest enable optional integrations.

## Running Locally

### 1. Install dependencies

From the repository root:

```bash
pnpm install
```

### 2. Set up the database

**Option A — hosted Supabase project (quickest)**

1. Create a project at https://supabase.com.
2. Copy the Project URL and publishable/anon key into `apps/web/.env.local`.
3. Apply the schema from `supabase/migrations/` either by pasting `0001_initial_schema.sql` into the Supabase SQL Editor, or with the CLI:
   ```bash
   pnpm exec supabase link --project-ref <your-project-ref>
   pnpm exec supabase db push
   ```

**Option B — local Supabase stack (Docker required)**

```bash
pnpm exec supabase start     # boots Postgres, Auth, Studio, etc.
pnpm exec supabase db reset  # applies everything in supabase/migrations/
```

`supabase start` prints the local API URL and keys — use those for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

### 3. (Optional) Regenerate database types

After schema changes, regenerate the TypeScript types used by the app:

```bash
pnpm exec supabase gen types typescript --local > apps/web/src/types/database.ts
```

### 4. Start the development server

```bash
pnpm dev
```

This runs the Turborepo `dev` pipeline, which starts the web app at:

```
http://localhost:3000
```

To run only the web app (skipping Turbo):

```bash
pnpm --filter web dev
```

### 5. Production build

```bash
pnpm build      # turbo build (runs `next build` for the web app)
pnpm --filter web start   # serve the production build
```

> **Note:** `next/font/google` fetches Geist/Geist Mono from Google Fonts at build time. The build needs outbound network access for `fonts.googleapis.com`; offline builds fall back to system fonts (with a warning).

## Available Scripts

Root-level (Turborepo):

| Command          | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `pnpm dev`       | Start all apps in development mode                           |
| `pnpm build`     | Build all apps and packages                                  |
| `pnpm lint`      | Lint all packages                                            |
| `pnpm typecheck` | Type-check all packages                                      |
| `pnpm format`    | Format `ts, tsx, md` files with Prettier                     |
| `pnpm prepare`   | Install Husky git hooks (runs automatically after `install`) |

Inside `apps/web`:

| Command          | Description                |
| ---------------- | -------------------------- |
| `pnpm dev`       | Start Next.js in dev mode  |
| `pnpm build`     | Production build           |
| `pnpm start`     | Serve the production build |
| `pnpm lint`      | Run ESLint                 |
| `pnpm typecheck` | Run `tsc --noEmit`         |

Pre-commit hooks (Husky + lint-staged) run ESLint `--fix` and Prettier on staged files.

## Authentication and Roles

Auth is handled entirely by Supabase. The relevant code lives in `apps/web/src/lib/supabase/`:

- `client.ts` — browser client
- `server.ts` — server client using Next.js `cookies()`
- `middleware.ts` — session refresh helper used by `proxy.ts`

Roles and permissions are defined in `apps/web/src/lib/constants/roles.ts`:

| Role          | Summary of permissions                                                      |
| ------------- | --------------------------------------------------------------------------- |
| `super_admin` | Full access to members, finance, events, departments, church settings, SMS  |
| `dept_admin`  | Read members; manage own department events; read attendance; department SMS |
| `member`      | Manage own profile; read events; create giving and prayer requests          |

Useful helpers:

- `apps/web/src/lib/utils/church-scope.ts` — `getActiveChurch()` (resolves the current church/membership) and `requireChurchAdmin()`
- `apps/web/src/lib/hooks/useChurch.ts`, `useRole.ts` — client-side hooks

## Database

The schema lives in `supabase/migrations/0001_initial_schema.sql` and includes:

- **Enums:** `user_role` (`super_admin`, `dept_admin`, `member`), `plan_tier` (`basic`, `premium`), `badge_type`
- **Tables:** `users` (extends `auth.users`), `churches`, `church_memberships` (join table with role, badges, baptism status)
- **Triggers:** `handle_new_user()` creates a `users` profile row on signup
- **Helpers:** `is_church_admin(church_id)` and `user_role_in_church(church_id)`
- **RLS:** enabled on all tables, with policies for own-profile access, public church reads, and membership visibility

## Continuous Integration

`.github/workflows/ci.yml` runs on pull requests to `main`:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
```

## License

Proprietary. All rights reserved.
