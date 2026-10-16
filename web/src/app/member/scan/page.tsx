import { QRScanner } from '@/components/qr/QRScanner'
import { BackLink } from '@/components/shared/BackLink'

export default async function ScanPage() {
  return (
    <div className="max-w-md mx-auto space-y-4">
      <BackLink href="/member/home" label="Home" />

      <h1 className="text-2xl font-bold">Scan an event code</h1>
      <p className="text-sm text-muted-foreground">
        Point your camera at an event QR code to open it — you can view the
        venue or online link, register and buy tickets from there.
      </p>
      <QRScanner />
    </div>
  )
}
