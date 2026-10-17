import { Baby, HeartHandshake, Sparkles, User, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { MemberStats } from '@/lib/types/members'
import { cn } from '@/lib/utils'

const CARDS = [
  {
    key: 'men',
    label: 'Men',
    icon: User,
    gradient: 'from-blue-500/15 via-sky-500/5 to-transparent',
    ring: 'ring-blue-500/20',
    iconClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  },
  {
    key: 'women',
    label: 'Women',
    icon: HeartHandshake,
    gradient: 'from-rose-500/15 via-pink-500/5 to-transparent',
    ring: 'ring-rose-500/20',
    iconClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  },
  {
    key: 'youth',
    label: 'Youth',
    icon: Sparkles,
    gradient: 'from-orange-500/15 via-amber-500/5 to-transparent',
    ring: 'ring-orange-500/20',
    iconClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  },
  {
    key: 'children',
    label: 'Children',
    icon: Baby,
    gradient: 'from-emerald-500/15 via-green-500/5 to-transparent',
    ring: 'ring-emerald-500/20',
    iconClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  },
] as const

export function MemberStatsCards({ stats }: { stats: MemberStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card
        className={cn(
          'relative overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ring-primary/20'
        )}
      >
        <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total members
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {stats.total}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.withAccount} with accounts · {stats.withoutAccount} manual
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Users className="h-5 w-5" />
          </span>
        </div>
      </Card>

      {CARDS.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.key}
            className={cn(
              'relative overflow-hidden bg-gradient-to-br',
              card.gradient,
              card.ring
            )}
          >
            <div className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {stats[card.key]}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.total
                    ? Math.round((stats[card.key] / stats.total) * 100)
                    : 0}
                  % of members
                </p>
              </div>
              <span
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
                  card.iconClass
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
