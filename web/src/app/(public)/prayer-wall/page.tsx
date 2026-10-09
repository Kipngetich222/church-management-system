import { createPublicClient } from '@/lib/supabase/public'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { Heart } from 'lucide-react'

async function loadWall() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('prayer_requests')
    .select(`
      id, title, body, created_at, visibility,
      church_memberships!prayer_requests_membership_id_fkey(users(full_name)),
      churches(name)
    `)
    .in('visibility', ['public_anonymous', 'public_named'])
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

/** Normalise a PostgREST embedded relation that may come back as a value or array. */
function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default async function PrayerWallPage() {
  const requests = await loadWall()

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Prayer Wall</h1>
      <p className="text-muted-foreground mb-8">
        Pray with and for the church community.
      </p>

      <div className="space-y-3">
        {requests.map((r) => {
          const anonymous = r.visibility === 'public_anonymous'
          const membership = first(r.church_memberships)
          const author = anonymous
            ? 'Anonymous'
            : (first(membership?.users)?.full_name ?? 'Member')
          const church = first(r.churches)

          return (
            <Card key={r.id}>
              <CardContent className="pt-6 space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  {r.title}
                </h3>
                <p className="text-sm">{r.body}</p>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>
                    {author}
                    {church?.name && ` — ${church.name}`}
                  </span>
                  <span>{format(new Date(r.created_at ?? ''), 'MMM d')}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {requests.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            No public requests yet.
          </p>
        )}
      </div>
    </div>
  )
}

