'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  BookOpen,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  fileSizeLabel,
  resourceFileUrl,
  RESOURCE_BUCKET,
  type LibraryResource,
} from '@/lib/resources'
import { ResourceUploadDialog } from './ResourceUploadDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function DownloadButton({ resource }: { resource: LibraryResource }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function download() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(resourceFileUrl(resource), {
        cache: 'no-store',
      })
      const data = await response.json()
      if (!response.ok || !data.url)
        throw new Error(data.error || 'Unable to download this file.')
      const link = document.createElement('a')
      link.href = data.url
      link.download = resource.file_name
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Download failed. Please try again.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        onClick={download}
        disabled={busy}
        aria-label={`Download ${resource.name}`}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}{' '}
        Download
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function ResourceImage({
  resource,
  large = false,
}: {
  resource: LibraryResource
  large?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  if (failed)
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 bg-muted p-4 text-muted-foreground">
        <ImageIcon className="size-8" />
        <span className="text-sm">Preview unavailable</span>
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            setFailed(false)
            setAttempt((value) => value + 1)
          }}
        >
          Retry preview
        </Button>
      </div>
    )
  // Private, authenticated image route: the standard img element retains session
  // cookies, whereas a remote image optimizer cannot authenticate this request.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${resourceFileUrl(resource, true)}&attempt=${attempt}`}
      alt={resource.name}
      loading={large ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={
        large
          ? 'max-h-[65dvh] w-full rounded-lg object-contain'
          : 'aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]'
      }
    />
  )
}

function dateKey(resource: LibraryResource) {
  return resource.photo_date || resource.created_at?.slice(0, 10) || ''
}
function dateLabel(date: string) {
  return date ? format(parseISO(date), 'd MMMM yyyy') : 'Undated photos'
}

