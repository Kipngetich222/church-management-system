import { Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UsernameStatus } from '@/lib/hooks/useChurchUsername'

/**
 * Inline availability feedback shown under a church username input.
 */
export function UsernameFeedback({
  status,
  message,
}: {
  status: UsernameStatus
  message: string
}) {
  if (status === 'idle' || !message) return null

  const tone =
    status === 'available'
      ? 'text-green-600'
      : status === 'checking'
        ? 'text-muted-foreground'
        : 'text-destructive'

  return (
    <p className={cn('flex items-center gap-1.5 text-xs', tone)}>
      {status === 'available' && <Check className="h-3.5 w-3.5" />}
      {status === 'checking' && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      )}
      {(status === 'taken' || status === 'invalid' || status === 'error') && (
        <X className="h-3.5 w-3.5" />
      )}
      {message}
    </p>
  )
}
