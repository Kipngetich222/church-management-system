'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { extractYoutubeId } from '@/lib/utils/youtube'

export function SermonForm({
  churchId,
  existing,
}: {
  churchId: string
  existing?: any
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    speaker: existing?.speaker ?? '',
    description: existing?.description ?? '',
    youtube_url: existing?.youtube_id ? `https://youtu.be/${existing.youtube_id}` : '',
    series: existing?.series ?? '',
    scripture_ref: existing?.scripture_ref ?? '',
    preached_at: existing?.preached_at ?? new Date().toISOString().slice(0, 10),
    tags: existing?.tags?.join(', ') ?? '',
    published: existing?.published ?? true,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const ytId = extractYoutubeId(form.youtube_url)
    if (!ytId) {
      setError('Could not extract YouTube ID from that URL')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const payload = {
      church_id: churchId,
      title: form.title,
      speaker: form.speaker || null,
      description: form.description || null,
      youtube_id: ytId,
      thumbnail_url: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
      series: form.series || null,
      scripture_ref: form.scripture_ref || null,
      preached_at: form.preached_at,
      tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      published: form.published,
    }

    const { error: err } = existing
      ? await supabase.from('sermons').update(payload).eq('id', existing.id)
      : await supabase.from('sermons').insert(payload)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push('/admin/sermons')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label>YouTube URL</Label>
            <Input
              value={form.youtube_url}
              onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Speaker</Label>
              <Input value={form.speaker} onChange={(e) => setForm({ ...form, speaker: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Preached on</Label>
              <Input type="date" value={form.preached_at} onChange={(e) => setForm({ ...form, preached_at: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Series</Label>
              <Input value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Scripture reference</Label>
              <Input value={form.scripture_ref} onChange={(e) => setForm({ ...form, scripture_ref: e.target.value })} placeholder="John 3:16" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Tags (comma-separated)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="pub" checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: !!v })} />
            <Label htmlFor="pub">Published</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : existing ? 'Save changes' : 'Add sermon'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
