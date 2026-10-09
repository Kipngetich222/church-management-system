'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'

export function LogoUpload({
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
    const path = `${churchId}/logo-${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage
      .from('church-assets')
      .upload(path, file, { upsert: true })

    if (!error) {
      const { data } = supabase.storage.from('church-assets').getPublicUrl(path)
      setPreview(data.publicUrl)
      onUploaded(data.publicUrl)
    }
    setUploading(false)
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Logo"
            className="h-full w-full object-cover"
          />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <label>
        <Button variant="outline" disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Upload logo
        </Button>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </label>
    </div>
  )
}
