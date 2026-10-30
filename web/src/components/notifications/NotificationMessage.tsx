'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { readNotification, type AppNotification } from '@/lib/notifications'
import { useNotifications } from './NotificationsProvider'

export function NotificationMessage({
  notificationId,
}: {
  notificationId: string
}) {
  const { supabase, churchId, revision, refresh } = useNotifications()
  const [state, setState] = useState<{
    notification: AppNotification | null
    loading: boolean
    error: string | null
  }>({ notification: null, loading: true, error: null })

  useEffect(() => {
    const controller = new AbortController()
    void readNotification(supabase, churchId, notificationId, controller.signal)
      .then((notification) => {
        if (!controller.signal.aborted) {
          setState({ notification, loading: false, error: null })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({
            notification: null,
            loading: false,
            error: 'Could not load this message. Please try again.',
          })
        }
      })
    return () => controller.abort()
  }, [supabase, churchId, notificationId, revision])

  const { notification, loading, error } = state
  return (
    <>
      <DialogHeader className="pr-6">
        <DialogTitle className="break-words leading-snug">
          {notification?.title ?? 'Notification'}
        </DialogTitle>
        <DialogDescription>
          {notification
            ? new Date(notification.created_at).toLocaleString()
            : 'A message from your church.'}
        </DialogDescription>
      </DialogHeader>
      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" /> Loading message…
        </p>
      ) : error ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : notification ? (
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {notification.body}
        </p>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          This notification is no longer available.
        </p>
      )}
    </>
  )
}
