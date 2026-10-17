'use client'

import { cn } from '@/lib/utils'
import { BadgeIcon } from './BadgeIcon'
import type { MemberBadgeDefinition } from '@/lib/types/members'
import { Check } from 'lucide-react'

function cardStyle(color: string) {
  return {
    background: `linear-gradient(135deg, ${color}23 0%, ${color}0d 55%, transparent 100%)`,
    borderColor: `${color}66`,
  }
}

function iconStyle(color: string) {
  return {
    background: `linear-gradient(135deg, ${color}33, ${color}18)`,
    color,
    boxShadow: `inset 0 0 0 1px ${color}33`,
  }
}

export function BadgeCard({
  badge,
  className,
  compact = false,
}: {
  badge: MemberBadgeDefinition
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border p-3 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md',
        compact ? 'flex items-center gap-2.5' : 'space-y-2',
        className
      )}
      style={cardStyle(badge.color)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-7 -top-7 h-20 w-20 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
        style={{ background: badge.color }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${badge.color}99, transparent)` }}
      />
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-lg',
          compact ? 'h-8 w-8' : 'h-10 w-10'
        )}
        style={iconStyle(badge.color)}
      >
        <BadgeIcon
          name={badge.icon}
          className={compact ? 'h-4 w-4' : 'h-5 w-5'}
        />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold capitalize">
          {badge.name}
        </p>
        {!compact && badge.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {badge.description}
          </p>
        ) : null}
        {compact && typeof badge.assignedCount === 'number' ? (
          <p className="text-[11px] text-muted-foreground">
            {badge.assignedCount} member{badge.assignedCount === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function BadgeToggleCard({
  badge,
  selected,
  onToggle,
}: {
  badge: MemberBadgeDefinition
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'relative overflow-hidden rounded-xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        selected && 'ring-2 ring-offset-2 ring-offset-background'
      )}
      style={{
        ...cardStyle(badge.color),
        ...(selected ? { boxShadow: `0 0 0 2px ${badge.color}` } : {}),
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={iconStyle(badge.color)}
        >
          <BadgeIcon name={badge.icon} className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold capitalize">
            {badge.name}
          </p>
          {badge.description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
              {badge.description}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
            selected
              ? 'border-transparent text-white'
              : 'border-muted-foreground/30 text-transparent'
          )}
          style={selected ? { background: badge.color } : undefined}
        >
          <Check className="h-3 w-3" />
        </span>
      </div>
    </button>
  )
}
