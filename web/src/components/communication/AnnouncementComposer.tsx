'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'

export function AnnouncementComposer({ churchId }: { churchId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    body: '',
    pinned: false,
    published: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in')
      if (!form.title.trim() || !form.body.trim())
        throw new Error('Enter a title and announcement text')
      const { error: err } = await supabase.from('announcements').insert({
        church_id: churchId,
        ...form,
        title: form.title.trim(),
        body: form.body.trim(),
        created_by: user.id,
        published_at: form.published ? new Date().toISOString() : null,
      })
      if (err) throw new Error(err.message)
      setForm({ title: '', body: '', pinned: false, published: true })
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Unable to post announcement'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={4}
              required
            />
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="pinned"
                checked={form.pinned}
                onCheckedChange={(v) => setForm({ ...form, pinned: !!v })}
              />
              <Label htmlFor="pinned">Pin to top</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="published"
                checked={form.published}
                onCheckedChange={(v) => setForm({ ...form, published: !!v })}
              />
              <Label htmlFor="published">Publish</Label>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? 'Posting...' : 'Post announcement'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
