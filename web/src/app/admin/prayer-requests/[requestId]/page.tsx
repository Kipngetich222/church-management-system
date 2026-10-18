import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { notFound } from 'next/navigation'
import { PrayerRequestDetail } from '@/components/prayer/PrayerRequestDetail'
import { BackLink } from '@/components/shared/BackLink'
import type { PrayerRequestRow } from '@/lib/types/prayer'

export default async function AdminPrayerDetail({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  const ctx = await requirePermission('prayer:read')
  const supabase = await createClient()

  const { data: req } = await supabase
    .from('prayer_requests')
    .select(
      `
      *,
      church_memberships!prayer_requests_membership_id_fkey(id, users!church_memberships_user_id_fkey(full_name, email)),
      assigned_membership:church_memberships!prayer_requests_assigned_to_fkey(id, users!church_memberships_user_id_fkey(full_name, email)),
      prayer_interactions(id, body, is_internal, created_at,
        church_memberships(users!church_memberships_user_id_fkey(full_name)))
    `
    )
    .eq('id', requestId)
    .eq('church_id', ctx.churchId)
    .single()

  if (!req) notFound()

  return (
    <div className="space-y-6">
      <BackLink href="/admin/prayer-requests" label="Prayer & Counselling" />
      <PrayerRequestDetail request={req as PrayerRequestRow} />
    </div>
  )
}
