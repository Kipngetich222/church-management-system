import { QRScanner } from '@/components/qr/QRScanner'
import { BackLink } from '@/components/shared/BackLink'

export default async function ScanPage() {
  return (
    <div className="max-w-md mx-auto space-y-4">
      <BackLink href="/member/home" label="Home" />

      <h1 className="text-2xl font-bold">Scan a church code</h1>
      <p className="text-sm text-muted-foreground">
        Point your camera at an event or service QR code to open it. Event
        codes show the venue or online link where you can register and buy
        tickets; service codes take you to the programme and check-in.
      </p>
      <QRScanner />
    </div>
  )
}
