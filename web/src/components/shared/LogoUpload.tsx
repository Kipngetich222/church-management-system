'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'

export const MAX_LOGO_BYTES = 5 * 1024 * 1024
const MAX_LOGO_LABEL = '5 MB'

export function LogoUpload({
  churchId,
  currentUrl,
  onUploaded,
}: {
  churchId: string
  currentUrl?: string | null
  onUploaded: (url: string) => void
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

    if (file.size > MAX_LOGO_BYTES) {
      setError(
        `Logo is too large. Please upload an image under ${MAX_LOGO_LABEL}.`
      )
      return
    }

    setUploading(true)
    const supabase = createClient()
    const extension = file.name.includes('.')
      ? file.name.split('.').pop()
      : 'png'
    const path = `${churchId}/logo-${Date.now()}.${extension}`
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
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Upload logo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFile}
          />
          <p className="text-xs text-muted-foreground">
            PNG, JPG, or WebP up to {MAX_LOGO_LABEL}.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
