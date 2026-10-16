'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Download, Loader2, QrCode } from 'lucide-react'

/**
 * Shown on the event page right after an event is created. Asks the admin
 * whether they want a QR code; generating it attaches the code to the event so
 * every admin can view or download it later.
 */
export function QrPrompt({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/events/${eventId}/qr`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || !data.qr_code) {
      setError(data.error ?? 'Could not generate the QR code')
      return
    }
    setCode(data.qr_code)
    router.refresh()
  }

  function download() {
    const a = document.createElement('a')
    a.href = code
    a.download = `event-${eventId}-qr.png`
    a.click()
  }

  if (code) {
    return (
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> QR code ready
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={code} alt="Event QR" className="h-56 w-56 rounded border" />
          <p className="text-sm text-muted-foreground">
            This QR code is saved on the event — any admin can view or download it.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={download}>
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
            <Button onClick={() => router.replace('/admin/events')}>
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" /> Event saved — generate a QR code?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Members and visitors can scan it to open the event page. It stays
          attached to the event for any admin to view or download.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4 mr-2" />
            )}
            Yes, generate QR code
          </Button>
          <Button
            variant="outline"
            onClick={() => router.replace('/admin/events')}
            disabled={busy}
          >
            No, go to events
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
