import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  requireVisitorAdmin,
  visitorQrCode,
} from '@/lib/services/visitors.service'
import { Button } from '@/components/ui/button'
import { VisitorsTable } from '@/components/visitors/VisitorsTable'
import { VisitorQrPanel } from '@/components/visitors/VisitorQrPanel'
import { VisitorRefresh } from '@/components/visitors/VisitorRefresh'
import { Plus } from 'lucide-react'

export default async function VisitorsPage() {
  const ctx = await requireVisitorAdmin()
  const supabase = await createClient()

  const [visitors, portal] = await Promise.all([
    supabase
      .from('visitors')
      .select(
        'id, full_name, phone, email, first_visit_date, status, source, visitor_comments(count)'
      )
      .eq('church_id', ctx.churchId)
      .order('created_at', { ascending: false }),
    supabase
      .from('visitor_portals')
      .select('*')
      .eq('church_id', ctx.churchId)
      .maybeSingle(),
  ])
  if (visitors.error || portal.error)
    throw new Error('Unable to load visitors. Please try again shortly.')
  const qr = portal.data
    ? { ...portal.data, ...(await visitorQrCode(portal.data.token)) }
    : null

  return (
    <div className="space-y-6">
      <VisitorRefresh />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Visitors</h1>
        <Button
          nativeButton={false}
          render={<Link href="/admin/visitors/new" />}
        >
          <Plus className="h-4 w-4 mr-2" /> Add visitor
        </Button>
      </div>

      <VisitorQrPanel churchId={ctx.churchId} initial={qr} />
      <VisitorsTable visitors={visitors.data ?? []} />
    </div>
  )
}
