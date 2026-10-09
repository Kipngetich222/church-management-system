import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { notFound } from 'next/navigation'
import { VisitorDetail } from '@/components/visitors/VisitorDetail'

export default async function VisitorDetailPage({
  params,
}: {
  params: Promise<{ visitorId: string }>
}) {
  const { visitorId } = await params
  const ctx = await requirePermission('visitors:*')
  const supabase = await createClient()

  const { data: visitor } = await supabase
    .from('visitors')
    .select('*')
    .eq('id', visitorId)
    .eq('church_id', ctx.churchId)
    .single()

  if (!visitor) notFound()

  const { data: followups } = await supabase
    .from('visitor_followups')
    .select('id, method, notes, created_at, author_membership_id, church_memberships(users(full_name))')
    .eq('visitor_id', visitorId)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl space-y-6">
      <VisitorDetail
        churchId={ctx.churchId}
        visitor={visitor as any}
        followups={(followups ?? []) as any}
      />
    </div>
  )
}