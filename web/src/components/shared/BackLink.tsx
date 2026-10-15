import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type BackLinkProps = {
  /** Destination of the parent page this nested page belongs to. */
  href: string
  /** Label describing the parent page, e.g. "Members". */
  label?: string
  className?: string
}

/**
 * Consistent "back" affordance for nested pages (detail, edit and create
 * routes). Always links to an explicit parent route so it behaves predictably
 * on direct loads and refreshes, unlike `router.back()`.
 */
export function BackLink({ href, label = 'Back', className }: BackLinkProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      className={cn('-ml-2.5', className)}
      render={<Link href={href} />}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      {label}
    </Button>
  )
}
