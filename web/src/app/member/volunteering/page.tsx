import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { SignUpShiftButton } from '@/components/volunteers/SignUpShiftButton'

export default async function VolunteeringPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .single()

  const { data: shifts } = await supabase
    .from('volunteer_shifts')
    .select(`
      *,
      volunteer_roles(name, color),
      volunteer_signups(id, membership_id, status)
    `)
    .eq('church_id', churchId)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(50)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Volunteer opportunities</h1>

      <div className="space-y-3">
        {shifts?.map((s: any) => {
          const signups = s.volunteer_signups ?? []
          const mine = signups.find((x: any) => x.membership_id === membership!.id)
          const filled = signups.filter((x: any) => x.status === 'confirmed').length
          const full = filled >= s.slots

          return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {s.volunteer_roles && (
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: s.volunteer_roles.color }}
                      />
                    )}
                    {s.title}
                  </div>
                  <Badge variant="secondary">
                    {filled}/{s.slots} filled
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{format(new Date(s.starts_at), 'EEE, MMM d · h:mm a')} – {format(new Date(s.ends_at), 'h:mm a')}</p>
                {s.location && <p className="text-xs text-muted-foreground">{s.location}</p>}
                {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}
                <SignUpShiftButton
                  shiftId={s.id}
                  membershipId={membership!.id}
                  signedUp={!!mine}
                  full={full}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}