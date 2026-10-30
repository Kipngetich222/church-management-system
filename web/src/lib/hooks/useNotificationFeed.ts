'use client'

import { useEffect, useState } from 'react'
import { useNotifications } from '@/components/notifications/NotificationsProvider'
import type { AppNotification, NotificationPage } from '@/lib/notifications'

type FeedState = {
  items: AppNotification[]
  unreadCount: number
  snapshotAt: string | null
  hasMore: boolean
  loading: boolean
  error: string | null
}

export function useNotificationFeed(pageSize = 20, unreadOnly = false) {
  const { supabase, churchId, revision, refresh } = useNotifications()
  const [pages, setPages] = useState(1)
  const [state, setState] = useState<FeedState>({
    items: [],
    unreadCount: 0,
    snapshotAt: null,
    hasMore: false,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      const items: AppNotification[] = []
      let page: NotificationPage | undefined
      let snapshotAt: string | undefined
      let cursor: AppNotification | undefined

      // Revalidate every loaded page so read changes, deletions and audience
      // changes cannot leave stale entries further down an open inbox.
      for (let index = 0; index < pages; index += 1) {
        const { data, error } = await supabase
          .rpc('get_notifications', {
            p_church_id: churchId,
            p_limit: pageSize,
            p_unread_only: unreadOnly,
            ...(cursor
              ? {
                  p_before_created_at: cursor.created_at,
                  p_before_id: cursor.id,
                }
              : {}),
          })
          .abortSignal(controller.signal)

        if (error) throw error
        if (controller.signal.aborted) return
        page = data as unknown as NotificationPage
        snapshotAt ??= page.snapshot_at
        items.push(...page.items)
        cursor = page.items.at(-1)
        if (!page.has_more || !cursor) break
      }

      if (page && !controller.signal.aborted) {
        setState({
          items,
          unreadCount: page.unread_count,
          snapshotAt: snapshotAt ?? page.snapshot_at,
          hasMore: page.has_more,
          loading: false,
          error: null,
        })
      }
    }

    void load().catch(() => {
      if (!controller.signal.aborted) {
        setState({
          items: [],
          unreadCount: 0,
          snapshotAt: null,
          hasMore: false,
          loading: false,
          error: 'Could not load notifications. Please try again.',
        })
      }
    })

    return () => controller.abort()
  }, [supabase, churchId, revision, pages, pageSize, unreadOnly])

  function reload() {
    setState((previous) => ({ ...previous, loading: true, error: null }))
    refresh()
  }

  function loadMore() {
    if (state.loading || !state.hasMore) return
    setState((previous) => ({ ...previous, loading: true }))
    setPages((value) => value + 1)
  }

  return { ...state, reload, loadMore }
}

export type NotificationFeed = ReturnType<typeof useNotificationFeed>
