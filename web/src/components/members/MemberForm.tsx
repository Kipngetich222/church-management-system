'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { BADGES } from '@/lib/constants/badges'
import { cn } from '@/lib/utils'
import { ShareButton } from '@/components/shared/ShareButton'
import type { Database } from '@/types/database'

type BadgeType = Database['public']['Enums']['badge_type']

type Existing = {
  id: string
  user_id: string
  full_name: string
  email: string
  phone: string
  badges: BadgeType[]
  is_baptized: boolean
  date_of_birth: string | null
  gender: string | null
  address: string | null
}

export function MemberForm({
  churchId,
  isSuperAdmin,
  existing,
}: {
  churchId: string
  isSuperAdmin: boolean
  existing?: Existing
}) {
  const router = useRouter()
  const isEdit = !!existing

  const [form, setForm] = useState({
    full_name: existing?.full_name ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    date_of_birth: existing?.date_of_birth ?? '',
    gender: existing?.gender ?? '',
    address: existing?.address ?? '',
    is_baptized: existing?.is_baptized ?? false,
    badges: existing?.badges ?? ([] as BadgeType[]),
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function toggleBadge(b: BadgeType) {
    setForm((prev) => ({
      ...prev,
      badges: prev.badges.includes(b)
        ? prev.badges.filter((x) => x !== b)
        : [...prev.badges, b],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    if (isEdit && existing) {
      // Update users table
      await supabase
        .from('users')
        .update({
          full_name: form.full_name,
          phone: form.phone,
        })
        .eq('id', existing.user_id)

      // Update membership
      const { error: err } = await supabase
        .from('church_memberships')
        .update({
          badges: form.badges,
          is_baptized: isSuperAdmin ? form.is_baptized : existing.is_baptized,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          address: form.address || null,
        })
        .eq('id', existing.id)

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
    } else {
      // Create — but we can't create auth.users from client.
      // We call an admin API route that uses service_role.
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchId, ...form }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create member')
        setLoading(false)
        return
      }
    }

    router.push('/admin/members')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Form Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isEdit ? 'Edit member' : 'Create member'}
            </h2>

            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Update this member’s information.'
                : 'Add a new church member.'}
            </p>
          </div>

          {isEdit && existing && (
            <ShareButton
              url={`${typeof window !== 'undefined' ? location.origin : ''}/members/${existing.id}`}
              title={`${existing.full_name} — Church member`}
            />
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={isEdit}
                required={!isEdit}
              />

              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed here.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+254..."
              />
            </div>

            <div className="space-y-2">
              <Label>Date of birth</Label>
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={(e) =>
                  setForm({ ...form, date_of_birth: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Input
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                placeholder="male / female / other"
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Badges</Label>

            <div className="flex flex-wrap gap-2">
              {BADGES.map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => toggleBadge(b)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs capitalize transition',
                    form.badges.includes(b)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {isSuperAdmin && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="font-medium">Baptized</Label>

                <p className="text-xs text-muted-foreground">
                  Super admins only
                </p>
              </div>

              <Switch
                checked={form.is_baptized}
                onCheckedChange={(v) => setForm({ ...form, is_baptized: v })}
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading
                ? 'Saving...'
                : isEdit
                  ? 'Save changes'
                  : 'Create member'}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
