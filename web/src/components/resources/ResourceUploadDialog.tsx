'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Loader2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DOCUMENT_ACCEPT,
  PHOTO_ACCEPT,
  RESOURCE_BUCKET,
  RESOURCE_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
} from '@/lib/resources'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ResourceUploadDialog({
  churchId,
  kind,
  onClose,
  onUploaded,
}: {
  churchId: string
  kind: 'document' | 'image'
  onClose: () => void
  onUploaded: (message: string) => void
}) {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('document')
  const [eventName, setEventName] = useState('')
  const [photoDate, setPhotoDate] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  )
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const isPhoto = kind === 'image'

  async function upload(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!files.length) return setError('Choose at least one file to upload.')
    if (files.length > 30) return setError('Upload up to 30 files at a time.')
    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      const mime = RESOURCE_MIME_TYPES[extension]
      if (typeof mime !== 'string' || mime.startsWith('image/') !== isPhoto) {
        return setError(
          `${file.name}: choose a supported ${isPhoto ? 'photo' : 'document or ebook'} format.`
        )
      }
      if (file.name.length > 255)
        return setError('Please shorten file names to 255 characters or less.')
      if (
        !file.size ||
        file.size > (isPhoto ? MAX_PHOTO_BYTES : MAX_DOCUMENT_BYTES)
      ) {
        return setError(
          `${file.name}: files must be non-empty and no larger than ${isPhoto ? '10' : '50'} MB.`
        )
      }
    }

    setBusy(true)
    const supabase = createClient()
    const completed: File[] = []
    try {
      for (const file of files) {
        setProgress(
          `Uploading ${completed.length + 1} of ${files.length}: ${file.name}`
        )
        const extension = file.name.split('.').pop()!.toLowerCase()
        const path = `${churchId}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from(RESOURCE_BUCKET)
          .upload(path, file, {
            contentType: RESOURCE_MIME_TYPES[extension],
            upsert: false,
          })
        if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`)

        const stem = file.name.replace(/\.[^.]+$/, '')
        const name = (
          title.trim()
            ? files.length === 1
              ? title.trim()
              : `${title.trim()} - ${stem}`
            : stem
        ).slice(0, 160)
        const { error: saveError } = await supabase.from('resources').insert({
          church_id: churchId,
          name: name || file.name,
          type: isPhoto ? 'image' : type,
          description: description.trim() || null,
          active: true,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: RESOURCE_MIME_TYPES[extension],
          event_name: isPhoto ? eventName.trim() || null : null,
          photo_date: isPhoto ? photoDate || null : null,
        })
        if (saveError) {
          const { error: cleanupError } = await supabase.storage
            .from(RESOURCE_BUCKET)
            .remove([path])
          throw new Error(
            `${file.name}: ${saveError.message}${cleanupError ? ' The unlisted upload could not be cleaned up.' : ''}`
          )
        }
        completed.push(file)
      }
      onUploaded(
        `${completed.length} ${isPhoto ? 'photo' : 'resource'}${completed.length === 1 ? '' : 's'} uploaded.`
      )
      router.refresh()
      onClose()
    } catch (err) {
      // Keep only unfinished files so retrying a partial batch never duplicates
      // resources that have already been published successfully.
      setFiles(files.filter((file) => !completed.includes(file)))
      setError(
        `${completed.length ? `${completed.length} uploaded successfully. ` : ''}${err instanceof Error ? err.message : 'Upload failed. Please try again.'}`
      )
      if (completed.length) router.refresh()
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>
            {isPhoto ? 'Upload photos' : 'Upload documents & books'}
          </DialogTitle>
          <DialogDescription>
            {isPhoto
              ? 'Choose photos and group them by an event or date.'
              : 'Share reading material that members can download anytime.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={upload} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            <div className="space-y-2">
              <Label htmlFor="resource-files">
                {isPhoto ? 'Photos' : 'Files'}
              </Label>
              <Input
                id="resource-files"
                type="file"
                multiple
                accept={isPhoto ? PHOTO_ACCEPT : DOCUMENT_ACCEPT}
                onChange={(event) => {
                  setFiles(Array.from(event.target.files ?? []))
                  setError('')
                }}
              />
              <p className="text-xs text-muted-foreground">
                {isPhoto
                  ? 'JPG, PNG, WebP or GIF. Up to 10 MB per photo.'
                  : 'PDF, EPUB, Word, text, presentations or spreadsheets. Up to 50 MB per file.'}{' '}
                Up to 30 files at a time.
              </p>
              {files.length > 0 && (
                <p className="text-sm break-words">
                  {files.length} selected:{' '}
                  {files.map((file) => file.name).join(', ')}
                </p>
              )}
            </div>
            {!isPhoto && (
              <div className="space-y-2">
                <Label htmlFor="resource-type">Category</Label>
                <select
                  id="resource-type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="document">Document</option>
                  <option value="book">Book / novel</option>
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="resource-title">
                {files.length > 1
                  ? 'Title prefix (optional)'
                  : 'Title (optional)'}
              </Label>
              <Input
                id="resource-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                placeholder="Uses the file name if left blank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-description">
                Description (optional)
              </Label>
              <Textarea
                id="resource-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>
            {isPhoto && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resource-event">
                    Event / album (optional)
                  </Label>
                  <Input
                    id="resource-event"
                    value={eventName}
                    onChange={(event) => setEventName(event.target.value)}
                    maxLength={160}
                    placeholder="e.g. Youth retreat"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resource-date">Photo date</Label>
                  <Input
                    id="resource-date"
                    type="date"
                    value={photoDate}
                    onChange={(event) => setPhotoDate(event.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {busy && (
            <p
              role="status"
              className="text-sm text-muted-foreground break-words"
            >
              {progress}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !files.length}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {busy ? 'Uploading…' : `Upload ${isPhoto ? 'photos' : 'files'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
