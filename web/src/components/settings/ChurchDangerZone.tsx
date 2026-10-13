'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'

type Decision = 'pending' | 'approved' | 'rejected'

type Approval = {
  id: string
  approver_id: string
  decision: Decision
  full_name: string | null
  email: string | null
}

type DeletionStatus = {
  request: {
    id: string
    status: 'pending_approval' | 'approved' | 'reverted' | 'rejected' | 'completed'
    church_name: string
    approvals_required: number
    approvals_granted: number
    revert_deadline: string | null
    requested_at: string
  }
  approvals: Approval[]
}

async function fetchChurchStatus(
  churchId: string
): Promise<DeletionStatus | null> {
  const res = await fetch(`/api/churches/${churchId}/deletion`, {
    cache: 'no-store',
  })
  const data = await res.json()
  return (data.status as DeletionStatus | null) ?? null
}

function countdown(deadline: string, now: number) {
  const ms = Math.max(0, new Date(deadline).getTime() - now)
  const totalSeconds = Math.floor(ms / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function decisionLabel(decision: Decision) {
  if (decision === 'approved') return 'Accepted'
  if (decision === 'rejected') return 'Rejected'
  return 'Pending'
}

/**
 * Collapsed-by-default church deletion control, shown to super admins under the
 * church profile. A deletion needs every super admin to accept, then a 24 hour
 * revert window before it is applied.
 */
export function ChurchDangerZone({
  churchId,
  churchName,
  currentUserId,
}: {
  churchId: string
  churchName: string
  currentUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<DeletionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    fetchChurchStatus(churchId)
      .then((value) => {
        if (active) setStatus(value)
      })
      .catch(() => {
        // Ignore: the danger zone simply shows the delete button.
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [churchId])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  async function initiate() {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/churches/${churchId}/deletion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not start deletion')
      return
    }
    setStatus(await fetchChurchStatus(churchId))
  }

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/churches/${churchId}/deletion/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not record your decision')
      return
    }
    setStatus(await fetchChurchStatus(churchId))
  }

  async function revert() {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/churches/${churchId}/deletion`, {
      method: 'DELETE',
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not revert deletion')
      return
    }
    setStatus(null)
    router.refresh()
  }

  const myApproval = status?.approvals.find(
    (row) => row.approver_id === currentUserId
  )
  const approvedCount =
    status?.request.approvals_granted ??
    status?.approvals.filter((row) => row.decision === 'approved').length ??
    0

  return (
    <Card className="border-destructive/40">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((value) => !value)}
      >
        <CardTitle className="flex items-center justify-between text-destructive">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger zone
          </span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          />
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking deletion status...
            </p>
          ) : status ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Deletion of {churchName} in progress
                </p>
                {status.request.status === 'pending_approval' ? (
                  <p className="text-sm text-muted-foreground">
                    Every super admin must accept this deletion. {approvedCount}{' '}
                    of {status.request.approvals_required} accepted so far.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    All super admins accepted. The church will be permanently
                    deleted in{' '}
                    <span className="font-medium text-destructive">
                      {status.request.revert_deadline
                        ? countdown(status.request.revert_deadline, now)
                        : '--:--:--'}
                    </span>{' '}
                    unless reverted.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {status.approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>
                      {approval.full_name ?? approval.email ?? 'Super admin'}
                      {approval.approver_id === currentUserId && ' (you)'}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        approval.decision === 'approved' && 'text-emerald-600',
                        approval.decision === 'rejected' && 'text-destructive',
                        approval.decision === 'pending' && 'text-muted-foreground'
                      )}
                    >
                      {decisionLabel(approval.decision)}
                    </span>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-wrap gap-2">
                {status.request.status === 'pending_approval' &&
                  myApproval?.decision === 'pending' && (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => decide('approve')}
                        disabled={busy}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Accept deletion
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => decide('reject')}
                        disabled={busy}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                <Button variant="outline" onClick={revert} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Revert deletion
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Deleting this church permanently removes it and detaches all of
                its members. Every super admin must accept the deletion, after
                which there is a 24 hour window to revert before it is applied.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={busy}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete church
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {churchName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All super admins will be notified and must accept this
                      deletion. Once everyone accepts, you have 24 hours to
                      revert before the church and its memberships are
                      permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={initiate}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, start deletion
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}