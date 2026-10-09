import type { ComponentProps } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Small inline loading indicator. Use inside buttons, rows, or anywhere a
 * request is in flight so the user always sees that something is happening.
 */
export function Spinner({
  className,
  label = 'Loading',
  ...props
}: ComponentProps<typeof Loader2> & { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center">
      <Loader2
        aria-hidden="true"
        className={cn('size-4 animate-spin', className)}
        {...props}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
