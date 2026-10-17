'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolvePostAuthPath } from '@/lib/auth/redirect'
import {
  CATEGORY_OPTIONS,
  GENDER_OPTIONS,
  type MemberCategory,
} from '@/lib/auth/profile'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ProfileValues = {
  phone: string
  gender: string
  category: MemberCategory | ''
  date_of_birth: string
}

function Required() {
  return (
    <span className="text-destructive" aria-hidden>
      *
    </span>
  )
}

export function ProfileCompletionForm({
  initial,
}: {
  initial?: Partial<ProfileValues>
}) {
  const router = useRouter()
  const [form, setForm] = useState<ProfileValues>({
    phone: initial?.phone ?? '',
    gender: initial?.gender ?? '',
    category: initial?.category ?? '',
    date_of_birth: initial?.date_of_birth ?? '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError('')

    const missing: string[] = []
    if (!form.phone.trim()) missing.push('phone number')
    if (!form.gender) missing.push('gender')
    if (!form.category) missing.push('category')
    if (missing.length) {
      setError(`Please fill in: ${missing.join(', ')}.`)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('Your session has expired. Please sign in again.')
        return
      }

      const { error: saveError } = await supabase
        .from('users')
        .update({
          phone: form.phone.trim(),
          gender: form.gender,
          category: form.category as MemberCategory,
          date_of_birth: form.date_of_birth || null,
          profile_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (saveError) {
        setError(saveError.message)
        return
      }

      router.push(await resolvePostAuthPath(supabase, user.id))
      router.refresh()
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tell us about yourself</CardTitle>
        <CardDescription>
          We need a few details before you continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone number <Required />
            </Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+254 7xx xxx xxx"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              We use this to reach you about church services and events.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gender">
                Gender <Required />
              </Label>
              <Select
                value={form.gender}
                onValueChange={(v) => setForm({ ...form, gender: v as string })}
              >
                <SelectTrigger id="gender" className="w-full">
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
              <Label htmlFor="category">
                Category <Required />
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as MemberCategory })
                }
              >
                <SelectTrigger id="category" className="w-full">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={(e) =>
                setForm({ ...form, date_of_birth: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Optional - helps us celebrate birthdays with you.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Spinner className="mr-2" />
                Saving...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
