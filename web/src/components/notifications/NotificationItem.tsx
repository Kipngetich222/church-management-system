'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  CalendarDays,
  FileText,
  HeartHandshake,
  Mail,
  MailOpen,
  Megaphone,
  PlayCircle,
  Users,
  HandHelping,
  LoaderCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { notificationHref, type AppNotification } from '@/lib/notifications'
import { useNotifications } from './NotificationsProvider'

const sourceIcons = {
  announcements: Megaphone,
  events: CalendarDays,
  sermons: PlayCircle,
  resources: FileText,
  church_memberships: Users,
  prayer_requests: HeartHandshake,
  volunteer_shifts: HandHelping,
  messages: Mail,
}

export function NotificationItem({
  notification,
  onNavigate,
}: {
  notification: AppNotification
  onNavigate?: () => void
}) {
  const { view, setRead, openMessage } = useNotifications()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unread = notification.read_at === null
  const href = notificationHref(notification, view)
  const Icon =
    sourceIcons[notification.source_type as keyof typeof sourceIcons] ?? Bell

  async function updateRead(read: boolean) {
    setPending(true)
    setError(null)
    try {
      await setRead(notification.id, read)
      return true
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not update the notification.'
      )
      return false
    } finally {
      setPending(false)
    }
  }

  function readMessage() {
    onNavigate?.()
    openMessage(notification)
  }

  async function navigate(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return
    event.preventDefault()
    if (pending || (unread && !(await updateRead(true)))) return
    onNavigate?.()
    router.push(href!)
  }

  return (
    <li
      className={cn(
        'flex gap-3 p-4 transition-colors',
        unread && 'bg-primary/5'
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full',
          unread
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-2">
          {unread && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
              <span className="sr-only">Unread</span>
            </span>
          )}
          {href ? (
            <Link
              href={href}
              prefetch={false}
              onClick={navigate}
              className="break-words text-sm font-medium hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
            >
              {notification.title}
            </Link>
          ) : (
            <button
              type="button"
              onClick={readMessage}
              aria-haspopup="dialog"
              disabled={pending}
              className="text-left text-sm font-medium break-words hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
            >
              {notification.title}
            </button>
          )}
        </div>
        <p
          className={cn(
            'whitespace-pre-wrap break-words text-sm text-muted-foreground',
            'line-clamp-2'
          )}
        >
          {notification.body}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <time
            dateTime={notification.created_at}
            title={new Date(notification.created_at).toLocaleString()}
          >
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
            })}
          </time>
          {!href && (
            <button
              type="button"
              onClick={readMessage}
              disabled={pending}
              className="text-primary hover:underline"
            >
              Read message
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={`${unread ? 'Mark as read' : 'Mark as unread'}: ${notification.title}`}
        title={unread ? 'Mark as read' : 'Mark as unread'}
        onClick={() => void updateRead(unread)}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : unread ? (
          <MailOpen className="size-4" />
        ) : (
          <Mail className="size-4" />
        )}
      </Button>
    </li>
  )
}
