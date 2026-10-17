'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Link2, Share2 } from 'lucide-react'

type ShareState = 'idle' | 'copied' | 'error'

/**
 * Share a link with the native share sheet where available, falling back to the
 * clipboard (and the older execCommand path for insecure contexts). Failures -
 * including the user simply cancelling the share sheet - never throw or leave
 * the button stuck.
 */
export function ShareButton({
  url,
  title,
  text,
}: {
  url: string
  title: string
  text?: string
}) {
  const [state, setState] = useState<ShareState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function flash(next: ShareState) {
    setState(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2500)
  }

  async function copyToClipboard(): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url)
        return true
      } catch {
        // Fall through to the legacy path below.
      }
    }

    try {
      const field = document.createElement('textarea')
      field.value = url
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.top = '-9999px'
      document.body.appendChild(field)
      field.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(field)
      return copied
    } catch {
      return false
    }
  }

  async function copy() {
    flash((await copyToClipboard()) ? 'copied' : 'error')
  }

  async function share() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title, ...(text ? { text } : {}) })
        return
      } catch (err) {
        // A cancelled share sheet is not an error worth reporting.
        if ((err as Error)?.name === 'AbortError') return
        // Any other failure (unsupported payload, permissions) falls back to copy.
      }
    }

    // No native share sheet (or it failed): copy the link instead.
    await copy()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={share}>
        <Share2 className="h-4 w-4 mr-2" /> Share
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        aria-label="Copy link"
      >
        {state === 'copied' ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <Link2 className="h-4 w-4 mr-2" />
        )}
        {state === 'copied' ? 'Copied' : 'Copy link'}
      </Button>
      <span aria-live="polite" className="text-xs text-destructive">
        {state === 'error' ? 'Could not copy the link' : ''}
      </span>
    </div>
  )
}
