import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { notFound } from 'next/navigation'
import { SermonPlayer } from '@/components/sermons/SermonPlayer'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export default async function SermonDetail({
  params,
}: {
  params: Promise<{ sermonId: string }>
}) {
  const { sermonId } = await params
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()

  const { data: sermon } = await supabase
    .from('sermons')
    .select('*')
    .eq('id', sermonId)
    .eq('church_id', churchId)
    .single()

  if (!sermon) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <SermonPlayer youtubeId={sermon.youtube_id} />
      <div>
        <h1 className="text-2xl font-bold">{sermon.title}</h1>
        <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
          {sermon.speaker && <span>{sermon.speaker}</span>}
          <span>· {format(new Date(sermon.preached_at), 'MMMM d, yyyy')}</span>
          {sermon.scripture_ref && <span>· {sermon.scripture_ref}</span>}
        </div>
        {sermon.series && (
          <Badge variant="secondary" className="mt-2">{sermon.series}</Badge>
        )}
      </div>
      {sermon.description && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{sermon.description}</p>
      )}
    </div>
  )
}