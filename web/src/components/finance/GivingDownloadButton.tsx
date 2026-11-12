'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GivingDownloadButton({
  url,
  label = 'Receipt',
}: {
  url: string
  label?: string
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function download() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(60_000),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(
          data?.error || 'The download could not be prepared. Please try again.'
        )
      }
      const link = document.createElement('a')
      const objectUrl = URL.createObjectURL(await response.blob())
      link.href = objectUrl
      link.download =
        response.headers
          .get('content-disposition')
          ?.match(/filename="([a-zA-Z0-9_.-]+)"/)?.[1] || 'giving-download'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Download failed. Please try again.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={download}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {label}
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
