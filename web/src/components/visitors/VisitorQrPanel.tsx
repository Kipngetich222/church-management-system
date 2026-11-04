'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Download, ExternalLink, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  visitorWelcomeSchema,
  type VisitorPortalSettings,
} from '@/lib/visitors'

export type VisitorQr = VisitorPortalSettings & { qr_code: string; url: string }

export function VisitorQrPanel({
  churchId,
  initial,
}: {
  churchId: string
  initial: VisitorQr | null
}) {
  const router = useRouter()
  const [generated, setGenerated] = useState<VisitorQr | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const config = initial ?? generated
  const welcome = draft ?? config?.welcome_message ?? ''

  async function generate() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/churches/${churchId}/visitors/qr`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error ?? 'Could not generate the visitor QR code.')
      setGenerated(data)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function saveWelcome(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const parsed = visitorWelcomeSchema.safeParse({
        welcome_message: welcome,
      })
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)
      const response = await fetch(`/api/churches/${churchId}/visitors/qr`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error ?? 'Could not save the welcome message.')
      setDraft(data.welcome_message)
      setNotice('Welcome message saved. The QR code stays the same.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(config!.url)
      setNotice('Visitor link copied.')
      setError('')
    } catch {
      setError('Copy the visitor link from the field above.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" /> Visitor welcome QR code
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          One permanent code for your church. Every super admin can view and
          download it to display at the entrance or share with visitors.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {config ? (
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.qr_code}
                width={240}
                height={240}
                alt="Scan to register as a church visitor"
                className="rounded-lg border bg-white"
              />
              <Button
                variant="outline"
                className="w-full"
                render={
                  <a
                    href={config.qr_code}
                    download={`church-visitors-${churchId}.png`}
                  />
                }
              >
                <Download /> Download QR code
              </Button>
            </div>
            <div className="min-w-0 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="visitor-welcome-link">
                  Visitor welcome link
                </Label>
                <Input
                  id="visitor-welcome-link"
                  value={config.url}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={copyLink}>
                    <Copy /> Copy link
                  </Button>
                  <Button
                    variant="ghost"
                    render={
                      <a href={config.url} target="_blank" rel="noreferrer" />
                    }
                  >
                    <ExternalLink /> Open welcome page
                  </Button>
                </div>
              </div>
              <form onSubmit={saveWelcome} className="space-y-3">
                <Label htmlFor="visitor-welcome-message">Welcome message</Label>
                <Textarea
                  id="visitor-welcome-message"
                  value={welcome}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Visitors see this message before entering their details. You
                  can update it at any time.
                </p>
                <Button type="submit" disabled={busy || !welcome.trim()}>
                  {busy ? 'Saving...' : 'Save welcome message'}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <Button onClick={generate} disabled={busy}>
            <QrCode />
            {busy ? 'Generating...' : 'Generate visitor QR code'}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-primary">
            {notice}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
