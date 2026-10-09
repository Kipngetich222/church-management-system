import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { youtubeThumb } from '@/lib/utils/youtube'
import { format } from 'date-fns'
import { Play } from 'lucide-react'

export function SermonCard({ sermon, basePath }: { sermon: any; basePath: string }) {
  return (
    <Link href={`${basePath}/${sermon.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition">
        <div className="relative aspect-video bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sermon.thumbnail_url || youtubeThumb(sermon.youtube_id)}
            alt={sermon.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
            <Play className="h-12 w-12 text-white fill-white" />
          </div>
        </div>
        <CardContent className="pt-4 space-y-2">
          <h3 className="font-medium line-clamp-2">{sermon.title}</h3>
          <p className="text-sm text-muted-foreground">{sermon.speaker}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{format(new Date(sermon.preached_at), 'MMM d, yyyy')}</span>
            {sermon.series && <Badge variant="secondary">{sermon.series}</Badge>}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}