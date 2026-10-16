'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, Loader2 } from 'lucide-react'
import { extractEventId, extractServiceId } from '@/lib/services/qr.service'

export function QRScanner() {
  const router = useRouter()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  async function startScan() {
    setError('')
    setScanning(true)

    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await scanner.stop()
          setScanning(false)
          const eventId = extractEventId(decodedText)
          if (eventId) {
            // Hand off to the redirect hub, which sends members to their event
            // page and everyone else to the public event page.
            router.push(`/e/${eventId}`)
            return
          }
          const serviceId = extractServiceId(decodedText)
          if (serviceId) {
            router.push(`/s/${serviceId}`)
            return
          }
          setError('That does not look like a church code.')
        },
        () => {}
      )
    } catch (e) {
      setScanning(false)
      setError(e instanceof Error ? e.message : 'Could not start the camera')
    }
  }

  useEffect(() => {
    return () => {
      scannerRef.current?.stop?.().catch(() => {})
    }
  }, [])

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div
          id="qr-reader"
          className="rounded-lg overflow-hidden border min-h-[250px] bg-black"
        />

        {!scanning && (
          <Button onClick={startScan} className="w-full">
            <Camera className="h-4 w-4 mr-2" /> Start scanning
          </Button>
        )}

        {scanning && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Point at the event QR
            code…
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
