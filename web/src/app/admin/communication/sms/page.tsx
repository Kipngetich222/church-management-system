import { SMSComposer } from '@/components/communication/SMSComposer'
import { SmsOverview } from '@/components/communication/SmsOverview'
import { composerContext } from '@/lib/services/communication-page'

export default async function SMSComposerPage() {
  const { churchId, role, options } = await composerContext()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Compose a message</h1>
      <SmsOverview churchId={churchId} role={role} />
      <SMSComposer churchId={churchId} role={role} options={options} />
    </div>
  )
}
