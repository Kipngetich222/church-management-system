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
import { MapPicker } from '@/components/maps/MapPicker'
import { PhoneInput } from '@/components/shared/PhoneInput'

type Church = {
  id: string
  name: string
  username: string
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)

    const missing: string[] = []
    if (!form.name.trim()) missing.push('church name')
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

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('churches')
      .update({
        name: form.name.trim(),
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
      setError(err.message)
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
              <Label htmlFor="church-username">Username</Label>
              <Input
                id="church-username"
                readOnly
                disabled
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={church.username}
              />
              <p className="text-xs text-muted-foreground">
                Your church&apos;s unique identifier and public link:
                /churches/{church.username}. It was set when the church was
                created and cannot be changed.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="church-phone">
                Phone <Required />
              </Label>
              <PhoneInput
                id="church-phone"
                required
                value={form.phone}
                onChange={(phone) => setForm({ ...form, phone })}
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
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  )
}
