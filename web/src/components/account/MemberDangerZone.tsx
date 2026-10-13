'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronDown, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

type DeletionRequest = {
  id: string
  status: string
  revert_deadline: string
}

type DeletionStatus = {
  request: DeletionRequest | null
  finalized: boolean
}

async function fetchDeletionStatus(): Promise<DeletionStatus> {
  const res = await fetch('/api/account/deletion', { cache: 'no-store' })
  const data = await res.json()
  return {
    request: (data.request as DeletionRequest | null) ?? null,
    finalized: Boolean(data.finalized),
  }
}

function countdown(deadline: string, now: number) {
  const ms = Math.max(0, new Date(deadline).getTime() - now)
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

/**
 * Collapsed-by-default account deletion control for the member profile.
 * Clicking the header reveals the destructive actions. When the revert window
 * elapses the account is deleted and the member is signed out.
 */
export function MemberDangerZone() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState<DeletionRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const finalizingRef = useRef(false)

  async function leaveAfterDeletion() {
    setBusy(true)
    try {
      await createClient().auth.signOut()
    } catch {
      // The session is already invalid once the account is gone.
    }
    router.push('/login?message=' + encodeURIComponent('Your account has been deleted. You can sign up again another time.'))
    router.refresh()
  }

  useEffect(() => {
    let active = true
    fetchDeletionStatus()
      .then((data) => {
        if (!active) return
        if (data.finalized) {
          leaveAfterDeletion()
          return
        }
        setRequest(data.request)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Delete the account as soon as the revert window elapses. The server applies
  // the deletion and tells us whether the account is actually gone; only then do
  // we sign the member out. If it fails we keep retrying on each tick instead of
  // leaving the member signed in with a stuck request.
  useEffect(() => {
    if (!request || finalizingRef.current) return
    if (new Date(request.revert_deadline).getTime() > now) return
    finalizingRef.current = true
    fetch('/api/account/deletion/finalize', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.finalized) {
          leaveAfterDeletion()
          return
        }
        finalizingRef.current = false
        setError(
          'We could not finish deleting your account yet. Retrying shortly...'
        )
      })
      .catch(() => {
        finalizingRef.current = false
        setError('Network error while deleting your account. Retrying...')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, now])

  async function requestDeletion() {
    setBusy(true)
    setError('')
    const res = await fetch('/api/account/deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not request deletion')
      return
    }
    setRequest(data.request)
  }

  async function revert() {
    setBusy(true)
    setError('')
    const res = await fetch('/api/account/deletion', { method: 'DELETE' })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not revert deletion')
      return
    }
    setRequest(null)
    router.refresh()
  }

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
              Checking account status...
            </p>
          ) : request ? (
            <div className="space-y-3">
              <p className="text-sm">Your account is scheduled for deletion.</p>
              <p className="text-sm font-medium">
                Permanent deletion in {countdown(request.revert_deadline, now)}
              </p>
              <p className="text-sm text-muted-foreground">
                You will be removed from every church you belong to, and each
                church&apos;s member count adjusts automatically. You will be
                signed out when the window ends. You can still change your mind
                until then.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button variant="outline" onClick={revert} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Keep my account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Deleting your account removes you from every church you belong
                to. You have 10 minutes to change your mind afterwards, after
                which the account is deleted and you are signed out. You can
                sign up again afterwards.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={busy}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete my account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you sure you want to delete your account?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be removed from all churches, then signed out
                      after 10 minutes unless you revert this from your profile.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={requestDeletion}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, delete my account
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
