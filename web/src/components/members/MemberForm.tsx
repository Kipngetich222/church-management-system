'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { BADGES } from '@/lib/constants/badges'
import { BadgeChip } from '@/components/members/BadgeChip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATEGORY_OPTIONS, GENDER_OPTIONS } from '@/lib/auth/profile'
import { cn } from '@/lib/utils'
import { ShareButton } from '@/components/shared/ShareButton'
import { PhoneInput } from '@/components/shared/PhoneInput'
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
  category: string | null
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
    category: existing?.category ?? '',
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

    if (isEdit && existing) {
      const res = await fetch(`/api/members/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          category: form.category || null,
          address: form.address,
          badges: form.badges,
          ...(isSuperAdmin ? { is_baptized: form.is_baptized } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Failed to save changes')
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
              <Label>
                Phone <span className="text-destructive">*</span>
              </Label>
              <PhoneInput
                value={form.phone}
                onChange={(phone) => setForm({ ...form, phone })}
                required
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
              <Select
                value={form.gender}
                onValueChange={(v) => setForm({ ...form, gender: v as string })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as string })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {isSuperAdmin ? (
              <>
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
                <p className="text-xs text-muted-foreground">
                  Badges are assigned by the church super admin.
                </p>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {form.badges.length ? (
                  form.badges.map((b) => <BadgeChip key={b} badge={b} />)
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No badges yet.
                  </p>
                )}
                <p className="w-full text-xs text-muted-foreground">
                  Only a super admin can assign badges.
                </p>
              </div>
            )}
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
