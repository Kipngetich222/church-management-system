import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { QRScanner } from '@/components/qr/QRScanner'

export default async function ScanPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .single()

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Scan attendance</h1>
      <p className="text-sm text-muted-foreground">
        Point your camera at the event QR code to check in.
      </p>
      <QRScanner churchId={churchId} membershipId={membership!.id} />
    </div>
  )
}