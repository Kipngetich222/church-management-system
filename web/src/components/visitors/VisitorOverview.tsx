import Link from 'next/link'
import { UserRoundPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { VisitorRefresh } from '@/components/visitors/VisitorRefresh'

export async function VisitorOverview({ churchId }: { churchId: string }) {
  const supabase = await createClient()
  const [total, fresh, recent] = await Promise.all([
    supabase
      .from('visitors')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId),
    supabase
      .from('visitors')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('status', 'new'),
    supabase
      .from('visitors')
      .select('id, full_name, source, visitor_comments(count)')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])
  return (
    <Card>
      <VisitorRefresh />
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <UserRoundPlus className="h-5 w-5" /> Visitors
        </CardTitle>
        <Button variant="outline" render={<Link href="/admin/visitors" />}>
          Visitors &amp; QR code
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {total.error || fresh.error || recent.error ? (
          <p className="text-sm text-destructive">
            Visitor records could not be loaded. Please try again shortly.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {total.count ?? 0}
              </span>{' '}
              visitors ·{' '}
              <span className="font-semibold text-foreground">
                {fresh.count ?? 0}
              </span>{' '}
              awaiting first follow-up
            </p>
            <div className="divide-y">
              {recent.data?.map((visitor) => (
                <Link
                  key={visitor.id}
                  href={`/admin/visitors/${visitor.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-primary"
                >
                  <span className="font-medium">{visitor.full_name}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      {visitor.source === 'qr'
                        ? 'QR registration'
                        : 'Manual entry'}
                    </Badge>
                    {visitor.visitor_comments[0]?.count ?? 0} comments
                  </span>
                </Link>
              ))}
              {!recent.data?.length && (
                <p className="py-3 text-sm text-muted-foreground">
                  Add your first visitor or share your church&apos;s welcome QR
                  code.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
