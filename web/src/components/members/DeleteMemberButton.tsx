'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function DeleteMemberButton({
  memberId,
  memberName,
  redirectTo,
  label = 'Delete',
}: {
  memberId: string
  memberName: string
  redirectTo?: string
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setPending(true)
    setError('')

    try {
      const res = await fetch(`/api/members/${memberId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Could not delete this member.')
        setPending(false)
        return
      }

      setOpen(false)
      if (redirectTo) router.push(redirectTo)
      router.refresh()
    } catch {
      setError('Could not delete this member.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={label ? 'sm' : 'icon-sm'}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${memberName}`}
        >
          <Trash2 className="h-4 w-4" />
          {label ? <span className="ml-1.5">{label}</span> : null}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 className="h-5 w-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete {memberName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the member and their church profile from this church.
            If they have an account, the account itself is not deleted. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete member
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
