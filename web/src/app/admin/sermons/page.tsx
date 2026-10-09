import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { Button } from '@/components/ui/button'
import { SermonCard } from '@/components/sermons/SermonCard'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function AdminSermonsPage() {
  const ctx = await requirePermission('sermons:*')
  const supabase = await createClient()
  const { data: sermons } = await supabase
    .from('sermons')
    .select('*')
    .eq('church_id', ctx.churchId)
    .order('preached_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sermons</h1>
        <Button asChild>
          <Link href="/admin/sermons/new"><Plus className="h-4 w-4 mr-2" /> Add sermon</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sermons!.map((s) => (
          <SermonCard key={s.id} sermon={s} basePath="/admin/sermons" />
        ))}
      </div>
    </div>
  )
}