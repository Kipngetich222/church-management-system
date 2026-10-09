import { getActiveChurch } from '@/lib/utils/church-scope'
import { GivingForm } from '@/components/finance/GivingForm'
import { MemberGivingHistory } from '@/components/finance/MemberGivingHistory'
import { createClient } from '@/lib/supabase/server'

export default async function GivingPage() {
  const { churchId, church } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .single()

  const { data: history } = await supabase
    .from('offerings')
    .select('id, amount, currency, type, given_at, receipt_number')
    .eq('membership_id', membership!.id)
    .order('given_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Giving</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <MemberGivingHistory offerings={history ?? []} />
        <GivingForm churchId={churchId} churchName={church?.name ?? ''} />
      </div>
    </div>
  )
}