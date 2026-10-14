'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from '@/components/ui/progress'
import {
  planDefinition,
  PLAN_FEATURES,
  PLANS,
  formatPlanPrice,
  type PlanTier,
} from '@/lib/constants/plans'

export type PlanUsageView = {
  plan: PlanTier
  planName: string
  memberLimit: number | null
  memberCount: number
  remaining: number | null
  atLimit: boolean
}

/**
 * Super-admin plan control. Every plan unlocks the same features, so this is
 * all about member capacity: show current usage and move to the bigger plan.
 */
export function PlanSettings({
  churchId,
  usage: initialUsage,
}: {
  churchId: string
  usage: PlanUsageView
}) {
  const router = useRouter()
  const [usage, setUsage] = useState(initialUsage)
  const [busy, setBusy] = useState<PlanTier | null>(null)
  const [error, setError] = useState('')

  const growth = planDefinition('growth')
  const onStarter = usage.plan === 'starter'
  const percent = usage.memberLimit
    ? Math.min(100, Math.round((usage.memberCount / usage.memberLimit) * 100))
    : 0

  async function changePlan(plan: PlanTier) {
    if (busy) return
    setBusy(plan)
    setError('')
    try {
      const res = await fetch('/api/churches/' + churchId + '/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'We could not change your plan right now.')
        return
      }
      if (data.usage) setUsage(data.usage as PlanUsageView)
      router.refresh()
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>{usage.planName} plan</CardTitle>
            <CardDescription>
              {usage.memberLimit
                ? 'Up to ' + usage.memberLimit + ' members'
                : 'Unlimited members'}
            </CardDescription>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            {formatPlanPrice(
              PLANS.find((plan) => plan.tier === usage.plan)?.price ?? 0
            )}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Members</span>
            <span className="text-muted-foreground">
              {usage.memberCount}
              {usage.memberLimit ? ' of ' + usage.memberLimit : ' members'}
            </span>
          </div>

          {usage.memberLimit && (
            <Progress value={percent}>
              <ProgressTrack>
                <ProgressIndicator />
              </ProgressTrack>
            </Progress>
          )}

          {usage.atLimit && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Your church is full. New members cannot join until you upgrade to
              the Growth plan.
            </p>
          )}
        </CardContent>
      </Card>

      {onStarter ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Upgrade to {growth.name}
            </CardTitle>
            <CardDescription>
              For established churches that keep growing. Everything on your
              Starter plan stays the same - you simply remove the 200-member cap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">
              {formatPlanPrice(growth.price)}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              <li className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Unlimited members - no 200-member cap
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Every feature, exactly as on Starter
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Keep all members, giving and ministry records
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Switch back any time you are within the Starter cap
              </li>
            </ul>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={() => changePlan('growth')} disabled={busy !== null}>
              {busy === 'growth' && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upgrade to {growth.name}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>You are on the {growth.name} plan</CardTitle>
            <CardDescription>Unlimited members and every feature.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-2 sm:grid-cols-2">
              {PLAN_FEATURES.slice(0, 6).map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {usage.memberCount <= 200 && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  You currently have {usage.memberCount} members, so you can
                  switch back to the Starter plan if you no longer need room to
                  grow.
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => changePlan('starter')}
                  disabled={busy !== null}
                >
                  {busy === 'starter' && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Switch to Starter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
