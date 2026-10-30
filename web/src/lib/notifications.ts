import type { Database } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AppNotification =
  Database['public']['Tables']['notifications']['Row']

export type NotificationPage = {
  items: AppNotification[]
  unread_count: number
  has_more: boolean
  snapshot_at: string
}

export type DashboardView = 'admin' | 'member'

/** Read the current copy through RLS, including when an open message refreshes. */
export async function readNotification(
  supabase: SupabaseClient<Database>,
  churchId: string,
  notificationId: string,
  signal: AbortSignal
): Promise<AppNotification | null> {
  signal.throwIfAborted()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('church_id', churchId)
    .eq('id', notificationId)
    .abortSignal(signal)
    .maybeSingle()
  signal.throwIfAborted()
  if (error) throw error
  return data
}

/** Build links from known routes only; notification content is never a URL. */
export function notificationHref(
  notification: AppNotification,
  view: DashboardView
): string | null {
  const id = encodeURIComponent(notification.source_id)
  const admin = view === 'admin' || notification.admin_only

  switch (notification.source_type) {
    case 'events':
      return admin ? `/admin/events/${id}` : `/member/events/${id}`
    case 'sermons':
      return admin ? `/admin/sermons/${id}` : `/member/sermons/${id}`
    case 'resources':
      return admin ? '/admin/resources' : '/member/resources'
    case 'church_memberships':
      return notification.kind === 'member_joined'
        ? `/admin/members/${id}`
        : '/member/profile'
    case 'prayer_requests':
      return admin ? `/admin/prayer-requests/${id}` : `/member/prayer/${id}`
    case 'volunteer_shifts':
      return admin ? `/admin/volunteers/${id}` : '/member/volunteering'
    default:
      // Announcements and direct messages can be read in full inside the inbox.
      return null
  }
}
