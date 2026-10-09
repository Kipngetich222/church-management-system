import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import Link from 'next/link'
import { BookingApprovalButtons } from '@/components/resources/BookingApprovalButtons'

export default async function ResourcesPage() {
  const ctx = await requirePermission('resources:*')
  const supabase = await createClient()

  const [{ data: resources }, { data: bookings }] = await Promise.all([
    supabase.from('resources').select('*').eq('church_id', ctx.churchId).eq('active', true).order('name'),
    supabase
      .from('resource_bookings')
      .select('*, resources(name), church_memberships(users(full_name))')
      .eq('church_id', ctx.churchId)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at'),
  ])

  const pending = (bookings ?? []).filter((b: any) => b.status === 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resources</h1>
        <Button asChild><Link href="/admin/resources/new">Add resource</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase">Resources</h2>
          {resources?.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="pt-6">
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-muted-foreground capitalize">{r.type} · {r.location ?? 'No location'}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
  <h2 className="text-sm font-medium text-muted-foreground uppercase">
    Pending approvals ({pending?.length ?? 0})
  </h2>
  {(pending ?? []).map((b: any) => (
    <Card key={b.id}>
      <CardContent className="pt-6 space-y-2">
        <div className="font-medium">{b.title}</div>
        <div className="text-sm text-muted-foreground">
          {b.resources?.name} · {format(new Date(b.starts_at), 'MMM d, h:mm a')}
        </div>
        <div className="text-xs text-muted-foreground">
          Requested by {b.church_memberships?.users?.full_name ?? 'Member'}
        </div>
        <BookingApprovalButtons bookingId={b.id} />
      </CardContent>
    </Card>
  ))}
</div>

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase">Upcoming bookings</h2>
          {bookings?.map((b: any) => (
            <Card key={b.id}>
              <CardContent className="pt-6 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{b.title}</span>
                  <Badge variant={
                    b.status === 'approved' ? 'default' :
                    b.status === 'rejected' ? 'destructive' : 'secondary'
                  }>{b.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {b.resources?.name} · {format(new Date(b.starts_at), 'MMM d, h:mm a')}
                </div>
                <div className="text-xs text-muted-foreground">
                  Booked by {b.church_memberships?.users?.full_name ?? 'Admin'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

