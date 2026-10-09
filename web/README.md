# Church Management Web

The Next.js 16 (App Router) web client for the Church Management System. It contains the public
marketing site plus the authenticated admin and member dashboards.

This project is independent from the NestJS API that lives at the repository root. The API exposes
the REST endpoints consumed by both this web app and the mobile app (see the root `README.md`).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + integration keys
npm run dev                  # http://localhost:3000
```

## Scripts

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `npm run dev`       | Start Next.js in dev mode      |
| `npm run build`     | Production build               |
| `npm run start`     | Serve the production build     |
| `npm run lint`      | Run ESLint                     |
| `npm run typecheck` | `next typegen && tsc --noEmit` |

## Structure

```
src/
├── app/            # App Router routes (public, auth, admin, member, api)
├── components/     # UI components, including the shadcn/Base UI kit in components/ui
├── lib/            # Supabase clients, services, hooks, helpers
└── types/          # Generated Supabase Database types
```
