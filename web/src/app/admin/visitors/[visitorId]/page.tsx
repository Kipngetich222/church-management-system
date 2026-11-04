import { createClient } from '@/lib/supabase/server'
import { requireVisitorAdmin } from '@/lib/services/visitors.service'
import { visitorTokenSchema } from '@/lib/visitors'
import { notFound } from 'next/navigation'
import { VisitorDetail } from '@/components/visitors/VisitorDetail'
import { BackLink } from '@/components/shared/BackLink'
import { VisitorRefresh } from '@/components/visitors/VisitorRefresh'

export default async function VisitorDetailPage({
  params,
}: {
  params: Promise<{ visitorId: string }>
}) {
  const { visitorId } = await params
  const ctx = await requireVisitorAdmin()
  if (!visitorTokenSchema.safeParse(visitorId).success) notFound()
  const supabase = await createClient()

  const { data: visitor, error } = await supabase
    .from('visitors')
    .select('*')
    .eq('id', visitorId)
    .eq('church_id', ctx.churchId)
    .maybeSingle()

  if (error) throw new Error('Unable to load this visitor.')
  if (!visitor) notFound()

  const [followups, comments] = await Promise.all([
    supabase
      .from('visitor_followups')
      .select(
        'id, method, notes, created_at, author_membership_id, church_memberships(users!church_memberships_user_id_fkey(full_name))'
      )
      .eq('visitor_id', visitorId)
      .order('created_at', { ascending: false }),
    supabase
      .from('visitor_comments')
      .select('id, body, created_at')
      .eq('visitor_id', visitorId)
      .order('created_at', { ascending: false }),
  ])
  if (followups.error || comments.error)
    throw new Error('Unable to load visitor comments and follow-ups.')

  return (
    <div className="max-w-3xl space-y-6">
      <VisitorRefresh />
      <BackLink href="/admin/visitors" label="Visitors" />

      <VisitorDetail
        churchId={ctx.churchId}
        visitor={visitor}
        followups={followups.data ?? []}
        comments={comments.data ?? []}
      />
    </div>
  )
}
