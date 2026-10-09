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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('churches')
      .update(form)
      .eq('id', church.id)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">
          <LogoUpload
            churchId={church.id}
            currentUrl={form.logo_url}
            onUploaded={(url) => setForm({ ...form, logo_url: url })}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={church.slug} disabled />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
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
          <Label>Location</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Street address"
          />
          <MapPicker
            lat={form.latitude}
            lng={form.longitude}
            onPick={(lat, lng) =>
              setForm({ ...form, latitude: lat, longitude: lng })
            }
          />
          {form.latitude && form.longitude && (
            <p className="text-xs text-muted-foreground">
              Coordinates: {form.latitude.toFixed(5)},{' '}
              {form.longitude.toFixed(5)}
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  )
}
