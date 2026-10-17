import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DEFAULT_MEMBER_BADGES } from '@/lib/constants/members'
import type { MemberBadgeDefinition } from '@/lib/types/members'
import { BadgeIcon } from './BadgeIcon'

const FALLBACK_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#0d9488',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#e11d48',
]

export function findBadgeDefinition(
  name: string,
  definitions: MemberBadgeDefinition[] = []
): MemberBadgeDefinition {
  const needle = name.trim().toLowerCase()

  if (needle === 'baptized') {
    return {
      name: 'Baptized',
      description: 'Has been baptized',
      color: '#0284c7',
      icon: 'droplets',
    }
  }

  const found = definitions.find(
    (badge) => badge.name.trim().toLowerCase() === needle
  )
  if (found) return found

  const preset = DEFAULT_MEMBER_BADGES.find((badge) => badge.name === needle)
  if (preset) {
    return {
      name: preset.name,
      description: preset.description,
      color: preset.color,
      icon: preset.icon,
      sort_order: preset.sort_order,
    }
  }

  let hash = 0
  for (let i = 0; i < needle.length; i += 1) {
    hash = (hash * 31 + needle.charCodeAt(i)) >>> 0
  }

  return {
    name,
    description: null,
    color: FALLBACK_COLORS[hash % FALLBACK_COLORS.length],
    icon: 'award',
  }
}

export function BadgeChip({
  badge,
  definition,
  className,
}: {
  badge: string
  definition?: MemberBadgeDefinition
  className?: string
}) {
  const visual = definition ?? findBadgeDefinition(badge)

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 text-xs capitalize', className)}
      style={{
        color: visual.color,
        borderColor: `${visual.color}66`,
        backgroundColor: `${visual.color}14`,
      }}
    >
      <BadgeIcon name={visual.icon} className="h-3 w-3" />
      {badge}
    </Badge>
  )
}
