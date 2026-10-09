import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { SermonCard } from '@/components/sermons/SermonCard'

export default async function SermonsPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()

  const { data: sermons } = await supabase
    .from('sermons')
    .select('*')
    .eq('church_id', churchId)
    .eq('published', true)
    .order('preached_at', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sermons</h1>
      {(sermons?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground">No sermons published yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sermons!.map((s) => (
            <SermonCard key={s.id} sermon={s} basePath="/member/sermons" />
          ))}
        </div>
      )}
    </div>
  )
}