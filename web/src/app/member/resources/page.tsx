import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ResourceBookingForm } from '@/components/resources/ResourceBookingForm'
import { BookingCancelButton } from '@/components/resources/BookingCancelButton'
import { Building2, MapPin, Users } from 'lucide-react'

export default async function MemberResourcesPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .single()

  const [{ data: resources }, { data: bookings }] = await Promise.all([
    supabase
      .from('resources')
      .select('*')
      .eq('church_id', churchId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('resource_bookings')
      .select('*, resources(name)')
      .eq('church_id', churchId)
      .eq('membership_id', membership!.id)
      .gte('ends_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Book a resource</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: resources list */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase">Available resources</h2>
          {(!resources || resources.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No resources available for booking yet.
              </CardContent>
            </Card>
          )}
          {(resources ?? []).map((r: any) => (
            <Card key={r.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {r.type}
                      {r.capacity ? ` · up to ${r.capacity} people` : ''}
                    </div>
                    {r.location && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {r.location}
                      </div>
                    )}
                    {r.description && (
                      <p className="text-sm mt-2">{r.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: booking form + my bookings */}
        <div className="space-y-6">
          <ResourceBookingForm
            churchId={churchId}
            membershipId={membership!.id}
            resources={(resources ?? []) as any}
          />

          <Card>
            <CardHeader>
              <CardTitle>My bookings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(!bookings || bookings.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No bookings yet.
                </p>
              )}
              {(bookings ?? []).map((b: any) => (
                <div key={b.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{b.title}</div>
                      <div className="text-xs text-muted-foreground">{b.resources?.name}</div>
                    </div>
                    <Badge variant={
                      b.status === 'approved' ? 'default' :
                      b.status === 'rejected' ? 'destructive' : 'secondary'
                    }>
                      {b.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(b.starts_at), 'MMM d, h:mm a')} –{' '}
                    {format(new Date(b.ends_at), 'MMM d, h:mm a')}
                  </div>
                  {b.status !== 'cancelled' && b.status !== 'rejected' && (
                    <BookingCancelButton bookingId={b.id} />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}