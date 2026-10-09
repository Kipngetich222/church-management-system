import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { notFound } from 'next/navigation'
import { PrayerRequestDetail } from '@/components/prayer/PrayerRequestDetail'

export default async function AdminPrayerDetail({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()

  const { data: req } = await supabase
    .from('prayer_requests')
    .select(`
      *,
      church_memberships(id, users(full_name, email)),
      prayer_interactions(id, body, is_internal, created_at,
        church_memberships(users(full_name)))
    `)
    .eq('id', requestId)
    .eq('church_id', churchId)
    .single()

  if (!req) notFound()
  return <PrayerRequestDetail request={req as any} />
}