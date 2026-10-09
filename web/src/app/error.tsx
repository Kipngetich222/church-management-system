'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/shared/ErrorState'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <ErrorState
        message="We could not load this page. Please try again."
        onRetry={() => retry()}
      />
    </div>
  )
}
