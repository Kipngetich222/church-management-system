import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { BackLink } from '@/components/shared/BackLink'
import { MemberPrayerRequestCard } from '@/components/prayer/MemberPrayerRequestCard'
import { MemberRequestActions } from '@/components/prayer/MemberRequestActions'
import type { PrayerRequestRow } from '@/lib/types/prayer'

export const metadata = { title: 'Prayer & Counselling' }

export default async function MemberPrayerDetail({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  const { churchId, user } = await getActiveChurch()
  const supabase = await createClient()
  // Read through the caller's RLS. Owners and assignees can still open status
  // alerts after a request leaves the active list, including answered prayers.
  const [
    { data: request, error },
    { data: membership, error: membershipError },
  ] = await Promise.all([
    supabase
      .from('prayer_requests')
      .select(
        '*, prayer_interactions(id, body, created_at, is_internal, author_membership_id)'
      )
      .eq('id', requestId)
      .eq('church_id', churchId)
      .maybeSingle(),
    supabase
      .from('church_memberships')
      .select('id')
      .eq('church_id', churchId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])
  if (error || membershipError)
    throw new Error('Could not load the request. Please try again.')
  if (!request || !membership) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/member/prayer" label="Prayer & Counselling" />
      <h1 className="text-2xl font-bold">Prayer & Counselling</h1>
      <MemberPrayerRequestCard
        request={request as PrayerRequestRow}
        actions={
          request.assigned_to === membership.id ? (
            <MemberRequestActions
              requestId={request.id}
              membershipId={membership.id}
              kind={request.type}
              status={request.status ?? 'open'}
            />
          ) : undefined
        }
      />
    </div>
  )
}
