import { Church } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The ChurchOnline product logo - a church glyph. Used wherever the system
 * itself (rather than an individual church) is branded, e.g. the public navbar,
 * the app sidebar, and the marketing site.
 */
export function SystemLogo({ className }: { className?: string }) {
  return <Church className={cn('text-primary', className)} aria-hidden />
}
