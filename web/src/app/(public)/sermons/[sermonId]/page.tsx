import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { SermonPlayer } from '@/components/sermons/SermonPlayer'
import { ShareButton } from '@/components/shared/ShareButton'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { ArrowLeft, BookOpen, User } from 'lucide-react'

export const revalidate = 60

async function loadSermon(id: string) {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('sermons')
    .select('*, churches(name, slug)')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()
  return data
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sermonId: string }>
}): Promise<Metadata> {
  const { sermonId } = await params
  const sermon = await loadSermon(sermonId)
  if (!sermon) return { title: 'Sermon not found' }
  return {
    title: `${sermon.title} — ChurchMS`,
    description: sermon.description ?? undefined,
  }
}

export default async function SermonPage({
  params,
}: {
  params: Promise<{ sermonId: string }>
}) {
  const { sermonId } = await params
  const sermon = await loadSermon(sermonId)
  if (!sermon) notFound()

  const churchRel = sermon.churches
  const church = Array.isArray(churchRel) ? churchRel[0] : churchRel
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/sermons" />}
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> All sermons
      </Button>

      <SermonPlayer youtubeId={sermon.youtube_id} />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {church && (
            <Link href={`/churches/${church.slug}`}>
              <Badge variant="secondary">{church.name}</Badge>
            </Link>
          )}
          {sermon.series && <Badge variant="outline">{sermon.series}</Badge>}
        </div>
        <h1 className="text-3xl font-bold">{sermon.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {sermon.speaker && (
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" /> {sermon.speaker}
            </span>
          )}
          <span className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />{' '}
            {format(new Date(sermon.preached_at), 'MMMM d, yyyy')}
          </span>
          {sermon.scripture_ref && <span>{sermon.scripture_ref}</span>}
        </div>
      </div>

      {sermon.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About this message</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {sermon.description}
            </p>
          </CardContent>
        </Card>
      )}

      {(sermon.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {(sermon.tags ?? []).map((tag: string) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <ShareButton
        url={`${baseUrl}/sermons/${sermon.id}`}
        title={sermon.title}
      />
    </div>
  )
}


