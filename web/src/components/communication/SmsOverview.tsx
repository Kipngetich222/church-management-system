import { createClient } from '@/lib/supabase/server'
import { communicationDb, type SmsSummary } from '@/lib/communication'
import { smsEnvironment } from '@/lib/services/communication.service'
import { SmsBalanceCards } from './SmsBalanceCards'

export async function SmsOverview({
  churchId,
  role,
  showBreakdown = false,
}: {
  churchId: string
  role: string
  showBreakdown?: boolean
}) {
  const { data, error } = await communicationDb(await createClient()).rpc(
    'sms_usage_summary',
    { p_church: churchId, p_environment: smsEnvironment() }
  )
  return (
    <SmsBalanceCards
      key={`${churchId}:${smsEnvironment()}`}
      churchId={churchId}
      role={role}
      environment={smsEnvironment()}
      initial={error ? null : (data as SmsSummary)}
      showBreakdown={showBreakdown}
    />
  )
}
