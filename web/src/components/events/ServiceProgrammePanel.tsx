'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileText, Loader2, Upload } from 'lucide-react'
import type { ServiceProgrammeRow } from '@/lib/constants/services'

/**
 * Upload the programme for a single occurrence. The programme is the only part
 * that changes week to week, so it is stored as a PDF per service date.
 */
export function ServiceProgrammePanel({
  churchId,
  serviceId,
  date,
  existing,
  existingUrl,
}: {
  churchId: string
  serviceId: string
  date: string
  existing: ServiceProgrammeRow | null
  existingUrl?: string | null
}) {
  const router = useRouter()
  const [filePath, setFilePath] = useState(existing?.file_path ?? '')
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileName, setFileName] = useState(existing?.file_name ?? '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // The bucket is private, so we open the file through a short-lived signed
  // URL. Fall back to whatever the server already resolved for older rows.
  const currentUrl = previewUrl || existingUrl || ''

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const supabase = createClient()
    const path = `${churchId}/${serviceId}/${date}-${Date.now()}-${file.name}`
    const { error: err } = await supabase.storage
      .from('service-programmes')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (err) {
      setError(err.message)
      setUploading(false)
      return
    }

    const { data: signed } = await supabase.storage
      .from('service-programmes')
      .createSignedUrl(path, 60 * 60)
    setFilePath(path)
    setPreviewUrl(signed?.signedUrl ?? '')
    setFileName(file.name)
    setUploading(false)
  }

  async function save() {
    if (!filePath) {
      setError('Upload a PDF programme first.')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('service_programmes').upsert(
      {
        church_id: churchId,
        recurring_service_id: serviceId,
        service_date: date,
        title: title.trim() || null,
        file_path: filePath,
        file_url: null,
        file_name: fileName || null,
      },
      { onConflict: 'recurring_service_id,service_date' }
    )
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Programme for {date}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-primary underline"
          >
            <FileText className="h-4 w-4" />{' '}
            {fileName || 'Current programme'}
          </a>
        )}

        <div className="space-y-2">
          <Label htmlFor="programme-title">Title (optional)</Label>
          <Input
            id="programme-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunday programme"
          />
        </div>

        <label className="flex items-center gap-3 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/30">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {uploading
              ? 'Uploading...'
              : filePath
                ? `Selected: ${fileName || 'programme.pdf'}`
                : 'Upload a PDF programme'}
          </span>
          <input type="file" accept="application/pdf" className="hidden" onChange={onFile} />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={save} disabled={saving || !filePath}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
            </>
          ) : (
            'Save programme'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
