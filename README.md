# Church Management System

A multi-tenant church management platform built for churches in Kenya / East Africa. A single
**NestJS REST API** powers two independent clients:

- the **Next.js web app** in [`web/`](./web) (public marketing site + admin & member dashboards), and
- a future **mobile app** that talks to the same API over HTTPS.

Each user can belong to one or more churches, with a role (`super_admin`, `dept_admin`, `member`)
that controls what they can see and do.

> **Note:** this repository previously used a Turborepo + pnpm-workspace monorepo. It has been
> flattened: the repository root is now a standalone NestJS application, and the Next.js app lives
> in `web/` as an independent project with its own dependencies.

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [API Reference](#api-reference)
- [Authentication and Roles](#authentication-and-roles)
- [Database](#database)
- [Available Scripts](#available-scripts)
- [Continuous Integration](#continuous-integration)

## Architecture

```
                 ┌───────────────────────┐
   Next.js web   │                       │
   (web/)  ─────▶│   NestJS REST API     │─────▶ Supabase (Postgres + Auth)
   Mobile app ──▶│   (repository root)   │
                 └───────────────────────┘
```

- The **API** authenticates requests with a Supabase access token (`Authorization: Bearer <jwt>`),
  validates it against Supabase Auth, resolves the caller's church memberships, and talks to
  Postgres with the service-role key. All queries are scoped explicitly to the resolved
  church / membership. Swagger docs are served at `/docs`.
- The **web app** renders the marketing site and dashboards.
- The **mobile app** consumes the same `/api/v1` endpoints as the web app, so behavior stays
  consistent across clients.

## Tech Stack

| Area         | Technology                                                                  |
| ------------ | --------------------------------------------------------------------------- |
| API          | NestJS 10, TypeScript, class-validator, Swagger (OpenAPI)                   |
| Web          | Next.js 16 (App Router, React Server Components), React 19, Tailwind CSS v4 |
| UI           | Base UI + shadcn-style components (shared kit now lives in `web/`)          |
| Data & Auth  | Supabase (Postgres, Auth, Row Level Security)                               |
| Integrations | Africa's Talking (SMS), M-Pesa Daraja (payments), Resend (email), QR codes  |
| Tooling      | ESLint, Prettier, Husky, lint-staged, Jest                                  |

## Project Structure

```
.
├── src/                        # NestJS API source
│   ├── main.ts                 # bootstrap (CORS, validation, Swagger, /api/v1 prefix)
│   ├── app.module.ts           # root module + global auth guard & exception filter
│   ├── common/                 # guards, decorators, DTOs, filters, utils
│   ├── config/                 # typed configuration
│   ├── supabase/               # Supabase service (service-role client + token verification)
│   ├── types/                  # generated Supabase Database types
│   └── modules/                # feature modules (auth, churches, events, finance, ...)
├── web/                        # standalone Next.js web app (client of the API)
│   └── src/
├── supabase/migrations/        # SQL schema, enums, triggers, RLS policies, functions
├── test/                       # e2e / integration tests
├── .github/workflows/ci.yml    # CI: lint, typecheck and build for both projects
├── nest-cli.json
├── tsconfig.json
└── package.json                # NestJS API manifest
```

## Prerequisites

- Node.js >= 20
- npm (the API and web app are installed independently)

## Environment Variables

### API (`./.env`)

```bash
cp .env.example .env
```

| Variable                         | Description                                             |
| -------------------------------- | ------------------------------------------------------- |
| `PORT`                           | Port the API listens on (default `4000`)                |
| `API_PUBLIC_URL`                 | Public URL of the API, used to build provider callbacks |
| `CORS_ORIGINS`                   | Comma-separated allowed origins (web app, mobile, ...)  |
| `SUPABASE_URL`                   | Supabase project URL                                    |
| `SUPABASE_SERVICE_ROLE_KEY`      | Service-role key (server only)                          |
| `SUPABASE_ANON_KEY`              | Publishable/anon key                                    |
| `CRON_SECRET`                    | Shared secret for the `/api/v1/cron/*` endpoints        |
| `AFRICAS_TALKING_*`              | Africa's Talking credentials (SMS)                      |
| `MPESA_*`                        | Safaricom Daraja credentials (payments)                 |
| `RESEND_API_KEY` / `RESEND_FROM` | Resend credentials (email)                              |
| `GOOGLE_MAPS_API_KEY`            | Google Maps key                                         |
| `CONTACT_EMAIL`                  | Destination for the public contact form                 |

### Web app (`./web/.env.local`)

```bash
cp web/.env.example web/.env.local
```

The web app currently talks to Supabase directly for its server-rendered pages; see
`web/.env.example` for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, etc.

## Running Locally

The API and the web app are separate projects and are installed/run independently.

### API

```bash
npm install
cp .env.example .env      # then fill in your Supabase credentials
npm run start:dev         # http://localhost:4000  (Swagger at http://localhost:4000/docs)
```

### Web app

```bash
cd web
npm install
cp .env.example .env.local
npm run dev               # http://localhost:3000
```

## API Reference

All routes are prefixed with `/api/v1`. Interactive docs are available at `/docs`.

Routes that operate on a church are nested under `/churches/:churchId/...`; the caller must be a
member of that church, and admin-only routes require the `super_admin` or `dept_admin` role.

### Auth & users

| Method | Path                | Access | Description                                   |
| ------ | ------------------- | ------ | --------------------------------------------- |
| POST   | `/auth/check-email` | public | Check whether an email already has an account |
| GET    | `/auth/me`          | auth   | Current user + church memberships             |
| GET    | `/users/me`         | auth   | Current user profile                          |
| PATCH  | `/users/me`         | auth   | Update the current user profile               |

### Churches & members

| Method | Path                                        | Access | Description                  |
| ------ | ------------------------------------------- | ------ | ---------------------------- |
| GET    | `/churches` (`?q=`)                         | public | List / search churches       |
| GET    | `/churches/:churchId`                       | public | Get a church                 |
| GET    | `/churches/slug/:slug`                      | public | Get a church by slug         |
| POST   | `/churches`                                 | auth   | Create a church (onboarding) |
| PATCH  | `/churches/:churchId`                       | admin  | Update church settings       |
| GET    | `/churches/:churchId/stats`                 | member | Dashboard statistics         |
| GET    | `/churches/:churchId/members`               | member | List members                 |
| POST   | `/churches/:churchId/members`               | admin  | Add a member                 |
| POST   | `/churches/:churchId/members/import`        | admin  | Bulk import members          |
| GET    | `/churches/:churchId/members/me`            | member | Current membership           |
| GET    | `/churches/:churchId/members/:membershipId` | member | Get a membership             |
| PATCH  | `/churches/:churchId/members/:membershipId` | admin  | Update a membership          |
| DELETE | `/churches/:churchId/members/:membershipId` | admin  | Remove a member              |

### Departments & small groups

| Method | Path                                                                  | Access | Description          |
| ------ | --------------------------------------------------------------------- | ------ | -------------------- |
| GET    | `/churches/:churchId/departments`                                     | member | List departments     |
| POST   | `/churches/:churchId/departments`                                     | admin  | Create a department  |
| PATCH  | `/churches/:churchId/departments/:departmentId`                       | admin  | Update a department  |
| DELETE | `/churches/:churchId/departments/:departmentId`                       | admin  | Delete a department  |
| POST   | `/churches/:churchId/departments/:departmentId/members`               | admin  | Add a member         |
| POST   | `/churches/:churchId/departments/:departmentId/promote`               | admin  | Promote a leader     |
| DELETE | `/churches/:churchId/departments/:departmentId/members/:membershipId` | admin  | Remove a member      |
| GET    | `/churches/:churchId/small-groups`                                    | member | List small groups    |
| POST   | `/churches/:churchId/small-groups`                                    | admin  | Create a small group |
| PATCH  | `/churches/:churchId/small-groups/:groupId`                           | admin  | Update a small group |
| DELETE | `/churches/:churchId/small-groups/:groupId`                           | admin  | Delete a small group |
| POST   | `/churches/:churchId/small-groups/:groupId/members`                   | admin  | Add a member         |
| DELETE | `/churches/:churchId/small-groups/:groupId/members/:membershipId`     | admin  | Remove a member      |

### Events, attendance & QR

| Method | Path                                                        | Access | Description                       |
| ------ | ----------------------------------------------------------- | ------ | --------------------------------- |
| GET    | `/churches/:churchId/events` (`?from&to&status&visibility`) | member | List church events                |
| POST   | `/churches/:churchId/events`                                | admin  | Create an event                   |
| PATCH  | `/churches/:churchId/events/:eventId`                       | admin  | Update an event                   |
| DELETE | `/churches/:churchId/events/:eventId`                       | admin  | Delete an event                   |
| GET    | `/churches/:churchId/events/:eventId/registrations`         | admin  | List registrations                |
| GET    | `/churches/:churchId/events/:eventId/attendance`            | member | List attendance                   |
| POST   | `/churches/:churchId/events/:eventId/attendance`            | admin  | Mark attendance                   |
| GET    | `/events/upcoming` (`?limit=`)                              | public | Upcoming public events            |
| GET    | `/events/:eventId`                                          | public | Get an event                      |
| GET    | `/events/:eventId/qr`                                       | public | Event check-in QR code (data URL) |
| POST   | `/events/:eventId/register`                                 | public | Register for an event             |
| GET    | `/churches/:churchId/attendance/me/qr`                      | member | Current member's QR code          |
| POST   | `/churches/:churchId/attendance/scan`                       | member | Scan a QR code to check in        |

### Sermons

| Method | Path                                    | Access | Description              |
| ------ | --------------------------------------- | ------ | ------------------------ |
| GET    | `/churches/:churchId/sermons`           | public | Published sermons        |
| GET    | `/churches/:churchId/sermons/manage`    | member | All sermons incl. drafts |
| POST   | `/churches/:churchId/sermons`           | admin  | Create a sermon          |
| PATCH  | `/churches/:churchId/sermons/:sermonId` | admin  | Update a sermon          |
| DELETE | `/churches/:churchId/sermons/:sermonId` | admin  | Delete a sermon          |
| GET    | `/sermons/:sermonId`                    | public | Get a sermon             |

### Finance & giving

| Method | Path                                                | Access | Description                 |
| ------ | --------------------------------------------------- | ------ | --------------------------- |
| GET    | `/churches/:churchId/finance/offerings`             | admin  | List offerings              |
| POST   | `/churches/:churchId/finance/offerings`             | admin  | Record an offering          |
| DELETE | `/churches/:churchId/finance/offerings/:offeringId` | admin  | Delete an offering          |
| GET    | `/churches/:churchId/finance/my-giving`             | member | Current member's giving     |
| GET    | `/churches/:churchId/finance/expenses`              | admin  | List expenses               |
| POST   | `/churches/:churchId/finance/expenses`              | admin  | Record an expense           |
| DELETE | `/churches/:churchId/finance/expenses/:expenseId`   | admin  | Delete an expense           |
| GET    | `/churches/:churchId/finance/campaigns`             | member | List giving campaigns       |
| POST   | `/churches/:churchId/finance/campaigns`             | admin  | Create a campaign           |
| GET    | `/churches/:churchId/finance/pledges`               | admin  | List pledges                |
| POST   | `/churches/:churchId/finance/pledges`               | admin  | Create a pledge             |
| GET    | `/churches/:churchId/finance/expense-categories`    | member | List expense categories     |
| POST   | `/churches/:churchId/finance/expense-categories`    | admin  | Create a category           |
| GET    | `/churches/:churchId/finance/summary` (`?from&to`)  | admin  | Financial summary           |
| POST   | `/giving/mpesa`                                     | auth   | Initiate an M-Pesa STK push |
| POST   | `/giving/mpesa/callback`                            | public | M-Pesa payment callback     |

### Prayer, communication & engagement

| Method | Path                                                          | Access | Description                     |
| ------ | ------------------------------------------------------------- | ------ | ------------------------------- |
| GET    | `/churches/:churchId/prayer-requests` (`?status`)             | member | List visible prayer requests    |
| POST   | `/churches/:churchId/prayer-requests`                         | member | Submit a prayer request         |
| GET    | `/churches/:churchId/prayer-requests/:requestId`              | member | Get a prayer request            |
| PATCH  | `/churches/:churchId/prayer-requests/:requestId`              | member | Update a prayer request         |
| POST   | `/churches/:churchId/prayer-requests/:requestId/interactions` | member | Add an interaction              |
| GET    | `/churches/:churchId/announcements`                           | public | Published announcements         |
| GET    | `/churches/:churchId/announcements/manage`                    | admin  | All announcements               |
| POST   | `/churches/:churchId/announcements`                           | admin  | Create an announcement          |
| PATCH  | `/churches/:churchId/announcements/:announcementId`           | admin  | Update an announcement          |
| DELETE | `/churches/:churchId/announcements/:announcementId`           | admin  | Delete an announcement          |
| GET    | `/churches/:churchId/messages`                                | admin  | Message history                 |
| GET    | `/churches/:churchId/messages/me`                             | member | Messages for the current member |
| GET    | `/churches/:churchId/message-campaigns`                       | admin  | Bulk campaign history           |
| POST   | `/churches/:churchId/messages/send`                           | admin  | Send an SMS/email campaign      |
| GET    | `/churches/:churchId/volunteers/roles`                        | member | Volunteer roles                 |
| POST   | `/churches/:churchId/volunteers/roles`                        | admin  | Create a role                   |
| GET    | `/churches/:churchId/volunteers/shifts`                       | member | Volunteer shifts                |
| POST   | `/churches/:churchId/volunteers/shifts`                       | admin  | Create a shift                  |
| PATCH  | `/churches/:churchId/volunteers/shifts/:shiftId`              | admin  | Update a shift                  |
| DELETE | `/churches/:churchId/volunteers/shifts/:shiftId`              | admin  | Delete a shift                  |
| POST   | `/churches/:churchId/volunteers/shifts/:shiftId/signup`       | member | Sign up for a shift             |
| DELETE | `/churches/:churchId/volunteers/shifts/:shiftId/signup`       | member | Cancel a sign-up                |
| GET    | `/churches/:churchId/resources`                               | member | Bookable resources              |
| POST   | `/churches/:churchId/resources`                               | admin  | Create a resource               |
| PATCH  | `/churches/:churchId/resources/:resourceId`                   | admin  | Update a resource               |
| DELETE | `/churches/:churchId/resources/:resourceId`                   | admin  | Delete a resource               |
| GET    | `/churches/:churchId/resources/bookings`                      | member | Resource bookings               |
| POST   | `/churches/:churchId/resources/bookings`                      | member | Request a booking               |
| PATCH  | `/churches/:churchId/resources/bookings/:bookingId`           | admin  | Approve / update a booking      |
| DELETE | `/churches/:churchId/resources/bookings/:bookingId`           | admin  | Delete a booking                |
| GET    | `/churches/:churchId/visitors` (`?status`)                    | admin  | List visitors                   |
| POST   | `/churches/:churchId/visitors`                                | admin  | Record a visitor                |
| GET    | `/churches/:churchId/visitors/:visitorId`                     | admin  | Visitor + follow-ups            |
| PATCH  | `/churches/:churchId/visitors/:visitorId`                     | admin  | Update a visitor                |
| DELETE | `/churches/:churchId/visitors/:visitorId`                     | admin  | Delete a visitor                |
| POST   | `/churches/:churchId/visitors/:visitorId/followups`           | admin  | Add a follow-up                 |

### Reports, audit, contact & health

| Method | Path                                        | Access | Description            |
| ------ | ------------------------------------------- | ------ | ---------------------- |
| GET    | `/churches/:churchId/reports/members`       | admin  | Member demographics    |
| GET    | `/churches/:churchId/reports/attendance`    | admin  | Attendance by event    |
| GET    | `/churches/:churchId/reports/member-growth` | admin  | Member growth by month |
| GET    | `/churches/:churchId/reports/finance`       | admin  | Finance report         |
| GET    | `/churches/:churchId/audit-logs`            | admin  | Audit log              |
| POST   | `/contact`                                  | public | Public contact form    |
| POST   | `/cron/birthdays`                           | secret | Birthday greetings job |
| POST   | `/cron/event-reminders`                     | secret | Event reminders job    |
| POST   | `/cron/scheduled-messages`                  | secret | Scheduled message job  |
| GET    | `/health`                                   | public | Liveness probe         |

Cron endpoints require the `x-cron-secret` header to match `CRON_SECRET`.

## Authentication and Roles

The API trusts **Supabase Auth** tokens:

1. The client signs in with Supabase (web or mobile) and receives an access token.
2. The client sends `Authorization: Bearer <access_token>` on every request.
3. `AuthGuard` verifies the token, loads the user profile and church memberships.
4. `ChurchGuard` (applied to church-scoped routes) resolves the active church from the `:churchId`
   param (or the `x-church-id` header) and enforces membership and role requirements.

Roles and their intent:

| Role          | Summary                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `super_admin` | Full access to members, finance, events, departments, church settings, SMS  |
| `dept_admin`  | Read members; manage own department events; read attendance; department SMS |
| `member`      | Manage own profile; read events; create giving and prayer requests          |

## Database

Schema, enums, triggers, RLS policies and analytics functions live in
[`supabase/migrations/`](./supabase/migrations). The API uses the service-role key and bypasses RLS,
so every service scopes its queries explicitly to the resolved church / membership.

Tables include: `users`, `churches`, `church_memberships`, `departments`, `department_members`,
`small_groups`, `small_group_members`, `events`, `event_registrations`, `event_attendance`,
`offerings`, `expenses`, `expense_categories`, `campaigns`, `pledges`, `message_campaigns`,
`messages`, `announcements`, `prayer_requests`, `prayer_interactions`, `sermons`, `volunteer_roles`,
`volunteer_shifts`, `volunteer_signups`, `resources`, `resource_bookings`, `visitors`,
`visitor_followups`, `pastoral_notes`, `role_permissions`, and `audit_logs`.

## Available Scripts

### API (repository root)

| Command              | Description                             |
| -------------------- | --------------------------------------- |
| `npm run start:dev`  | Start the API in watch mode             |
| `npm run start`      | Start the API                           |
| `npm run start:prod` | Run the compiled build (`dist/main.js`) |
| `npm run build`      | Compile with the Nest CLI               |
| `npm run lint`       | Lint `src` and `test`                   |
| `npm run format`     | Format with Prettier                    |
| `npm run typecheck`  | `tsc --noEmit`                          |
| `npm test`           | Run unit tests (Jest)                   |

### Web app (`web/`)

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `npm run dev`       | Start Next.js in dev mode      |
| `npm run build`     | Production build               |
| `npm run start`     | Serve the production build     |
| `npm run lint`      | Run ESLint                     |
| `npm run typecheck` | `next typegen && tsc --noEmit` |

Pre-commit hooks (Husky + lint-staged) run ESLint `--fix` and Prettier on staged files.

## Continuous Integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`, with two jobs:

- **API**: `npm install`, `npm run lint`, `npm run typecheck`, `npm run build`
- **Web**: `npm install`, `npm run lint`, `npm run typecheck` (inside `web/`)

## License

Proprietary. All rights reserved.
