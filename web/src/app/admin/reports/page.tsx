import { requirePermission } from '@/lib/auth/guard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Users, Calendar, DollarSign } from 'lucide-react'
import { userCan } from '@/lib/auth/permissions'
import Link from 'next/link'

export default async function ReportsPage() {
  const ctx = await requirePermission('reports:*')
  const canReadFinance = await userCan(ctx.churchId, ctx.role, 'finance:read')

  const reports = [
    ...(canReadFinance
      ? [
          {
            key: 'finance',
            label: 'Financial Report',
            icon: DollarSign,
            url: '/admin/finance/reports',
          },
        ]
      : []),
    {
      key: 'members',
      label: 'Member Directory',
      icon: Users,
      url: `/api/reports/members?churchId=${ctx.churchId}`,
    },
    {
      key: 'attendance',
      label: 'Attendance Summary',
      icon: Calendar,
      url: `/api/reports/attendance?churchId=${ctx.churchId}`,
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => {
          const Icon = r.icon
          return (
            <Card key={r.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" /> {r.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={r.url}>
                    <Download className="h-4 w-4 mr-2" />{' '}
                    {r.key === 'finance'
                      ? 'Choose period & download'
                      : 'Download PDF'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
