'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Download, QrCode } from 'lucide-react'

export function EventQrPanel({
  eventId,
  qrCode,
}: {
  eventId: string
  qrCode: string | null
}) {
  const [code, setCode] = useState(qrCode ?? '')
  const [busy, setBusy] = useState(false)

  async function generate() {
    setBusy(true)
    const res = await fetch(`/api/events/${eventId}/qr`, { method: 'POST' })
    const data = await res.json()
    if (data.qr_code) setCode(data.qr_code)
    setBusy(false)
  }

  function download() {
    const a = document.createElement('a')
    a.href = code
    a.download = `event-${eventId}-qr.png`
    a.click()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" /> Event QR code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Print this or share it on screens. Members scan it to check in.
        </p>

        {code ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={code} alt="Event QR" className="h-56 w-56 rounded border" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={download}>
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
              <Button variant="ghost" onClick={generate}>
                Regenerate
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={generate} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...
              </>
            ) : (
              'Generate QR code'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}