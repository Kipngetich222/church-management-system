import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { listDepartments } from '@/lib/services/departments.service'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'

export default async function DepartmentsPage() {
  const { churchId, role } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let departments = await listDepartments(churchId)

  if (role === 'dept_admin') {
    const { data: membership } = await supabase
      .from('church_memberships')
      .select('id')
      .eq('user_id', user!.id)
      .eq('church_id', churchId)
      .single()

    const { data: leads } = await supabase
      .from('department_members')
      .select('department_id')
      .eq('membership_id', membership!.id)
      .eq('is_leader', true)

    const allowed = new Set((leads ?? []).map((l) => l.department_id))
    departments = departments.filter((d: any) => allowed.has(d.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-6">
      <h1 className="text-2xl font-bold">Departments</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((d: any) => (
          <Link key={d.id} href={`/admin/departments/${d.id}`}>
            <Card>
              <CardContent className="pt-6">
                <div className="h-2 w-12 rounded-full mb-2" style={{ backgroundColor: d.color }} />
                <div className="font-semibold">{d.name}</div>
                <p className="text-sm text-muted-foreground">{d.department_members?.length ?? 0} members</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
        
        {role === 'super_admin' && (
  <Button asChild><Link href="/admin/departments/new">New department</Link></Button>
)}
      </div>

      {departments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No departments yet. Create one to organize your teams.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => {
            const members = d.department_members ?? []
            const leader = members.find((m) => m.is_leader)
            return (
              <Card key={d.id} className="hover:shadow-md transition">
                <Link href={`/admin/departments/${d.id}`}>
                  <CardHeader>
                    <div
                      className="h-2 w-12 rounded-full mb-2"
                      style={{ backgroundColor: d.color ?? undefined }}
                    />
                    <CardTitle className="flex items-center justify-between">
                      {d.name}
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {members.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {d.description || 'No description'}
                    </p>
                    {leader && (
                      <p className="text-xs text-muted-foreground">
                        Led by{' '}
                        <strong>
                          {leader.church_memberships?.users?.full_name}
                        </strong>
                      </p>
                    )}
                  </CardContent>
                </Link>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
