import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { AnnouncementComposer } from '@/components/communication/AnnouncementComposer'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Pin } from 'lucide-react'

export default async function AnnouncementsPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('church_id', churchId)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Announcements</h1>

      <AnnouncementComposer churchId={churchId} />

      <div className="space-y-3">
        {(announcements ?? []).map((a: any) => (
          <Card key={a.id}>
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  {a.pinned && <Pin className="h-4 w-4 text-primary" />}
                  {a.title}
                </h3>
                <Badge variant={a.published ? 'default' : 'secondary'}>
                  {a.published ? 'Published' : 'Draft'}
                </Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap">{a.body}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(a.published_at), 'MMM d, yyyy · h:mm a')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}