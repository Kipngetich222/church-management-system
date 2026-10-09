'use client'

import { youtubeEmbedUrl } from '@/lib/utils/youtube'

export function SermonPlayer({ youtubeId }: { youtubeId: string }) {
  return (
    <div className="relative aspect-video rounded-lg overflow-hidden border bg-black">
      <iframe
        src={youtubeEmbedUrl(youtubeId)}
        title="Sermon video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}