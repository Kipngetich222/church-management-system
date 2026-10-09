'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { Lock } from 'lucide-react'

export function PastoralNotesPanel({
  churchId,
  membershipId,
  notes,
}: {
  churchId: string
  membershipId: string
  notes: any[]
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!body.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: author } = await supabase
      .from('church_memberships')
      .select('id')
      .eq('user_id', user!.id)
      .eq('church_id', churchId)
      .single()

    await supabase.from('pastoral_notes').insert({
      church_id: churchId,
      membership_id: membershipId,
      author_membership_id: author!.id,
      body,
    })
    setBody('')
    setSaving(false)
    router.refresh()
  }

  return (
    
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Pastoral notes (private)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notes.map((n) => (
          <div key={n.id} className="border-l-2 border-amber-500 pl-3">
            <p className="text-sm">{n.body}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(n.created_at), 'MMM d, yyyy · h:mm a')}
            </p>
          </div>
        ))}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a private note..."
          rows={3}
        />
        <Button onClick={add} disabled={saving || !body.trim()}>
          {saving ? 'Saving...' : 'Add note'}
        </Button>
      </CardContent>
    </Card>
    
  )

}