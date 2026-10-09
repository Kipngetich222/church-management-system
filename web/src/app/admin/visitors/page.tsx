import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { Button } from '@/components/ui/button'
import { VisitorsTable } from '@/components/visitors/VisitorsTable'
import { Plus } from 'lucide-react'

export default async function VisitorsPage() {
  const ctx = await requirePermission('visitors:*')
  const supabase = await createClient()

  const { data: visitors } = await supabase
    .from('visitors')
    .select('id, full_name, phone, email, first_visit_date, status')
    .eq('church_id', ctx.churchId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Visitors</h1>
        <Button
          nativeButton={false}
          render={<Link href="/admin/visitors/new" />}
        >
          <Plus className="h-4 w-4 mr-2" /> Add visitor
        </Button>
      </div>

      <VisitorsTable visitors={visitors ?? []} />
    </div>
  )
}
