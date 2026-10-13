'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronDown, Loader2, Trash2 } from 'lucide-react'
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

async function fetchDeletionRequest(): Promise<DeletionRequest | null> {
  const res = await fetch('/api/account/deletion', { cache: 'no-store' })
  const data = await res.json()
  return (data.request as DeletionRequest | null) ?? null
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
 * Clicking the header reveals the destructive actions.
 */
export function MemberDangerZone() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState<DeletionRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    fetchDeletionRequest()
      .then((value) => {
        if (active) setRequest(value)
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
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

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
                church&apos;s member count adjusts automatically. You can still
                change your mind.
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
                which it becomes permanent.
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
                      You will be removed from all churches. You have 10 minutes
                      to revert this from your profile before it becomes
                      permanent.
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