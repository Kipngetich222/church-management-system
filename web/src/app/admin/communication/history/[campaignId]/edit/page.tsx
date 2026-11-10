import { notFound, redirect } from 'next/navigation'
import { composerContext } from '@/lib/services/communication-page'
import { communicationEngine } from '@/lib/services/communication.service'
import { checked, type Campaign } from '@/lib/communication'
import { SMSComposer } from '@/components/communication/SMSComposer'

export default async function EditScheduledMessage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const { churchId, role, user, options } = await composerContext()
  const { campaignId } = await params
  const campaign = checked(
    await communicationEngine()
      .db.from('message_campaigns')
      .select('*')
      .eq('church_id', churchId)
      .eq('id', campaignId)
      .maybeSingle()
  ) as Campaign | null
  if (!campaign || (role !== 'super_admin' && campaign.created_by !== user.id))
    notFound()
  if (campaign.status !== 'scheduled' || !campaign.scheduled_at)
    redirect(`/admin/communication/history/${campaign.id}`)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit scheduled message</h1>
      <p className="text-sm text-muted-foreground">
        This message will use {campaign.created_by_name}’s current sending
        permissions.
      </p>
      <SMSComposer
        churchId={churchId}
        role={role}
        options={options}
        campaign={campaign}
      />
    </div>
  )
}
