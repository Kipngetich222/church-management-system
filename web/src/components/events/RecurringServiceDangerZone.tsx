'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
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
import { ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react'

/**
 * Delete a recurring service entirely. Programmes and check-in history for the
 * service are removed too (database cascade), so this is destructive. Like the
 * other danger zones it stays collapsed until an admin opens it, to avoid
 * deleting a service by accident.
 */
export function RecurringServiceDangerZone({
  serviceId,
  title,
}: {
  serviceId: string
  title: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('recurring_services')
      .delete()
      .eq('id', serviceId)

    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }

    router.push('/admin/events/recurring')
    router.refresh()
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="font-heading text-base leading-snug font-medium text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" /> Danger zone
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <CardDescription>
          Deleting a service is permanent. Open this only when you really need
          to.
        </CardDescription>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Deleting &quot;{title}&quot; permanently removes the service along
            with every programme and check-in recorded against it. To skip just
            one day, hide that day above instead.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete service
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this service?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes &quot;{title}&quot;, its programmes and its
                  check-in history. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      )}
    </Card>
  )
}
