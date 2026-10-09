'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function MemberSelfEditForm({ membership }: { membership: any }) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: membership?.users?.full_name ?? '',
    phone: membership?.users?.phone ?? '',
    address: membership?.address ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('users').update({ full_name: form.full_name, phone: form.phone }).eq('id', membership.users.id),
      supabase
        .from('church_memberships')
        .update({ address: form.address })
        .eq('id', membership.id),
    ])

    if (e1 || e2) {
      setError(e1?.message || e2?.message || 'Save failed')
      setLoading(false)
      return
    }
    router.push('/member/profile')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

