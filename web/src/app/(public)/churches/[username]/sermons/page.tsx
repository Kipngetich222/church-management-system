import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'
import { SermonCard } from '@/components/sermons/SermonCard'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { BackLink } from '@/components/shared/BackLink'
import { BookOpen } from 'lucide-react'

export const revalidate = 60

async function loadChurch(username: string) {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('churches')
    .select('id, name, username')
    .eq('username', username)
    .maybeSingle()
  return data
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const church = await loadChurch(username)
  if (!church) return { title: 'Church not found' }
  return {
    title: `Sermons - ${church.name} - ChurchOnline`,
    description: `Watch and listen to published sermons from ${church.name}.`,
  }
}

export default async function SermonsPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const church = await loadChurch(username)
  if (!church) notFound()

  const supabase = createPublicClient()
  const { data: sermons } = await supabase
    .from('sermons')
    .select('id, title, speaker, youtube_id, thumbnail_url, series, scripture_ref, preached_at')
    .eq('church_id', church.id)
    .eq('published', true)
    .order('preached_at', { ascending: false })

  return (
    <div className="container mx-auto px-4 py-12">
      <BackLink href={`/churches/${church.username}`} label={church.name} />

      <div className="max-w-3xl mt-6 mb-10">
        <h1 className="text-4xl font-bold mb-3">Sermons</h1>
        <p className="text-muted-foreground">
          Watch and listen to messages from {church.name}.
        </p>
      </div>

      {!sermons?.length ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center space-y-3">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto" />
            <p className="font-medium">No sermons have been published yet.</p>
            <p className="text-sm text-muted-foreground">
              Messages published by {church.name} will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sermons.map((sermon) => (
            <SermonCard
              key={sermon.id}
              sermon={sermon}
              basePath={`/churches/${church.username}/sermons`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
