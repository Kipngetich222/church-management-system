'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

export function GroupDangerZone({ groupId }: { groupId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('small_groups')
      .delete()
      .eq('id', groupId)

    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }

    router.push('/admin/small-groups')
    router.refresh()
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Deleting this group removes all member assignments. This cannot be
          undone.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="destructive" disabled={busy} />}
          >
            Delete group
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this small group?</AlertDialogTitle>
              <AlertDialogDescription>
                All member assignments will be removed. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
