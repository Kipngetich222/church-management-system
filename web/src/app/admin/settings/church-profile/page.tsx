import { getActiveChurch } from '@/lib/utils/church-scope'
import { ChurchProfileForm } from '@/components/settings/ChurchProfileForm'

export default async function ChurchProfilePage() {
  const { church, role } = await getActiveChurch()
  if (role !== 'super_admin') {
    return (
      <p className="text-muted-foreground">
        Only super admins can edit the church profile.
      </p>
    )
  }
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Church profile</h1>
      <ChurchProfileForm church={church} />
    </div>
  )
}
