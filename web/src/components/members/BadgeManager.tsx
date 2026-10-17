'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BadgeCard } from './BadgeCard'
import { BADGE_ICON_OPTIONS, BadgeIcon } from './BadgeIcon'
import { BADGE_COLOR_PRESETS } from '@/lib/constants/members'
import type { MemberBadgeDefinition } from '@/lib/types/members'
import { cn } from '@/lib/utils'

type FormState = {
  id?: string
  name: string
  description: string
  color: string
  icon: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  color: '#6366f1',
  icon: 'award',
}

function sortBadges(list: MemberBadgeDefinition[]) {
  return [...list].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
  )
}

export function BadgeManager({
  churchId,
  initialBadges,
}: {
  churchId: string
  initialBadges: MemberBadgeDefinition[]
}) {
  const router = useRouter()
  const [badges, setBadges] = useState(sortBadges(initialBadges))
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const preview = useMemo<MemberBadgeDefinition>(
    () => ({
      name: form.name.trim() || 'New church role',
      description:
        form.description.trim() || 'Describe how this role serves the church.',
      color: form.color,
      icon: form.icon,
    }),
    [form]
  )

  function resetForm() {
    setForm(EMPTY_FORM)
    setError('')
  }

  function startEdit(badge: MemberBadgeDefinition) {
    setForm({
      id: badge.id,
      name: badge.name,
      description: badge.description ?? '',
      color: badge.color,
      icon: badge.icon,
    })
    setError('')
  }

  async function saveBadge(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch(
        form.id ? `/api/members/badges/${form.id}` : '/api/members/badges',
        {
          method: form.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            churchId,
            name: form.name,
            description: form.description,
            color: form.color,
            icon: form.icon,
          }),
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Could not save this badge.')
        return
      }

      const saved = data.badge as MemberBadgeDefinition
      setBadges((current) => {
        if (form.id) {
          return sortBadges(
            current.map((badge) =>
              badge.id === saved.id
                ? { ...badge, ...saved, assignedCount: badge.assignedCount }
                : badge
            )
          )
        }
        return sortBadges([...current, saved])
      })
      resetForm()
      router.refresh()
    } catch {
      setError('Could not save this badge.')
    } finally {
      setSaving(false)
    }
  }

  async function removeBadge(badge: MemberBadgeDefinition) {
    if (!badge.id) return
    const confirmed = window.confirm(
      `Delete the “${badge.name}” badge? It will be removed from every member who currently has it.`
    )
    if (!confirmed) return

    setError('')
    try {
      const res = await fetch(
        `/api/members/badges/${badge.id}?churchId=${churchId}`,
        { method: 'DELETE' }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Could not delete this badge.')
        return
      }
      setBadges((current) => current.filter((item) => item.id !== badge.id))
      if (form.id === badge.id) resetForm()
      router.refresh()
    } catch {
      setError('Could not delete this badge.')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {form.id ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {form.id ? 'Edit badge' : 'Create a badge'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Any leadership or service role your church uses can become a badge.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveBadge} className="space-y-4">
            <div className="space-y-2">
              <Label>Role name</Label>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="e.g. Prayer team leader"
                required
                maxLength={60}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="What does this person do?"
                maxLength={240}
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={form.icon}
                onValueChange={(value) =>
                  setForm({ ...form, icon: value as string })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BADGE_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <BadgeIcon name={option.value} className="h-4 w-4" />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {BADGE_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use colour ${color}`}
                    onClick={() => setForm({ ...form, color })}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition hover:scale-110',
                      form.color === color
                        ? 'border-foreground ring-2 ring-foreground/20'
                        : 'border-white/70'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Choose a custom colour"
                  value={form.color}
                  onChange={(event) =>
                    setForm({ ...form, color: event.target.value })
                  }
                  className="h-7 w-9 cursor-pointer rounded border bg-transparent"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preview</Label>
              <BadgeCard badge={preview} />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : form.id ? 'Save badge' : 'Create badge'}
              </Button>
              {form.id ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Church badge catalogue</h2>
            <p className="text-sm text-muted-foreground">
              {badges.length} role{badges.length === 1 ? '' : 's'} available to
              assign to members.
            </p>
          </div>
        </div>

        {badges.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {badges.map((badge) => (
              <div key={badge.id ?? badge.name} className="group relative">
                <BadgeCard badge={badge} />
                <div className="mt-1 flex items-center justify-between gap-2 px-1">
                  <span className="text-[11px] text-muted-foreground">
                    {badge.assignedCount ?? 0} assigned
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Edit ${badge.name}`}
                      onClick={() => startEdit(badge)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete ${badge.name}`}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeBadge(badge)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No badges yet. Create the first one on the left.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
