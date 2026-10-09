import type { Metadata } from 'next'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase/public'
import { SermonCard } from '@/components/sermons/SermonCard'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sermons — ChurchMS',
  description: 'Watch and listen to recent sermons from churches on ChurchMS.',
}

export const revalidate = 60

export default async function SermonsPage() {
  const supabase = createPublicClient()
  const { data: sermons } = await supabase
    .from('sermons')
    .select('id, title, speaker, youtube_id, thumbnail_url, series, scripture_ref, preached_at, church_id, churches(name, slug)')
    .eq('published', true)
    .order('preached_at', { ascending: false })
    .limit(60)

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mb-10">
        <h1 className="text-4xl font-bold mb-3">Sermons</h1>
        <p className="text-muted-foreground">
          Catch up on recent messages from partner churches, any time.
        </p>
      </div>

      {!sermons?.length ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center space-y-3">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto" />
            <p className="font-medium">No sermons have been published yet.</p>
            <p className="text-sm text-muted-foreground">
              When churches share messages, they will appear here.
            </p>
            <Button nativeButton={false} render={<Link href="/register" />}>
              Get started
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sermons.map((sermon) => (
            <SermonCard key={sermon.id} sermon={sermon} basePath="/sermons" />
          ))}
        </div>
      )}
    </div>
  )
}
