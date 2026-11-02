import { notFound, redirect } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 60

export default async function SermonPage({
  params,
}: {
  params: Promise<{ sermonId: string }>
}) {
  const { sermonId } = await params
  const supabase = createPublicClient()
  const { data: sermon } = await supabase
    .from('sermons')
    .select('id, churches!inner(username)')
    .eq('id', sermonId)
    .eq('published', true)
    .maybeSingle()

  if (!sermon) notFound()
  redirect(`/churches/${sermon.churches.username}/sermons/${sermon.id}`)
}
