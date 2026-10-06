# @workspace/supabase

Shared Supabase client factories for the monorepo. Both factories are typed
with the generated `Database` schema from `@workspace/types`.

## Usage

Browser (client component):

```ts
import { createBrowserSupabaseClient } from '@workspace/supabase'

const supabase = createBrowserSupabaseClient(url, key)
```

Server (server component, route handler, or middleware) — provide a cookie
adapter:

```ts
import {
  createServerSupabaseClient,
  type CookieMethodsServer,
} from '@workspace/supabase'

const cookies: CookieMethodsServer = {
  getAll: () => cookieStore.getAll(),
  setAll: (cookiesToSet) => {
    cookiesToSet.forEach(({ name, value, options }) =>
      cookieStore.set(name, value, options)
    )
  },
}

const supabase = createServerSupabaseClient(url, key, cookies)
```

The Next.js app's `apps/web/src/lib/supabase/*` helpers wrap these factories
with `next/headers` cookie handling.
