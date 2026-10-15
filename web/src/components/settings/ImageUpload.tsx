'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_LABEL = '5 MB'

/**
 * Small image picker that uploads to the public `church-assets` bucket.
 * Used for optional leadership photos.
 */
export function ImageUpload({
  churchId,
  folder,
  currentUrl,
  onUploaded,
  label = 'Upload photo',
}: {
  churchId: string
  folder: string
  currentUrl?: string | null
  onUploaded: (url: string) => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(currentUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Allow picking the same file again after an error.
    e.target.value = ''
    if (!file) return

    setError('')

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, or WebP).')
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image is too large. Please upload a file under ${MAX_IMAGE_LABEL}.`)
      return
    }

    setUploading(true)
    const supabase = createClient()
    const extension = file.name.includes('.')
      ? file.name.split('.').pop()
      : 'png'
    const path = `${churchId}/${folder}-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from('church-assets')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError(uploadError.message)
    } else {
      const { data } = supabase.storage.from('church-assets').getPublicUrl(path)
      setPreview(data.publicUrl)
      onUploaded(data.publicUrl)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border bg-muted flex items-center justify-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Leader"
              className="h-full w-full object-cover"
            />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {label}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFile}
          />
          <p className="text-xs text-muted-foreground">
            Optional. PNG, JPG, or WebP up to {MAX_IMAGE_LABEL}.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}