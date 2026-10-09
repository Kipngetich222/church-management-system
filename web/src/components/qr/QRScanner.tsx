'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, XCircle, Camera } from 'lucide-react'

export function QRScanner({
  churchId,
  membershipId,
}: {
  churchId: string
  membershipId: string
}) {
  const router = useRouter()
  const scannerRef = useRef<any>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function startScan() {
    setResult(null)
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
          await handleDecoded(decodedText)
        },
        () => {}
      )
    } catch (e: any) {
      setScanning(false)
      setResult({ ok: false, message: e.message ?? 'Could not start camera' })
    }
  }

  async function handleDecoded(text: string) {
    let payload: any
    try {
      payload = JSON.parse(text)
    } catch {
      setResult({ ok: false, message: 'Invalid QR code' })
      return
    }
    if (payload.t !== 'event' || payload.c !== churchId) {
      setResult({ ok: false, message: 'This QR is not for this church' })
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('event_attendance').insert({
      event_id: payload.e,
      membership_id: membershipId,
      method: 'qr',
    })

    if (error) {
      setResult({ ok: false, message: error.message })
      return
    }
    setResult({ ok: true, message: 'Attendance recorded. God bless!' })
    router.refresh()
  }

  useEffect(() => {
    return () => {
      scannerRef.current?.stop?.().catch(() => {})
    }
  }, [])

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div id="qr-reader" className="rounded-lg overflow-hidden border min-h-[250px] bg-black" />

        {!scanning && !result && (
          <Button onClick={startScan} className="w-full">
            <Camera className="h-4 w-4 mr-2" /> Start scanning
          </Button>
        )}

        {result && (
          <div className={`flex items-center gap-2 p-4 rounded-lg ${
            result.ok ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
          }`}>
            {result.ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            <span className="text-sm font-medium">{result.message}</span>
          </div>
        )}

        {result && (
          <Button variant="outline" onClick={startScan} className="w-full">
            Scan another
          </Button>
        )}
      </CardContent>
    </Card>
  )
}