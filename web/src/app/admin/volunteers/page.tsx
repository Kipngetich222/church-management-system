import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function VolunteersPage() {
  const ctx = await requirePermission('volunteers:read')
  const supabase = await createClient()

  const { data: shifts } = await supabase
    .from('volunteer_shifts')
    .select(`
      *,
      volunteer_roles(name, color),
      volunteer_signups(id, status, church_memberships(users(full_name)))
    `)
    .eq('church_id', ctx.churchId)
    .gte('starts_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('starts_at')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Volunteers</h1>
        <Button asChild>
          <Link href="/admin/volunteers/new"><Plus className="h-4 w-4 mr-2" /> New shift</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {shifts?.map((s: any) => (
          
<Card key={s.id}>
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      <Link href={`/admin/volunteers/${s.id}`} className="flex items-center gap-2 hover:underline">
        {s.volunteer_roles && (
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: s.volunteer_roles.color }}
          />
        )}
        {s.title}
      </Link>
      <Badge variant="secondary">
        {s.volunteer_signups?.length ?? 0}/{s.slots}
      </Badge>
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    <p className="text-sm">
      {format(new Date(s.starts_at), 'EEE, MMM d · h:mm a')} –{' '}
      {format(new Date(s.ends_at), 'h:mm a')}
    </p>
    <div className="flex flex-wrap gap-1">
      {(s.volunteer_signups ?? []).map((signup: any) => (
        <Badge key={signup.id} variant="outline">
          {signup.church_memberships?.users?.full_name ?? 'Unknown'}
        </Badge>
      ))}
    </div>
    <Button variant="outline" size="sm" asChild className="w-full">
      <Link href={`/admin/volunteers/${s.id}`}>Manage shift</Link>
    </Button>
  </CardContent>
</Card>
        ))}
      </div>
    </div>
  )
}