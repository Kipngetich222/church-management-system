'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Download, QrCode } from 'lucide-react'

export function ServiceQrPanel({
  serviceId,
  qrCode,
}: {
  serviceId: string
  qrCode: string | null
}) {
  const [code, setCode] = useState(qrCode ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/services/${serviceId}/qr`, { method: 'POST' })
      if (!res.ok) throw new Error('Could not generate the QR code.')
      const data = await res.json()
      if (!data.qr_code) throw new Error('Could not generate the QR code.')
      setCode(data.qr_code)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the QR code.')
    } finally {
      setBusy(false)
    }
  }

  function download() {
    const a = document.createElement('a')
    a.href = code
    a.download = `service-${serviceId}-qr.png`
    a.click()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" /> Check-in QR code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Print this and put it up at the entrance. Members scan it to open the
          service, follow the programme and check in on the day.
        </p>

        {code ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={code} alt="Service QR" className="h-56 w-56 rounded border" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={download}>
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
              <Button variant="ghost" onClick={generate} disabled={busy}>
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

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
