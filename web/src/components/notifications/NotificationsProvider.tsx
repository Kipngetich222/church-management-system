'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppNotification, DashboardView } from '@/lib/notifications'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { NotificationMessage } from './NotificationMessage'

type NotificationContext = {
  churchId: string
  view: DashboardView
  supabase: ReturnType<typeof createClient>
  revision: number
  refresh: () => void
  setRead: (id: string, read: boolean) => Promise<void>
  markAllRead: (snapshotAt: string) => Promise<void>
  openMessage: (notification: AppNotification) => void
}

const Context = createContext<NotificationContext | null>(null)

export function NotificationsProvider({
  churchId,
  userId,
  view,
  children,
}: {
  churchId: string
  userId: string
  view: DashboardView
  children: React.ReactNode
}) {
  const [supabase] = useState(createClient)
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState<AppNotification | null>(null)
  const [messageError, setMessageError] = useState<{
    id: string
    text: string
  } | null>(null)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleRefresh = () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refresh, 200)
    }

    const channel = supabase
      .channel(`notifications:${churchId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          if (
            payload.eventType === 'DELETE' ||
            ('church_id' in payload.new && payload.new.church_id === churchId)
          ) {
            scheduleRefresh()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') scheduleRefresh()
      })

    // Recover missed changes after sleep, reconnects or a disabled Realtime
    // publication. Hidden tabs do not poll the database.
    const interval = setInterval(scheduleRefresh, 30_000)
    window.addEventListener('focus', scheduleRefresh)
    window.addEventListener('online', scheduleRefresh)
    document.addEventListener('visibilitychange', scheduleRefresh)

    return () => {
      clearInterval(interval)
      clearTimeout(refreshTimer)
      window.removeEventListener('focus', scheduleRefresh)
      window.removeEventListener('online', scheduleRefresh)
      document.removeEventListener('visibilitychange', scheduleRefresh)
      void supabase.removeChannel(channel)
    }
  }, [churchId, userId, supabase, refresh])

  const setRead = useCallback(
    async (id: string, read: boolean) => {
      const { data, error } = await supabase.rpc('set_notification_read', {
        p_church_id: churchId,
        p_notification_id: id,
        p_read: read,
      })
      if (error)
        throw new Error('Could not update the notification. Please try again.')
      if (!data) {
        refresh()
        throw new Error('This notification is no longer available.')
      }
      refresh()
    },
    [churchId, supabase, refresh]
  )

  const markAllRead = useCallback(
    async (snapshotAt: string) => {
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        p_church_id: churchId,
        p_before: snapshotAt,
      })
      if (error)
        throw new Error(
          'Could not mark notifications as read. Please try again.'
        )
      refresh()
    },
    [churchId, supabase, refresh]
  )

  const openMessage = useCallback(
    (notification: AppNotification) => {
      setMessage(notification)
      setMessageError(null)
      if (!notification.read_at) {
        void setRead(notification.id, true).catch((cause: unknown) => {
          setMessageError({
            id: notification.id,
            text:
              cause instanceof Error
                ? cause.message
                : 'Could not mark this message as read.',
          })
        })
      }
    },
    [setRead]
  )

  const value = useMemo(
    () => ({
      churchId,
      view,
      supabase,
      revision,
      refresh,
      setRead,
      markAllRead,
      openMessage,
    }),
    [
      churchId,
      view,
      supabase,
      revision,
      refresh,
      setRead,
      markAllRead,
      openMessage,
    ]
  )

  return (
    <Context.Provider value={value}>
      {children}
      {/* Keep the reader outside the feed so marking a message read does not
          close it when the unread filter removes the corresponding row. */}
      <Dialog
        open={message !== null}
        onOpenChange={(open) => {
          if (!open) setMessage(null)
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          {message && (
            <NotificationMessage key={message.id} notificationId={message.id} />
          )}
          {message && messageError?.id === message.id && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {messageError.text}
              </p>
              <Button variant="outline" onClick={() => openMessage(message)}>
                Retry marking as read
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Context.Provider>
  )
}

export function useNotifications() {
  const context = useContext(Context)
  if (!context) throw new Error('NotificationsProvider is required')
  return context
}
