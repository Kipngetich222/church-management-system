# @workspace/types

Shared TypeScript types for the monorepo, including the generated Supabase
`Database` schema types.

## Usage

```ts
import type { Database, Json } from '@workspace/types'
```

The Next.js app re-exports these from `apps/web/src/types/database.ts`, so
`@/types/database` remains a valid import path. Regenerate the types from
Supabase and update `src/index.ts` when the schema changes.
