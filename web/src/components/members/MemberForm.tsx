'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { BadgeChip } from '@/components/members/BadgeChip'
import { BadgeCard, BadgeToggleCard } from '@/components/members/BadgeCard'
import {
  MEMBER_CATEGORY_OPTIONS,
  MEMBER_GENDER_OPTIONS,
} from '@/lib/constants/members'
import type { MemberBadgeDefinition } from '@/lib/types/members'
import { cn } from '@/lib/utils'
import { Info, Mail, Smartphone } from 'lucide-react'

type Existing = {
  id: string
  user_id: string | null
  full_name: string
  email: string
  phone: string
  badges: string[]
  is_baptized: boolean
  date_of_birth: string | null
  gender: string | null
  category: string | null
  address: string | null
  is_manual: boolean
}

type Mode = 'manual' | 'invite'

export function MemberForm({
  churchId,
  isSuperAdmin,
  canAssignBadges = isSuperAdmin,
  badges,
  existing,
}: {
  churchId: string
  isSuperAdmin: boolean
  canAssignBadges?: boolean
  badges: MemberBadgeDefinition[]
  existing?: Existing
}) {
  const router = useRouter()
  const isEdit = Boolean(existing)

  const [mode, setMode] = useState<Mode>(
    existing ? (existing.user_id ? 'invite' : 'manual') : 'manual'
  )
  const [form, setForm] = useState({
    full_name: existing?.full_name ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    date_of_birth: existing?.date_of_birth ?? '',
    gender: existing?.gender ?? '',
    category: existing?.category ?? '',
    address: existing?.address ?? '',
    is_baptized: existing?.is_baptized ?? false,
    badges: existing?.badges ?? [],
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const effectiveMode: Mode = isEdit
    ? existing?.user_id
      ? 'invite'
      : 'manual'
    : mode
  const isManualMember = effectiveMode === 'manual'
  const emailOptional = effectiveMode === 'manual'
  const phoneRequired =
    effectiveMode === 'invite' || form.category !== 'children'

  function toggleBadge(name: string) {
    setForm((prev) => ({
      ...prev,
      badges: prev.badges.includes(name)
        ? prev.badges.filter((badge) => badge !== name)
        : [...prev.badges, name],
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const payload: Record<string, unknown> = {
      full_name: form.full_name,
      phone: form.phone,
      date_of_birth: form.date_of_birth,
      gender: form.gender,
      category: form.category || null,
      address: form.address,
    }

    if (emailOptional) payload.email = form.email
    if (canAssignBadges) payload.badges = form.badges
    if (isSuperAdmin) payload.is_baptized = form.is_baptized

    if (isEdit && existing) {
      const res = await fetch(`/api/members/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Failed to save changes')
        setLoading(false)
        return
      }
    } else {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId,
          mode: effectiveMode,
          ...payload,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Failed to create member')
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
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            {isEdit ? 'Edit member' : 'Add a member'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? 'Update this member’s profile and church role.'
              : 'Add someone who uses the app, or add a member manually for SMS and pastoral follow-up.'}
          </p>
        </div>

        {!isEdit ? (
          <div className="mb-6 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={cn(
                'rounded-xl border p-4 text-left transition hover:bg-muted/50',
                mode === 'manual'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border'
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <Smartphone className="h-4 w-4 text-primary" /> Manual member
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  No account
                </span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Best for children, the elderly, and anyone without a smartphone.
                Email is optional; add a phone number for SMS.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('invite')}
              className={cn(
                'rounded-xl border p-4 text-left transition hover:bg-muted/50',
                mode === 'invite'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border'
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <Mail className="h-4 w-4 text-primary" /> Invite by email
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Sends an account invitation so the member can sign in, give,
                volunteer, and manage their own profile.
              </span>
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.full_name}
                onChange={(event) =>
                  setForm({ ...form, full_name: event.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>
                Email{' '}
                {emailOptional ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                ) : (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Input
                type="email"
                value={form.email}
                disabled={isEdit && Boolean(existing?.user_id)}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                required={!emailOptional}
                placeholder={
                  emailOptional ? 'Not required for manual members' : ''
                }
              />
              {isEdit && existing?.user_id ? (
                <p className="text-xs text-muted-foreground">
                  The sign-in email is managed from the member’s account.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>
                Phone{' '}
                {phoneRequired ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional for children)
                  </span>
                )}
              </Label>
              <PhoneInput
                value={form.phone}
                onChange={(phone) => setForm({ ...form, phone })}
                required={phoneRequired}
              />
              {emailOptional ? (
                <p className="text-xs text-muted-foreground">
                  Phone numbers let the church communicate by SMS.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Date of birth</Label>
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={(event) =>
                  setForm({ ...form, date_of_birth: event.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={form.gender}
                onValueChange={(value) =>
                  setForm({ ...form, gender: value as string })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_GENDER_OPTIONS.map((option) => (
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
                onValueChange={(value) =>
                  setForm({ ...form, category: value as string })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
            </div>
          </div>

          {isManualMember ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-muted-foreground">
                This member has no app account. Their details are stored on the
                church list and can be reached by SMS where a phone number is
                available.
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Badges and church roles</Label>
              {canAssignBadges ? (
                <span className="text-xs text-muted-foreground">
                  Select every role this member serves in
                </span>
              ) : null}
            </div>

            {canAssignBadges ? (
              badges.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {badges.map((badge) => (
                    <BadgeToggleCard
                      key={badge.name}
                      badge={badge}
                      selected={form.badges.includes(badge.name)}
                      onToggle={() => toggleBadge(badge.name)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No badges have been created for this church yet.
                </p>
              )
            ) : (
              <div className="flex flex-wrap gap-2">
                {form.badges.length ? (
                  form.badges.map((badge) => (
                    <BadgeChip
                      key={badge}
                      badge={badge}
                      definition={badges.find(
                        (item) =>
                          item.name.toLowerCase() === badge.toLowerCase()
                      )}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No badges assigned yet.
                  </p>
                )}
                <p className="w-full text-xs text-muted-foreground">
                  Only a super admin can assign badges.
                </p>
              </div>
            )}
          </div>

          {canAssignBadges && form.badges.length ? (
            <div className="space-y-2">
              <Label>Badge preview</Label>
              <div className="flex flex-wrap gap-2">
                {form.badges.map((badge) => {
                  const definition = badges.find(
                    (item) => item.name.toLowerCase() === badge.toLowerCase()
                  )
                  return definition ? (
                    <BadgeCard
                      key={badge}
                      badge={definition}
                      compact
                      className="min-w-40"
                    />
                  ) : null
                })}
              </div>
            </div>
          ) : null}

          {isSuperAdmin ? (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="font-medium">Baptized</Label>
                <p className="text-xs text-muted-foreground">
                  Super admins only
                </p>
              </div>
              <Switch
                checked={form.is_baptized}
                onCheckedChange={(value) =>
                  setForm({ ...form, is_baptized: value })
                }
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading
                ? 'Saving...'
                : isEdit
                  ? 'Save changes'
                  : effectiveMode === 'manual'
                    ? 'Add member'
                    : 'Send invitation'}
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
