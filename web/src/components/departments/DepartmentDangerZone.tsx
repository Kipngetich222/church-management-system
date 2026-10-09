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
import { Loader2, Trash2 } from 'lucide-react'

export function DepartmentDangerZone({
  departmentId,
}: {
  departmentId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', departmentId)

    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }

    router.push('/admin/departments')
    router.refresh()
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Danger zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Deleting this department removes all member assignments and any
          leaders&apos; dept_admin status stays intact. This action cannot be
          undone.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="destructive" disabled={busy} />}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete department'
            )}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this department?</AlertDialogTitle>
              <AlertDialogDescription>
                All department member assignments will be removed. This action
                cannot be undone.
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
