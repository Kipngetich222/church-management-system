import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const BADGE_STYLES: Record<string, string> = {
  pastor: 'bg-purple-100 text-purple-800 border-purple-200',
  usher: 'bg-blue-100 text-blue-800 border-blue-200',
  worship: 'bg-pink-100 text-pink-800 border-pink-200',
  choir: 'bg-rose-100 text-rose-800 border-rose-200',
  media: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  youth: 'bg-orange-100 text-orange-800 border-orange-200',
  children: 'bg-green-100 text-green-800 border-green-200',
  baptized: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  elder: 'bg-amber-100 text-amber-800 border-amber-200',
  deacon: 'bg-teal-100 text-teal-800 border-teal-200',
}

export function BadgeChip({ badge }: { badge: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs capitalize', BADGE_STYLES[badge] ?? '')}
    >
      {badge}
    </Badge>
  )
}
