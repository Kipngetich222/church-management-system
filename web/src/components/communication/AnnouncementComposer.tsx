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
    const supabase = createClient()

    const { error: err } = await supabase.from('announcements').insert({
      church_id: churchId,
      ...form,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setForm({ title: '', body: '', pinned: false, published: true })
    router.refresh()
    setLoading(false)
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