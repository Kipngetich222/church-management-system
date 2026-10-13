'use client'

import { useState } from 'react'
import { Church } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const SIZE_CLASSES = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
} as const

type ChurchLogoSize = keyof typeof SIZE_CLASSES

type Props = {
  name?: string | null
  logoUrl?: string | null
  size?: ChurchLogoSize
  /**
   * When true (default) clicking the logo opens a full-size preview. Set to
   * false when the logo sits inside another interactive element (e.g. a menu
   * trigger or a card link) to avoid nested buttons.
   */
  interactive?: boolean
  className?: string
}

/**
 * The church logo shown as a circle wherever the church name appears. When the
 * church has no logo it falls back to its initial with a church glyph.
 */
export function ChurchLogo({
  name,
  logoUrl,
  size = 'md',
  interactive = true,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const sizeClass = SIZE_CLASSES[size]
  const label = name?.trim() || 'Church'

  const frame = cn(
    'grid shrink-0 place-items-center overflow-hidden rounded-full border bg-muted',
    sizeClass,
    className
  )

  const image = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={label} className="h-full w-full object-cover" />
  ) : (
    <span className="grid place-items-center text-primary">
      <Church
        className={
          size === 'lg' || size === 'xl'
            ? 'h-8 w-8'
            : size === 'md'
              ? 'h-5 w-5'
              : 'h-4 w-4'
        }
      />
    </span>
  )

  if (!logoUrl || !interactive) {
    return (
      <span className={frame} aria-hidden={!logoUrl}>
        {image}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${label} logo`}
        title={label}
        className={cn(frame, 'cursor-zoom-in transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
      >
        {image}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl bg-popover/95 p-3 sm:max-w-3xl">
          <DialogTitle className="sr-only">{label}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={label}
            className="mx-auto max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
