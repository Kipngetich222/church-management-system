'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover'
import {
  useNotificationFeed,
  type NotificationFeed,
} from '@/lib/hooks/useNotificationFeed'
import { useNotifications } from './NotificationsProvider'
import { NotificationItem } from './NotificationItem'

function NotificationList({
  feed,
  unreadOnly = false,
  onNavigate,
}: {
  feed: NotificationFeed
  unreadOnly?: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      {feed.error && (
        <div className="space-y-2 p-4 text-sm" role="alert">
          <p className="text-destructive">{feed.error}</p>
          <Button variant="outline" size="sm" onClick={feed.reload}>
            Try again
          </Button>
        </div>
      )}
      {feed.loading && feed.items.length === 0 ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" /> Loading
          notifications…
        </div>
      ) : feed.items.length > 0 ? (
        <ul className="divide-y">
          {feed.items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : !feed.error ? (
        <div className="space-y-2 px-6 py-9 text-center">
          <Bell
            className="mx-auto mb-3 size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">
            {unreadOnly ? 'You’re all caught up' : 'No notifications yet'}
          </p>
          <p className="text-sm text-muted-foreground">
            {unreadOnly
              ? 'You have read all your notifications.'
              : 'Church updates and personal activity will appear here.'}
          </p>
        </div>
      ) : null}
    </>
  )
}

function MarkAllRead({ feed }: { feed: NotificationFeed }) {
  const { markAllRead } = useNotifications()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function mark() {
    if (!feed.snapshotAt) return
    setPending(true)
    setError(null)
    try {
      await markAllRead(feed.snapshotAt)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not mark notifications as read.'
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        disabled={
          pending || !feed.unreadCount || !feed.snapshotAt || !!feed.error
        }
        onClick={mark}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <CheckCheck className="size-4" />
        )}
        Mark all as read
      </Button>
      {error && (
        <p role="alert" className="mt-1 max-w-xs text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function NotificationBell() {
  const { view, refresh } = useNotifications()
  const feed = useNotificationFeed(5)
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) refresh()
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              feed.unreadCount
                ? `Notifications, ${feed.unreadCount} unread`
                : 'Notifications'
            }
          />
        }
      >
        <Bell className="size-5" />
        {feed.unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground"
          >
            {feed.unreadCount > 99 ? '99+' : feed.unreadCount}
          </span>
        )}
        <span role="status" className="sr-only">
          {feed.snapshotAt ? `${feed.unreadCount} unread notifications` : ''}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="max-h-[min(36rem,calc(100dvh_-_5rem))] w-[calc(100vw_-_1rem)] max-w-sm gap-0 overflow-hidden p-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <PopoverTitle>Notifications</PopoverTitle>
          <MarkAllRead feed={feed} />
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <NotificationList feed={feed} onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="w-full"
            render={
              <Link
                href={`/${view}/notifications`}
                onClick={() => setOpen(false)}
              />
            }
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function DashboardNotifications() {
  const { view } = useNotifications()
  const feed = useNotificationFeed(4)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" /> Notifications
          </CardTitle>
          {feed.snapshotAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              {feed.unreadCount} unread
            </p>
          )}
        </div>
        <Button
          variant="link"
          size="sm"
          render={<Link href={`/${view}/notifications`} />}
        >
          View all
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <NotificationList feed={feed} />
      </CardContent>
    </Card>
  )
}

function InboxFeed({
  unreadOnly,
  setUnreadOnly,
}: {
  unreadOnly: boolean
  setUnreadOnly: (value: boolean) => void
}) {
  const feed = useNotificationFeed(20, unreadOnly)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex gap-1" aria-label="Filter notifications">
          <Button
            variant={unreadOnly ? 'ghost' : 'secondary'}
            aria-pressed={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
          >
            All
          </Button>
          <Button
            variant={unreadOnly ? 'secondary' : 'ghost'}
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
          >
            Unread{feed.snapshotAt ? ` (${feed.unreadCount})` : ''}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <MarkAllRead feed={feed} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh notifications"
            title="Refresh notifications"
            disabled={feed.loading}
            onClick={feed.reload}
          >
            <RefreshCw
              className={feed.loading ? 'size-4 animate-spin' : 'size-4'}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <NotificationList feed={feed} unreadOnly={unreadOnly} />
        {feed.hasMore && (
          <div className="border-t px-4 pt-4 text-center">
            <Button
              variant="outline"
              disabled={feed.loading}
              onClick={feed.loadMore}
            >
              {feed.loading ? 'Loading…' : 'Load older notifications'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function NotificationInbox() {
  const [unreadOnly, setUnreadOnly] = useState(false)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay up to date with your church and your activity.
        </p>
      </div>
      <InboxFeed
        key={unreadOnly ? 'unread' : 'all'}
        unreadOnly={unreadOnly}
        setUnreadOnly={setUnreadOnly}
      />
    </div>
  )
}
