'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PhoneInput } from '@/components/shared/PhoneInput'
import {
  newVisitorSessionToken,
  visitorRegistrationSchema,
} from '@/lib/visitors'

export function VisitorRegistrationForm({
  token,
  churchName,
}: {
  token: string
  churchName: string
}) {
  const router = useRouter()
  const registrationToken = useRef('')
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    comment: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const key = `visitor-registration-${token}`
      if (!registrationToken.current) {
        try {
          registrationToken.current = sessionStorage.getItem(key) ?? ''
        } catch {
          /* Storage may be disabled. */
        }
        if (!/^[0-9a-f]{64}$/.test(registrationToken.current))
          registrationToken.current = newVisitorSessionToken()
        try {
          sessionStorage.setItem(key, registrationToken.current)
        } catch {
          /* The in-memory key still deduplicates retries. */
        }
      }
      const parsed = visitorRegistrationSchema.safeParse({
        ...form,
        registrationToken: registrationToken.current,
      })
      if (!parsed.success)
        throw new Error(
          parsed.error.issues[0]?.message ?? 'Please check your details.'
        )
      const response = await fetch(`/api/visitors/${token}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const data = await response.json()
      if (data.code === 'VISITOR_SESSION_EXPIRED') {
        registrationToken.current = ''
        try {
          sessionStorage.removeItem(key)
        } catch {
          /* The in-memory token has also been reset. */
        }
        throw new Error(
          'Your saved registration has expired. Please submit your details again.'
        )
      }
      if (!response.ok)
        throw new Error(
          data.error ?? 'We could not save your details. Please try again.'
        )
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* Optional browser storage. */
      }
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Please check your connection and try again.'
      )
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-xl">Tell us about yourself</CardTitle>
        <p className="text-sm text-muted-foreground">
          No account needed. Your name is required; the other fields are
          optional.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="visitor-name">Full name</Label>
            <Input
              id="visitor-name"
              autoComplete="name"
              required
              disabled={busy}
              maxLength={160}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="visitor-phone">Phone number (optional)</Label>
            <PhoneInput
              id="visitor-phone"
              autoComplete="tel"
              disabled={busy}
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="visitor-email">Email address (optional)</Label>
            <Input
              id="visitor-email"
              type="email"
              disabled={busy}
              autoComplete="email"
              maxLength={254}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="visitor-comment">
              Anything you would like to share? (optional)
            </Label>
            <Textarea
              id="visitor-comment"
              disabled={busy}
              maxLength={2000}
              rows={3}
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="A comment, question or message for the church team"
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your details and comments are shared with the super admins of{' '}
            {churchName} to welcome you and help with follow-up.{' '}
            <Link
              href="/privacy"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Privacy policy
            </Link>
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="h-11 w-full">
            {busy ? (
              <>
                <Loader2 className="animate-spin" /> Saving your details...
              </>
            ) : (
              <>
                Continue to church programme <ArrowRight />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
