'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Church as ChurchIcon,
  ChevronDown,
  Compass,
  DoorOpen,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { clearActiveChurch } from '@/lib/auth/active-church'

type Props = {
  churchId: string
  churchName: string
  role: string
  membershipCount: number
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  dept_admin: 'Department admin',
  member: 'Member',
}

/**
 * Lets a member withdraw from the active church without deleting their account,
 * then browse and join another one. When the member is the church's only super
 * admin, ownership is transferred to another leader (or the church is deleted if
 * nobody is left) before the membership is removed.
 */
export function MembershipSection({
  churchId,
  churchName,
  role,
  membershipCount,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function withdraw() {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/account/memberships/${churchId}`, {
      method: 'DELETE',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setBusy(false)
      setError(data.error ?? 'Could not withdraw from this church')
      return
    }

    // Forget the (now-left) church so the next visit resolves cleanly.
    clearActiveChurch()
    const remaining = Number(data.membershipsRemaining ?? 0)
    if (remaining > 0) {
      router.push('/select-church')
    } else {
      router.push('/onboarding')
    }
    router.refresh()
  }

  const isSoleSuperAdmin = role === 'super_admin' && membershipCount === 1
  const onlyChurch = membershipCount <= 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChurchIcon className="h-5 w-5" />
          Membership
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{churchName}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[role] ?? role}
            </p>
          </div>
          <Badge variant="secondary">Current</Badge>
        </div>

        <div className="rounded-lg border">
          <button
            type="button"
            className="flex w-full items-center justify-between p-3 text-sm font-medium"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4" />
              Leave or switch church
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                open && 'rotate-180'
              )}
            />
          </button>
          {open && (
            <div className="space-y-4 border-t p-3">
              <p className="text-sm text-muted-foreground">
                You can leave this church without deleting your account. Your
                profile stays with you, and you are free to browse and join
                another church at any time.
              </p>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link href="/churches">
                    <Compass className="mr-2 h-4 w-4" />
                    Browse churches
                  </Link>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={busy}>
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <DoorOpen className="mr-2 h-4 w-4" />
                      )}
                      Withdraw from this church
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Withdraw from {churchName}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {isSoleSuperAdmin
                          ? 'You are this church\u2019s only super admin. Ownership will be handed to another leader, or to another member if there is no leader. If you are the only member, the church itself will be deleted.'
                          : onlyChurch
                            ? 'This is the only church you belong to. After leaving you will be taken to the church directory, where you can join another church.'
                            : 'You will keep your account and any other churches you belong to. You can join this church again later.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={withdraw}>
                        Yes, withdraw
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
