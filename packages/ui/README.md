# @workspace/ui

Shared Base UI + shadcn-style React components used by the Next.js app.

## Usage

```tsx
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
```

## Structure

- `src/components/*` — one file per component, exported via `@workspace/ui/components/<name>`.
- `src/lib/utils.ts` — re-exports `cn` from `@workspace/utils`.

Components are styled with Tailwind CSS v4 and rely on the design tokens
defined in the app's `globals.css`. The app's Tailwind `@source` directive
scans this package so utilities used here are included in the build.
