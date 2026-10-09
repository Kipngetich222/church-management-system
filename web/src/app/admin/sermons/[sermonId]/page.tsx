import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { notFound } from 'next/navigation'
import { SermonForm } from '@/components/sermons/SermonForm'
import { SermonPlayer } from '@/components/sermons/SermonPlayer'
import { SermonDangerZone } from '@/components/sermons/SermonDangerZone'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Play } from 'lucide-react'

export default async function EditSermonPage({
  params,
}: {
  params: Promise<{ sermonId: string }>
}) {
  const { sermonId } = await params
  const ctx = await requirePermission('sermons:*')
  const supabase = await createClient()

  const { data: sermon } = await supabase
    .from('sermons')
    .select('*')
    .eq('id', sermonId)
    .eq('church_id', ctx.churchId)
    .single()

  if (!sermon) notFound()

  const isSuperAdmin = ctx.role === 'super_admin'

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Edit sermon</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4" /> Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SermonPlayer youtubeId={sermon.youtube_id} />
        </CardContent>
      </Card>

      <SermonForm churchId={ctx.churchId} existing={sermon} />

      {isSuperAdmin && <SermonDangerZone sermonId={sermonId} />}
    </div>
  )
}