# @workspace/utils

Framework-agnostic utilities shared across the monorepo.

## Usage

```ts
import { cn } from '@workspace/utils'
```

`cn` combines `clsx` and `tailwind-merge` and is re-exported by
`@workspace/ui` (`@workspace/ui/lib/utils`) and the Next.js app
(`@/lib/utils`).