export function ResourceLibrary({
  churchId,
  resources,
  canManage = false,
}: {
  churchId: string
  resources: LibraryResource[]
  canManage?: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [groupBy, setGroupBy] = useState('date')
  const [tab, setTab] = useState('documents')
  const [uploadKind, setUploadKind] = useState<'document' | 'image' | null>(
    null
  )
  const [preview, setPreview] = useState<LibraryResource | null>(null)
  const [deleting, setDeleting] = useState<LibraryResource | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [notice, setNotice] = useState('')
  const documents = resources.filter((resource) => resource.type !== 'image')
  const photos = resources.filter((resource) => resource.type === 'image')
  const search = query.trim().toLowerCase()
  const matches = (resource: LibraryResource) =>
    [
      resource.name,
      resource.file_name,
      resource.description,
      resource.event_name,
      resource.photo_date,
    ].some((value) => value?.toLowerCase().includes(search))
  const filteredDocuments = documents.filter(
    (resource) =>
      matches(resource) && (category === 'all' || resource.type === category)
  )
  const filteredPhotos = photos
    .filter(matches)
    .sort((a, b) => dateKey(b).localeCompare(dateKey(a)))
  const groups = new Map<string, { label: string; photos: LibraryResource[] }>()
  for (const photo of filteredPhotos) {
    const label =
      groupBy === 'event'
        ? photo.event_name?.trim() || 'Other photos'
        : dateLabel(dateKey(photo))
    const key =
      groupBy === 'event'
        ? photo.event_name?.trim().toLowerCase() || '__ungrouped'
        : dateKey(photo)
    const group = groups.get(key) ?? { label, photos: [] }
    group.photos.push(photo)
    groups.set(key, group)
  }

  async function removeResource() {
    if (!deleting || busy) return
    setBusy(true)
    setDeleteError('')
    try {
      const supabase = createClient()
      const { error: storageError } = await supabase.storage
        .from(RESOURCE_BUCKET)
        .remove([deleting.file_path])
      if (storageError) throw new Error(storageError.message)
      const { data, error } = await supabase
        .from('resources')
        .delete()
        .eq('church_id', churchId)
        .eq('id', deleting.id)
        .select('id')
        .single()
      if (error || !data)
        throw new Error('Unable to remove the library entry. Please retry.')
      setNotice(`“${deleting.name}” removed.`)
      setDeleting(null)
      router.refresh()
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Unable to remove this resource.'
      )
    } finally {
      setBusy(false)
    }
  }

  const deleteButton = (resource: LibraryResource) =>
    canManage && (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${resource.name}`}
        onClick={() => {
          setDeleting(resource)
          setDeleteError('')
        }}
      >
        <Trash2 className="size-4 text-muted-foreground" />
      </Button>
    )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? 'Share documents, books and church memories with your members.'
              : 'Find something to read, browse church photos and download your favourites.'}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setUploadKind('image')}>
              <ImageIcon className="size-4" /> Upload photos
            </Button>
            <Button onClick={() => setUploadKind('document')}>
              <Upload className="size-4" /> Upload files
            </Button>
          </div>
        )}
      </div>
      {notice && (
        <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
          {notice}
        </p>
      )}
      <div className="relative max-w-lg">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          aria-label="Search resources and photos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, event or date…"
          className="pl-9"
        />
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(String(value))}
        className="gap-5"
      >
        <TabsList className="h-10 max-w-full">
          <TabsTrigger value="documents" className="px-3">
            <BookOpen /> Documents & books{' '}
            <span className="text-xs">({documents.length})</span>
          </TabsTrigger>
          <TabsTrigger value="photos" className="px-3">
            <ImageIcon /> Photos{' '}
            <span className="text-xs">({photos.length})</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Documents & books</h2>
            <select
              aria-label="Filter resource category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="all">All files</option>
              <option value="document">Documents</option>
              <option value="book">Books & novels</option>
            </select>
          </div>
          {!filteredDocuments.length && (
            <EmptyState
              kind="documents"
              filtered={!!search || category !== 'all'}
              canManage={canManage}
            />
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDocuments.map((resource) => (
              <Card key={resource.id}>
                <CardContent className="flex h-full flex-col gap-4 pt-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-3 text-primary">
                      {resource.type === 'book' ? (
                        <BookOpen className="size-5" />
                      ) : (
                        <FileText className="size-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium break-words">
                        {resource.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {resource.file_name.split('.').pop()?.toUpperCase()} ·{' '}
                        {fileSizeLabel(resource.file_size)}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {resource.type === 'book' ? 'Book' : 'Document'}
                    </Badge>
                  </div>
                  {resource.description && (
                    <p className="line-clamp-3 text-sm text-muted-foreground break-words">
                      {resource.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-end justify-between gap-2">
                    <DownloadButton resource={resource} />
                    {deleteButton(resource)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="photos" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Photo gallery</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open any photo to view it in full.
              </p>
            </div>
            <select
              aria-label="Group photos"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value)}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="date">Group by date</option>
              <option value="event">Group by event</option>
            </select>
          </div>
          {!filteredPhotos.length && (
            <EmptyState
              kind="photos"
              filtered={!!search}
              canManage={canManage}
            />
          )}
          {Array.from(groups, ([key, group]) => (
            <section key={key} className="space-y-3">
              <h3 className="font-medium break-words">
                {group.label}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  ({group.photos.length})
                </span>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.photos.map((photo) => (
                  <Card key={photo.id} className="overflow-hidden py-0">
                    <div className="group relative overflow-hidden bg-muted">
                      <ResourceImage resource={photo} />
                      <Button
                        variant="secondary"
                        className="absolute right-2 bottom-2"
                        onClick={() => setPreview(photo)}
                        aria-label={`View ${photo.name}`}
                      >
                        View photo
                      </Button>
                    </div>
                    <CardContent className="space-y-3 p-4">
                      <div>
                        <h4 className="truncate font-medium" title={photo.name}>
                          {photo.name}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateLabel(dateKey(photo))} ·{' '}
                          {fileSizeLabel(photo.file_size)}
                        </p>
                        {photo.event_name && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {photo.event_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <DownloadButton resource={photo} />
                        {deleteButton(photo)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </TabsContent>
      </Tabs>
      {uploadKind && (
        <ResourceUploadDialog
          churchId={churchId}
          kind={uploadKind}
          onClose={() => setUploadKind(null)}
          onUploaded={(message) => {
            setNotice(message)
            setTab(uploadKind === 'image' ? 'photos' : 'documents')
          }}
        />
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
      >
        {preview && (
          <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="pr-6 break-words">
                {preview.name}
              </DialogTitle>
              <DialogDescription>
                {[preview.event_name, dateLabel(dateKey(preview))]
                  .filter(Boolean)
                  .join(' · ')}
              </DialogDescription>
            </DialogHeader>
            <ResourceImage key={preview.id} resource={preview} large />
            {preview.description && (
              <p className="text-sm break-words">{preview.description}</p>
            )}
            <DownloadButton resource={preview} />
          </DialogContent>
        )}
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null)
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Delete resource?</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” will be removed from the library and members
              will no longer be able to download it.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={removeResource}
            >
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyState({
  kind,
  filtered,
  canManage,
}: {
  kind: 'documents' | 'photos'
  filtered: boolean
  canManage: boolean
}) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      {kind === 'photos' ? (
        <ImageIcon className="mx-auto mb-3 size-9 text-muted-foreground" />
      ) : (
        <BookOpen className="mx-auto mb-3 size-9 text-muted-foreground" />
      )}
      <p className="font-medium">
        {filtered
          ? 'No matches found'
          : kind === 'photos'
            ? 'No photos yet'
            : 'No documents or books yet'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {filtered
          ? 'Try another search or filter.'
          : canManage
            ? `Upload ${kind === 'photos' ? 'photos to start your church gallery' : 'files to start your resource library'}.`
            : 'Resources shared by your church will appear here.'}
      </p>
    </div>
  )
}
