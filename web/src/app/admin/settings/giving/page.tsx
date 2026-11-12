import { getActiveChurch } from '@/lib/utils/church-scope'
import { givingEngine } from '@/lib/services/giving.service'
import { GivingSettingsForm } from '@/components/settings/GivingSettingsForm'

export default async function GivingSettingsPage() {
  const { user, churchId, role } = await getActiveChurch()
  if (role !== 'super_admin')
    return <p>Only a church super admin can change where giving is received.</p>
  const settings = await givingEngine().getSettings(user.id, churchId)
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Giving settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how the church receives giving. Members enter only an amount,
          their phone number and a giving type.
        </p>
      </div>
      <GivingSettingsForm
        key={churchId}
        churchId={churchId}
        initial={settings}
      />
    </div>
  )
}
