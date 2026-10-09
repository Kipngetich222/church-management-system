'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ImageIcon, Loader2, X } from 'lucide-react'

export function PosterUpload({
  churchId,
  currentUrl,
  onUploaded,
}: {
  churchId: string
  currentUrl?: string | null
  onUploaded: (url: string) => void
}) {
  const [preview, setPreview] = useState(currentUrl ?? '')
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const supabase = createClient()
    const path = `${churchId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage
      .from('event-posters')
      .upload(path, file, { upsert: true })

    if (!error) {
      const { data } = supabase.storage.from('event-posters').getPublicUrl(path)
      setPreview(data.publicUrl)
      onUploaded(data.publicUrl)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Event poster</label>
      {preview ? (
        <div className="relative aspect-video max-w-md rounded-lg overflow-hidden border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Poster" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => {
              setPreview('')
              onUploaded('')
            }}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 max-w-md cursor-pointer hover:bg-muted/30">
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {uploading ? 'Uploading…' : 'Click to upload a poster'}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  )
}