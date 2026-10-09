'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/**
 * Friendly fallback shown by route `error.tsx` boundaries. Gives the user a way
 * to retry instead of staring at a blank/broken screen.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We hit an unexpected error. Please try again.',
  onRetry,
  retrying = false,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={() => onRetry()} disabled={retrying}>
          {retrying && <Spinner className="mr-2" />}
          Try again
        </Button>
      )}
    </div>
  )
}
