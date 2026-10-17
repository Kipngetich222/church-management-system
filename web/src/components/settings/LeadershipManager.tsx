'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ImageUpload } from '@/components/settings/ImageUpload'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Mail, Pencil, Phone, Plus, Trash2, X } from 'lucide-react'

export type Leader = {
  id: string
  name: string
  title: string
  email: string | null
  phone: string | null
  image_url: string | null
  sort_order: number
  created_at: string | null
}

type FormState = {
  id: string | null
  name: string
  title: string
  email: string
  phone: string
  image_url: string
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  title: '',
  email: '',
  phone: '',
  image_url: '',
}

export function LeadershipManager({
  churchId,
  leaders,
  canDelete,
}: {
  churchId: string
  leaders: Leader[]
  canDelete: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(leaders.length === 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function startAdd() {
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function startEdit(leader: Leader) {
    setForm({
      id: leader.id,
      name: leader.name,
      title: leader.title,
      email: leader.email ?? '',
      phone: leader.phone ?? '',
      image_url: leader.image_url ?? '',
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError('')

    if (!form.name.trim() || !form.title.trim()) {
      setError('A name and a role are required.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      title: form.title.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      image_url: form.image_url || null,
    }

    if (form.id) {
      const { error: updateError } = await supabase
        .from('church_leaders')
        .update(payload)
        .eq('id', form.id)
      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }
    } else {
      const nextOrder =
        leaders.reduce((max, l) => Math.max(max, l.sort_order), 0) + 1
      const { error: insertError } = await supabase
        .from('church_leaders')
        .insert({ church_id: churchId, sort_order: nextOrder, ...payload })
      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }
    }

    setForm(EMPTY_FORM)
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!canDelete) return
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('church_leaders')
      .delete()
      .eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
    }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {leaders.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {leaders.map((leader) => (
            <Card key={leader.id}>
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border bg-muted flex items-center justify-center">
                  {leader.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={leader.image_url}
                      alt={leader.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-muted-foreground">
                      {leader.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{leader.name}</p>
                  <p className="text-sm text-primary">{leader.title}</p>
                  {leader.email && (
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" /> {leader.email}
                    </p>
                  )}
                  {leader.phone && (
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" /> {leader.phone}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(leader)}
                    aria-label={`Edit ${leader.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(leader.id)}
                      disabled={loading}
                      aria-label={`Remove ${leader.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!showForm ? (
        <Button type="button" onClick={startAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add leader
        </Button>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {form.id ? 'Edit leader' : 'Add leader'}
                </h2>
                {leaders.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowForm(false)
                      setForm(EMPTY_FORM)
                      setError('')
                    }}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Full name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Pastor John Kamau"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Role <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="e.g. Senior Pastor"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <PhoneInput
                    value={form.phone}
                    onChange={(phone) => setForm({ ...form, phone })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Photo</Label>
                  <ImageUpload
                    churchId={churchId}
                    folder="leader"
                    currentUrl={form.image_url}
                    onUploaded={(url) => setForm({ ...form, image_url: url })}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading
                    ? 'Saving...'
                    : form.id
                      ? 'Save changes'
                      : 'Add leader'}
                </Button>
                {leaders.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setForm(EMPTY_FORM)
                      setError('')
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && !showForm && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
