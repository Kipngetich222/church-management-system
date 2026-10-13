'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { LogoUpload } from '@/components/shared/LogoUpload'
import { UsernameFeedback } from '@/components/shared/UsernameFeedback'
import { useChurchUsername } from '@/lib/hooks/useChurchUsername'
import { validateChurchUsername } from '@/lib/utils/church-username'
import { MapPicker } from '@/components/maps/MapPicker'

type Church = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  website: string | null
}

function Required() {
  return (
    <span className="text-destructive" aria-hidden>
      *
    </span>
  )
}

function OptionalHint() {
  return (
    <span className="text-xs font-normal text-muted-foreground">
      (optional)
    </span>
  )
}

export function ChurchProfileForm({ church }: { church: Church }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: church.name,
    username: church.slug,
    description: church.description ?? '',
    logo_url: church.logo_url ?? '',
    address: church.address ?? '',
    latitude: church.latitude,
    longitude: church.longitude,
    phone: church.phone ?? '',
    email: church.email ?? '',
    website: church.website ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const username = useChurchUsername(form.username, {
    excludeChurchId: church.id,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)

    const missing: string[] = []
    if (!form.name.trim()) missing.push('church name')
    if (!form.username.trim()) missing.push('username')
    if (!form.description.trim()) missing.push('description')
    if (!form.phone.trim()) missing.push('phone')
    if (!form.email.trim()) missing.push('email')
    if (!form.address.trim()) missing.push('address')
    if (form.latitude == null || form.longitude == null) {
      missing.push('location on the map')
    }
    if (missing.length) {
      setError(`Please fill in: ${missing.join(', ')}.`)
      return
    }

    const validation = validateChurchUsername(form.username)
    if (!validation.valid) {
      setError(validation.message)
      return
    }
    if (username.status === 'checking') {
      setError('Hold on while we check username availability.')
      return
    }
    if (username.status === 'taken') {
      setError('That username is already taken. Please choose another one.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('churches')
      .update({
        name: form.name.trim(),
        slug: validation.username,
        description: form.description.trim(),
        logo_url: form.logo_url || null,
        address: form.address.trim(),
        latitude: form.latitude,
        longitude: form.longitude,
        phone: form.phone.trim(),
        email: form.email.trim(),
        website: form.website.trim() || null,
      })
      .eq('id', church.id)

    if (err) {
      setError(
        err.code === '23505'
          ? 'That username is already taken. Please choose another one.'
          : err.message
      )
      setLoading(false)
      return
    }

    setSaved(true)
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Label>
              Logo <OptionalHint />
            </Label>
            <LogoUpload
              churchId={church.id}
              currentUrl={form.logo_url}
              onUploaded={(url) => setForm({ ...form, logo_url: url })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="church-name">
                Name <Required />
              </Label>
              <Input
                id="church-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="church-username">
                Username <Required />
              </Label>
              <Input
                id="church-username"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
                placeholder="grace-chapel"
              />
              <UsernameFeedback
                status={username.status}
                message={username.message}
              />
              <p className="text-xs text-muted-foreground">
                Your church&apos;s unique identifier. Used for its public link:
                /churches/{form.username || 'your-church'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="church-phone">
                Phone <Required />
              </Label>
              <Input
                id="church-phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="church-email">
                Email <Required />
              </Label>
              <Input
                id="church-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="church-website">
                Website <OptionalHint />
              </Label>
              <Input
                id="church-website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="church-description">
              Description <Required />
            </Label>
            <Textarea
              id="church-description"
              required
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Label htmlFor="church-address">
            Location <Required />
          </Label>
          <Input
            id="church-address"
            required
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Street address"
          />
          <MapPicker
            lat={form.latitude}
            lng={form.longitude}
            address={form.address}
            onPick={(lat, lng) =>
              setForm({ ...form, latitude: lat, longitude: lng })
            }
            onAddress={(address) => setForm({ ...form, address })}
          />
          {form.latitude == null || form.longitude == null ? (
            <p className="text-xs text-muted-foreground">
              Pick your church&apos;s position on the map.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-green-600">Church profile saved.</p>
      )}

      <Button
        type="submit"
        disabled={loading || username.status === 'checking'}
      >
        {loading ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  )
}
