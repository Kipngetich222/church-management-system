import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BadgeChip } from '@/components/members/BadgeChip'
import { ShareButton } from '@/components/shared/ShareButton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { format } from 'date-fns'

export default async function MemberProfilePage() {
  const { churchId, church } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select(`
      id, badges, is_baptized, joined_at, date_of_birth, address,
      users(full_name, email, phone, avatar_url)
    `)
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .single()

  const m = membership as any
  const badges = [...(m?.badges ?? [])]
  if (m?.is_baptized) badges.push('baptized')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const shareUrl = `${baseUrl}/members/${m?.id}`

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My profile</h1>
        <Button variant="outline" asChild>
          <Link href="/member/profile/edit">
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {m?.users?.full_name}
            <ShareButton url={shareUrl} title={`${m?.users?.full_name} — ${church?.name}`} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p>{m?.users?.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Phone</p>
            <p>{m?.users?.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date of birth</p>
            <p>{m?.date_of_birth ? format(new Date(m.date_of_birth), 'MMMM d') : '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Member since</p>
            <p>{format(new Date(m?.joined_at), 'MMMM yyyy')}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Badges</p>
            <div className="flex flex-wrap gap-2">
              {badges.length ? badges.map((b) => <BadgeChip key={b} badge={b} />) : (
                <p className="text-sm">No badges yet</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


