'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, UserMinus } from 'lucide-react'
import { format } from 'date-fns'

type Signup = {
  id: string
  status: string
  signed_up_at: string
  membership_id: string
  church_memberships: { users: { full_name: string | null; email: string } | null } | null
}

export function ShiftRoster({
  shiftId,
  signups,
}: {
  shiftId: string
  signups: Signup[]
}) {
  const router = useRouter()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function remove(id: string) {
    setRemovingId(id)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('volunteer_signups').delete().eq('id', id)
    if (err) {
      setError(err.message)
      setRemovingId(null)
      return
    }
    router.refresh()
    setRemovingId(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster ({signups.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {signups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No one has signed up yet.
          </p>
        ) : (
          <div className="divide-y">
            {signups.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {s.church_memberships?.users?.full_name ?? 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(s.signed_up_at), 'MMM d, h:mm a')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === 'confirmed' ? 'default' : 'secondary'}>
                    {s.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(s.id)}
                    disabled={removingId === s.id}
                  >
                    {removingId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserMinus className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}