import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { LeadershipSection } from '@/components/churches/LeadershipSection'

export default async function MemberLeadershipPage() {
  const { churchId, church } = await getActiveChurch()
  const supabase = await createClient()

  const { data: leaders } = await supabase
    .from('church_leaders')
    .select('id, name, title, email, phone, image_url')
    .eq('church_id', churchId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Church leadership</h1>
        <p className="text-sm text-muted-foreground">
          Meet the people who lead {church?.name}. Reach out to any of them
          using the contact details below.
        </p>
      </div>

      {leaders && leaders.length > 0 ? (
        <LeadershipSection leaders={leaders} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Your church has not published its leadership structure yet.
        </p>
      )}
    </div>
  )
}
