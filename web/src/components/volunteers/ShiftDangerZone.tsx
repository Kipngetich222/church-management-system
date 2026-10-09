'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Loader2, Trash2 } from 'lucide-react'

export function ShiftDangerZone({ shiftId }: { shiftId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('volunteer_shifts').delete().eq('id', shiftId)
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    router.push('/admin/volunteers')
    router.refresh()
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <Trash2 className="h-5 w-5" /> Danger zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Deleting this shift removes all signups. This action cannot be undone.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : 'Delete shift'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this shift?</AlertDialogTitle>
              <AlertDialogDescription>
                All volunteer signups for this shift will be removed.
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
    </Card>
  )
}